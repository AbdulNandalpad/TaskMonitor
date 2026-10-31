# Task Monitor — Architecture

Status: finalised for build, 31 October 2026. Changes go through a pull request to this file.

## 1. Purpose and scope

Task Monitor tracks lists of tasks in a plant area: shutdown jobs, inspection rounds, audits, or any list a manager defines. It replaces a spreadsheet plus phone calls with:

- a manager side that builds the form, creates or imports tasks, maintains the workforce and assigns people;
- a field side that records status, progress, remarks and photos, primarily by voice;
- a reporting side that compiles a PDF from the recorded data on demand.

The first deployment is one area with a handful of task lists. The design is multi-tenant so that further areas, plants and eventually other customers are configuration, not code.

## 2. Vocabulary

| Term | Meaning | Example |
|------|---------|---------|
| Organisation | The customer. Top of the hierarchy. | One steel company |
| Plant | A site inside the organisation. | Main Works |
| **Area** | **The tenant.** The unit of login scope, data isolation and configuration. | Blast Furnace 1, Sinter Plant 1 |
| Task list | A set of tasks that share one form, usually with a start and end. | Blast Furnace 1 shutdown, December |
| Form | The field definition for a task list. Versioned. | Shutdown jobs v3 |
| Section | A grouping field inside a task list (the "Area" column in the client's sheet). | Tuyere Platform, SGP, Stock House |
| Task | One row of work with field values, a status, a responsible person and a monitor. | GB 05A conveyor belt changing |
| Update | A timestamped record against a task: voice note, photo, status change, edit. | "Belt in progress, seventy percent" |
| Version | A snapshot of a task's field values after an edit. | v2 after planned hours changed |
| Membership | A user's role in one area. | Ravi Kumar, Area head, Blast Furnace 1 |

The word "Area" is the client's word for the tenant. The client's sheet also uses "Area" for the sub-grouping; the product calls that **Section** to keep the two apart. The manager can label the field "Area" in the form if they prefer.

## 3. Tenancy and access control

### 3.1 Model

- Every record that belongs to a tenant carries `area_id`. No exceptions.
- A user record is organisation-wide (one person, one login). Access to an area is a **membership** row: `(user_id, area_id, role)`.
- Roles per area: `area_admin`, `manager`, `field_user`, `viewer`. A plant or organisation level viewer is expressed as memberships in each area they may see, created by an administrator, so the enforcement path is always the same.
- A user with no membership in an area cannot sign in to that area, cannot see its data through the API, and cannot be assigned its tasks.

### 3.2 Login flow

1. The client opens the app. The app is bound to one area at deploy time (configuration or hostname such as `bf1.taskmonitor.internal`). With a single area this is simply the only deployment.
2. The user enters user ID and password. The server verifies the credential (argon2id hash) and loads the user's memberships.
3. If the user has no membership in the requested area, the server returns an explicit "not scoped to this area" error and logs the attempt. Nothing else is revealed.
4. If the user has exactly one membership, the server issues a session for that area and the app opens the dashboard.
5. If the user has several memberships, the app shows the area picker; choosing one issues a session for it. Switching area later requires choosing again, which issues a new session.

A session is a short-lived signed token (JWT, 15 minutes) with claims `sub`, `area_id`, `role`, plus a rotating refresh token stored server side (7 days, revocable). Every API call carries the token; the server sets the tenant context from `area_id` in the token, never from a request parameter.

### 3.3 Enforcement in the database

PostgreSQL row-level security on every tenant table:

```sql
ALTER TABLE task ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_tenant ON task
  USING (area_id = current_setting('app.area_id')::uuid);
```

The API sets `app.area_id` per connection from the verified token before any query. A bug in application code therefore cannot leak another area's rows: the database refuses them. Administrative jobs (import, report generation) run with the same setting for the area they serve.

### 3.4 Credentials and later single sign-on

Phase 1 uses local credentials: user ID, argon2id password hash, forced change on first login, lockout after repeated failures, password reset by an area administrator. The identity module sits behind one interface (`AuthProvider`) so that single sign-on through the client's directory (OIDC or SAML) is added later by implementing that interface and mapping directory groups to memberships. The membership table remains the source of truth for area access either way.

## 4. System components

```
Mobile app (Android first)  ──┐
Web app (manager, reports)  ──┼──► API (NestJS, TypeScript) ──► PostgreSQL (RLS)
                              │          │        │
                              │          │        └──► Object storage (S3 API: MinIO on-prem or cloud)
                              │          ├──► Job queue (Redis + BullMQ): imports, transcription, extraction, PDF
                              │          └──► Voice service: speech-to-text + field extraction
                              └──► Notifications: push (FCM), e-mail, optional SMS/WhatsApp
```

| Component | Choice | Why |
|-----------|--------|-----|
| API | NestJS (Node, TypeScript), REST + OpenAPI | Mature, typed, modular; one language across API and web |
| Database | PostgreSQL 16 | Row-level security, JSONB for form values, strong tooling |
| ORM | Prisma with raw SQL for RLS policies | Typed queries, migrations in git |
| Object storage | S3-compatible (MinIO on-prem, or cloud S3) | Same code path on-prem and in cloud |
| Queue | Redis + BullMQ | Transcription and PDF work must not block requests |
| Mobile | Flutter, Android first | One codebase; iOS when needed; good camera and audio support |
| Web | Next.js (React, TypeScript) | Manager console, dashboards, report viewer |
| PDF | Headless Chromium rendering HTML templates | The report is designed once as HTML; same look on screen and paper |
| Excel | SheetJS (read) and ExcelJS (write) | Column mapping import; Excel export in the client's own layout |
| Identity | Local credentials behind an `AuthProvider` interface | Simple login now, SSO later without touching the rest |

## 5. Forms and tasks

### 5.1 Form definitions are versioned

A form has an immutable `form_version` row per save. A task records the `form_version_id` it was created under. When the manager adds or changes fields, a new version is created; existing tasks keep their values and simply have no value for a field that did not exist when they were created. The UI shows the latest version's fields and marks values that are missing. No migration is needed to add a field.

Field types in Phase 1: text, number, dropdown (options list), yes/no, date, person (reference to workforce), photo (required or optional, with a rule: on completion, always, if abnormal).

### 5.2 Task values and history

Task field values are stored in `task_version` rows as JSONB keyed by field id. The current version is pointed to by `task.current_version_id`. Every edit, including reassignment and Excel re-import of an existing row, writes a new `task_version` and a `task_field_change` row per changed field (field, old value, new value, who, when, source). Nothing is updated in place except `current_version_id`.

This gives the client what they asked for: today's task list can be edited later and the database keeps the history of every field from the old form.

### 5.3 Status

Three statuses: `not_started` (red), `in_progress` (yellow), `completed` (green). Progress is a percentage; setting 100 completes, setting 0 resets to not started. Status changes are updates and are recorded in the history like any other change.

### 5.4 Excel import

Import is a two-step job: upload and parse (SheetJS, server side), then map columns to form fields with a preview, then commit. Rules:

- Rows with an empty required field are skipped and reported.
- Numeric fields accept text such as "4 hrs" or "08 hrs" and record the parsed number plus the original text in the change source.
- Merged cells for Responsible Person are filled down, matching the client's sheet.
- A row that matches an existing task (by an explicit external id column, or by section plus description) updates that task as a new version instead of creating a duplicate.
- Workforce import uses the same mechanism with person fields: name, role, section, phone, vendor team. New people get a login for that area; existing people are updated.

## 6. Voice to text agent

This is the primary way the field team records work. It must work on a noisy shop floor, on mid-range Android phones, with gloves on.

### 6.1 Flow

1. **Start.** Tap the mic button, or say the wake word. The wake word is detected **on the device** by a small keyword model (no audio leaves the phone until the wake word fires). The wake word is configurable per deployment; the prototype uses "Hey Monitor".
2. **Record.** The app records 16 kHz mono audio with noise suppression. The user sees a live level meter and taps "Done speaking", or the app stops after two seconds of silence.
3. **Transcribe.** The audio is uploaded and queued. Speech-to-text runs with the language set per user (Hindi, English, Kannada, or mixed) and a custom vocabulary of equipment tags and section names taken from the task list, which sharply improves recognition of terms such as "GB 05A" and "tuyere".
4. **Extract.** A language model receives the transcript, the task's field definitions and current values, and returns a strict JSON object: status, progress, manpower, remarks, and any form field it can fill, each with a confidence. Low-confidence fields are highlighted for the user.
5. **Confirm.** The app shows the transcript and the extracted fields in an editable sheet. Nothing is saved until the user taps Confirm. This step is not optional; it is what makes the recorded data trustworthy.
6. **Store.** The update is saved with the transcript, the extracted fields, the user's corrections, and a reference to the audio file in object storage. The audio is evidence and is retained under the same policy as photos.

Navigation by voice: if no task is open, the agent matches the spoken task name against the user's tasks and offers to open the best match.

### 6.2 Engines

| Step | Default | On-premise alternative |
|------|---------|------------------------|
| Wake word | On-device keyword model | Same |
| Speech-to-text | Cloud speech API with Indian language support and custom vocabulary | Self-hosted Whisper large-v3 on one GPU server |
| Extraction | Hosted LLM API with structured output | Self-hosted open-weight model behind the same interface |

The voice service exposes one internal interface (`transcribe(audio, language, vocabulary)` and `extract(transcript, schema, context)`), so the engine is a deployment choice. The client's answer on whether audio may leave the plant network decides the default.

### 6.3 Quality targets for acceptance

- Word error rate under 15 percent on a recorded test set of 200 shop-floor utterances in the pilot languages.
- Correct status and progress extraction in 90 percent of the test set without user correction.
- End to end, from "Done speaking" to the confirm sheet, under 6 seconds on plant Wi-Fi.

These are measured in Phase 2 and are a gate for the pilot.

## 7. Photos

Photos are taken in the app so they can be stamped. Each photo record carries task id, update id, user, device time, server time, and optional GPS. The original is stored in object storage with a SHA-256 hash; a thumbnail is generated by a queue job. Photos are never deleted by users; a wrong photo is superseded by another with a note. Retention is configurable per area; the default is the life of the task list plus seven years, to be confirmed with the client.

## 8. Reports

Reports are rendered from HTML templates by headless Chromium in a queue job, stored in object storage, and served by signed URL. The default management report has three parts: summary and compliance by section, tasks not started and in progress with the last recorded remark, and photo evidence with a sign-off block. An Excel export in the client's original column layout is produced alongside it. A live dashboard shows the same numbers during the task list without generating a file.

## 9. Notifications

Assignment, status changes on monitored tasks, and tasks not started past a threshold raise notifications: push to the mobile app, e-mail to managers, and optionally SMS or WhatsApp through a provider. Every notification is also visible in the app. Rules are per area.

## 10. Deployment

The whole system is containers. Two deployment shapes, same images:

| Shape | Where | When |
|-------|-------|------|
| Customer-hosted | Docker Compose on one or two VMs inside the plant network for the pilot; Kubernetes when more areas join | Default assumption for this client |
| Cloud | Managed Postgres, S3, container service in an Indian region; one tenant database per customer | For customers who accept hosted data |

The pilot environment: one application VM (API, web, queue workers), one database VM (PostgreSQL with daily backups to object storage), MinIO for files, a GPU server only if speech-to-text is self-hosted. TLS everywhere, including inside the plant network. Mobile app distributed through the client's device management or as a signed APK.

Environments: `dev` (shared, auto-deploy from `main`), `staging` (client UAT, deploy on tag), `production`. GitHub Actions builds, tests and publishes images; deployment to the customer environment is a scripted step run from inside their network.

## 11. Security summary

- Tenant isolation enforced in the database by row-level security, not only in code.
- Passwords hashed with argon2id; lockout; forced change on first login; sessions short-lived and revocable.
- All traffic over TLS; object storage reachable only through signed URLs issued by the API.
- Audit log of logins (including refused cross-area attempts), imports, exports, assignments and edits. Field history is itself an audit trail.
- Photos and audio are immutable once stored; hash recorded.
- Dependency scanning and container scanning in CI; secrets in the platform's secret store, never in the repository.

## 12. Out of scope for the first release

Offline working, integration with the client's maintenance system (work orders), iOS, single sign-on, multi-plant reporting across areas. Each is designed for (see the interfaces above) but not built until asked.

## 13. Open questions for the client

1. May audio and transcripts leave the plant network for cloud speech and language services, or must they stay on-premise?
2. Which languages must the pilot recognise?
3. Who may create and edit forms: area administrators only, or every manager?
4. Photo and audio retention period.
5. Is there an existing employee list to import for the workforce, and does it carry a unique employee ID?
