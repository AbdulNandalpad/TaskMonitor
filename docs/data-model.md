# Task Monitor — Data model

PostgreSQL 16. Every tenant table carries `area_id` and has a row-level security policy (see `architecture.md` §3.3). UUID primary keys. All timestamps are `timestamptz`. Soft deletes are not used; records are superseded by new versions or marked inactive.

## Entity overview

```
organisation ─< plant ─< area ─< task_list ─< task ─< task_version
                                   │            │        task_field_change
                                   │            ├─< task_update ─< attachment
                                   │            └── assignment (responsible, monitors)
                                   ├─< form ─< form_version ─< form_field
                                   ├─< person (workforce)
                                   └─< section
user ─< membership >─ area
import_job, report_job, audit_log, notification
```

## Tables

### Hierarchy and access

```sql
CREATE TABLE organisation (id uuid PK, name text NOT NULL, created_at timestamptz);
CREATE TABLE plant        (id uuid PK, organisation_id uuid REFERENCES organisation, name text NOT NULL);
CREATE TABLE area         (id uuid PK, plant_id uuid REFERENCES plant, code text UNIQUE NOT NULL,
                           name text NOT NULL, wake_word text DEFAULT 'Hey Monitor',
                           settings jsonb NOT NULL DEFAULT '{}', active boolean DEFAULT true);

CREATE TABLE app_user     (id uuid PK, organisation_id uuid REFERENCES organisation,
                           login text UNIQUE NOT NULL,            -- user ID typed at sign-in
                           display_name text NOT NULL, phone text, email text,
                           password_hash text,                   -- argon2id; null when SSO-only
                           must_change_password boolean DEFAULT true,
                           failed_logins int DEFAULT 0, locked_until timestamptz,
                           active boolean DEFAULT true, created_at timestamptz);

CREATE TYPE area_role AS ENUM ('area_admin','manager','field_user','viewer');
CREATE TABLE membership   (user_id uuid REFERENCES app_user, area_id uuid REFERENCES area,
                           role area_role NOT NULL, granted_by uuid REFERENCES app_user,
                           granted_at timestamptz, PRIMARY KEY (user_id, area_id));

CREATE TABLE session      (id uuid PK, user_id uuid, area_id uuid, refresh_hash text,
                           expires_at timestamptz, revoked_at timestamptz, device text);
```

A user signs in to an area only if a `membership` row exists for that pair. The refused attempt is written to `audit_log`.

### Workforce

```sql
CREATE TYPE person_kind AS ENUM ('employee','vendor_team');
CREATE TABLE person (id uuid PK, area_id uuid NOT NULL, kind person_kind NOT NULL,
                     name text NOT NULL, role_title text, section_id uuid, phone text,
                     vendor_name text, team_size int, employee_code text,
                     user_id uuid REFERENCES app_user,     -- set when the person can log in
                     active boolean DEFAULT true, created_at timestamptz);
```

A person is the thing you assign work to; a user is the thing that logs in. Most employees are both; a vendor team is a person without a user.

### Forms (versioned)

```sql
CREATE TABLE form         (id uuid PK, area_id uuid NOT NULL, name text NOT NULL,
                           template text, current_version_id uuid);
CREATE TABLE form_version (id uuid PK, form_id uuid REFERENCES form, version int NOT NULL,
                           created_by uuid, created_at timestamptz, note text,
                           UNIQUE (form_id, version));
CREATE TYPE field_type AS ENUM ('text','number','dropdown','yes_no','date','person','photo','section');
CREATE TABLE form_field   (id uuid PK, form_version_id uuid REFERENCES form_version,
                           key text NOT NULL,              -- stable across versions, e.g. planned_hours
                           label text NOT NULL, type field_type NOT NULL, required boolean DEFAULT false,
                           options jsonb,                  -- dropdown options, photo rule, number unit
                           position int NOT NULL, UNIQUE (form_version_id, key));
```

Saving the form builder writes a new `form_version` with the full set of `form_field` rows. A field keeps its `key` across versions, so a value recorded under v3 is still readable under v4.

### Task lists, sections, tasks

```sql
CREATE TABLE task_list    (id uuid PK, area_id uuid NOT NULL, form_id uuid REFERENCES form,
                           name text NOT NULL, starts_at timestamptz, ends_at timestamptz,
                           planned_hours numeric, status text DEFAULT 'planned', created_by uuid);
CREATE TABLE section      (id uuid PK, area_id uuid NOT NULL, task_list_id uuid REFERENCES task_list,
                           name text NOT NULL, head_person_id uuid REFERENCES person, position int);

CREATE TYPE task_status AS ENUM ('not_started','in_progress','completed');
CREATE TABLE task         (id uuid PK, area_id uuid NOT NULL, task_list_id uuid REFERENCES task_list,
                           seq int NOT NULL,                       -- human number within the list
                           external_ref text,                      -- id from the client's sheet, if any
                           section_id uuid REFERENCES section,
                           form_version_id uuid REFERENCES form_version,  -- version the task was created under
                           current_version_id uuid,                -- points at task_version
                           status task_status NOT NULL DEFAULT 'not_started',
                           progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
                           responsible_person_id uuid REFERENCES person,
                           created_by uuid, created_at timestamptz, created_via text);  -- app | excel_import | api
CREATE TABLE task_monitor (task_id uuid REFERENCES task, person_id uuid REFERENCES person,
                           PRIMARY KEY (task_id, person_id));
```

### Task versions and field history

```sql
CREATE TABLE task_version (id uuid PK, area_id uuid NOT NULL, task_id uuid REFERENCES task,
                           version int NOT NULL,
                           values jsonb NOT NULL,          -- {field_key: value} for every field at this version
                           section_id uuid, responsible_person_id uuid,
                           changed_by uuid REFERENCES app_user, changed_at timestamptz NOT NULL,
                           source text NOT NULL,           -- app_edit | excel_import | assignment | voice
                           note text, UNIQUE (task_id, version));

CREATE TABLE task_field_change (id uuid PK, area_id uuid NOT NULL, task_id uuid, task_version_id uuid,
                           field_key text NOT NULL, old_value jsonb, new_value jsonb,
                           raw_input text,                 -- e.g. "4 hrs" before parsing
                           changed_by uuid, changed_at timestamptz NOT NULL);
```

Rules:

- Creating a task writes `task_version` v1 with every field value.
- Any edit, reassignment, section move or re-import writes v(n+1) with the complete value set, one `task_field_change` row per field that differs, and updates `task.current_version_id`.
- Nothing in `task_version` or `task_field_change` is ever updated or deleted.
- The task screen shows the current version; the history panel lists versions with their diffs. A report can be run "as at" any version.

### Updates and attachments

```sql
CREATE TYPE update_type AS ENUM ('status','progress','voice','photo','note','edit','assignment');
CREATE TABLE task_update (id uuid PK, area_id uuid NOT NULL, task_id uuid REFERENCES task,
                          type update_type NOT NULL, by_user uuid, at timestamptz NOT NULL,
                          device_at timestamptz, gps point,
                          status_before task_status, status_after task_status,
                          progress_before smallint, progress_after smallint,
                          text text,                      -- remark or transcript
                          extracted jsonb,                -- fields the voice agent proposed
                          confirmed jsonb,                -- fields after the user's corrections
                          task_version_id uuid);          -- version this update belongs to

CREATE TYPE attachment_kind AS ENUM ('photo','audio','document');
CREATE TABLE attachment  (id uuid PK, area_id uuid NOT NULL, task_update_id uuid REFERENCES task_update,
                          kind attachment_kind NOT NULL, object_key text NOT NULL, sha256 text NOT NULL,
                          mime text, bytes bigint, width int, height int, duration_ms int,
                          label text,                     -- before | after | abnormal | free text
                          thumb_key text, created_at timestamptz);
```

Audio from a voice update is an `attachment` of kind `audio` on the same `task_update` as the transcript.

### Imports, reports, audit, notifications

```sql
CREATE TABLE import_job  (id uuid PK, area_id uuid NOT NULL, kind text NOT NULL,  -- tasks | workforce
                          file_key text, sheet text, mapping jsonb, status text,
                          rows_total int, rows_created int, rows_updated int, rows_skipped int,
                          report jsonb, by_user uuid, created_at timestamptz, finished_at timestamptz);
CREATE TABLE report_job  (id uuid PK, area_id uuid NOT NULL, task_list_id uuid, kind text,
                          status text, object_key text, pages int, bytes bigint,
                          by_user uuid, created_at timestamptz, finished_at timestamptz);
CREATE TABLE audit_log   (id bigserial PK, at timestamptz NOT NULL, area_id uuid, user_id uuid,
                          action text NOT NULL,           -- login_ok, login_refused_scope, import, export, ...
                          target_type text, target_id uuid, detail jsonb, ip inet);
CREATE TABLE notification(id uuid PK, area_id uuid NOT NULL, user_id uuid, kind text, title text, body text,
                          task_id uuid, channels text[], sent_at timestamptz, read_at timestamptz);
```

## Row-level security

Applied to every table with an `area_id` column:

```sql
ALTER TABLE task ENABLE ROW LEVEL SECURITY;
ALTER TABLE task FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON task
  USING (area_id = current_setting('app.area_id', true)::uuid)
  WITH CHECK (area_id = current_setting('app.area_id', true)::uuid);
```

The API opens a transaction, runs `SET LOCAL app.area_id = '<id from token>'`, then runs queries. Migrations and backups use a separate role that bypasses RLS and is never used by the application at run time.

## Indexes worth having from day one

- `task (area_id, task_list_id, status)`, `task (area_id, responsible_person_id)`, `task (area_id, section_id)`
- `task_version (task_id, version DESC)`, `task_field_change (task_id, changed_at DESC)`
- `task_update (task_id, at DESC)`, `attachment (task_update_id)`
- `membership (area_id, role)`, `audit_log (area_id, at DESC)`
- GIN on `task_version.values` for searching field values

## Mapping from the client's sheet

| Sheet column | Field key | Type | Note |
|--------------|-----------|------|------|
| S.NO | `seq` / `external_ref` | — | Kept as external reference |
| Area | section | section | Merged cells filled down |
| Work Description | `work_description` | text | Required; blank rows skipped |
| Shutdown Duration (Hrs.) | `planned_hours` | number | "4 hrs", "08 hrs", "6 hra" parsed; raw text kept in `raw_input` |
| Manpower Required | `manpower` | number | |
| Vendor | `vendor` | text | |
| Responsible Person | responsible | person | Matched to workforce by name; unmatched rows flagged |
| Compliance Description | `remarks` | text | |
| Status | status | — | Mapped to the three statuses |
| Remarks | `remarks` | text | Appended |
| Compliance % | progress | — | 0–100 |
