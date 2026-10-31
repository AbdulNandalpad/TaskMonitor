# Task Monitor — Build specification (first working version)

This is the implementation brief for the first deployable version. It is deliberately concrete: stack, folder layout, schema, every screen, every rule. Where this file and `architecture.md` differ, this file wins for the first version; the architecture remains the direction.

Target: a working web app on Supabase, deployable to Vercel, that a manager and a field user can sign in to and use end to end on a phone browser and a laptop. Built in one night by one engineer; polish later.

## 1. Stack (fixed)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15, App Router, TypeScript, `src/` directory | Server components for data reads, client components for interaction |
| Styling | Plain CSS with the design tokens from `prototype/shutdown-tracker.html` copied into `src/app/globals.css` | No Tailwind. Reuse class names and look from the prototype. Single bright theme. |
| Backend | Supabase: Postgres, Auth, Storage | Project in the `iamnuniraa` organisation, region Mumbai (`ap-south-1`) |
| Data access | `@supabase/ssr` server client in server components and route handlers; browser client only for auth, uploads and voice | Row-level security does the tenant isolation; the app sets nothing special |
| Excel | `xlsx` (SheetJS) parsed in the browser, rows posted to a route handler | Column mapping UI as in the prototype |
| Voice | Browser `SpeechRecognition` (Web Speech API) for transcription; extraction by a rules parser in `src/lib/voice/extract.ts`; audio captured with `MediaRecorder` and uploaded to Storage | Server-side STT and LLM extraction come later behind the same `extract()` signature |
| PDF | A print-styled route `/report/[listId]` rendered server-side; "Download PDF" uses the browser print dialog for now | Headless Chromium rendering later |
| Deploy | Vercel, env vars from Supabase | Preview deploys on PRs |

Node 24 is installed. Use `npm`. Pin versions in `package.json`.

## 2. Repository layout

```
TaskMonitor/
  app/                         <- the Next.js app (new)
    package.json
    next.config.ts
    .env.example               <- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_AREA_CODE
    src/
      app/
        layout.tsx  globals.css
        (auth)/login/page.tsx
        (app)/layout.tsx            <- requires session + membership in NEXT_PUBLIC_AREA_CODE, else redirect to /login?reason=scope
        (app)/page.tsx              <- dashboard
        (app)/areas/page.tsx        <- picker, only when the user has >1 membership
        (app)/sections/[id]/page.tsx
        (app)/tasks/[id]/page.tsx
        (app)/tasks/new/page.tsx
        (app)/import/tasks/page.tsx
        (app)/workforce/page.tsx
        (app)/assign/page.tsx
        (app)/form/page.tsx
        (app)/report/[listId]/page.tsx
        api/import/tasks/route.ts   api/import/workforce/route.ts
        api/tasks/[id]/edit/route.ts
        api/tasks/[id]/update/route.ts   <- status/progress/voice/photo updates
        api/auth/login/route.ts     <- user ID + password -> Supabase sign-in with synthetic e-mail
      components/                   <- Hero, Tiles, SectionList, TaskRow, StatusSteps, Timeline, Sheet, Toast, MicButton, VoiceSheet, ...
      lib/
        supabase/server.ts  supabase/client.ts  supabase/admin.ts
        auth.ts                      <- loginIdToEmail(), requireMembership()
        tasks.ts                     <- versioning helpers: editTask(), recordUpdate()
        excel.ts                     <- parseRows(), normaliseHours("4 hrs") -> 4
        voice/extract.ts             <- extract(transcript, task) -> {status, progress, manpower, remarks, confidence}
  supabase/
    config.toml
    migrations/0001_init.sql         <- schema + RLS + functions (section 4)
    seed/seed.ts                     <- creates area, users, workforce, form, sections, tasks from seed-data.json
    seed/seed-data.json              <- the 99 tasks and 12 people, copied from the prototype's SECTIONS/PEOPLE arrays
  docs/ prototype/ README.md         <- existing
```

## 3. Authentication and area scoping

- Users sign in with **user ID + password**. Supabase Auth needs an e-mail, so the app maps `login` to a synthetic address: `${login}@users.taskmonitor.local`. The user never sees it. `api/auth/login` does the mapping and calls `signInWithPassword` server-side, sets the cookie session, then checks membership.
- The deployment is bound to one area by `NEXT_PUBLIC_AREA_CODE` (for example `bf1`). After sign-in:
  - no membership in that area → sign out immediately and redirect to `/login?reason=scope` which shows: "*Name* is not scoped to *Area*. Access is granted per area by the administrator." Log the attempt in `audit_log` with action `login_refused_scope`.
  - exactly one membership → dashboard.
  - several memberships → `/areas` picker; the chosen `area_id` is stored in a cookie `tm_area` and every page reads it. Only areas the user is a member of are selectable (the server checks).
- Roles: `area_admin`, `manager`, `field_user`, `viewer`. Manager menu and Edit button render only for `area_admin` and `manager`. RLS enforces the same on writes. Exception agreed with the client on 31 Oct 2026: **Form settings is open to every signed-in role** for now; keep the restriction behind one constant `FORM_EDIT_ROLES` so it can be tightened later.
- Each profile has `language` (default `en-IN`; options `en-IN`, `hi-IN`, `kn-IN`). The voice sheet shows the current language and lets the user switch for that recording. Mixed Hindi and English speech is expected.
- Retention: attachments are kept at least 90 days (client answer). Nothing is deleted automatically in this version; record `retention_days = 90` in `area.settings`.
- Password rules for the first version: minimum 8 characters, forced change on first login via `profiles.must_change_password`. Lockout is deferred (Supabase rate limits cover the basics).

## 4. Database (migration `0001_init.sql`)

Implement `docs/data-model.md` with these simplifications for the first version:

- `organisation`, `plant` are single rows created by seed; keep the tables.
- `profiles` (id = `auth.users.id`, login, display_name, must_change_password) replaces `app_user`.
- `membership (user_id, area_id, role)`.
- `person`, `form`, `form_version`, `form_field`, `task_list`, `section`, `task`, `task_version`, `task_field_change`, `task_update`, `attachment`, `import_job`, `audit_log` as specified. Skip `report_job`, `notification`, `session`.
- Status enum: `not_started`, `in_progress`, `completed`. No blocked.

RLS, on every table with `area_id`:

```sql
create or replace function public.is_member(a uuid) returns boolean
language sql stable security definer as $$
  select exists (select 1 from membership m where m.user_id = auth.uid() and m.area_id = a);
$$;
create or replace function public.has_role(a uuid, roles area_role[]) returns boolean
language sql stable security definer as $$
  select exists (select 1 from membership m where m.user_id = auth.uid() and m.area_id = a and m.role = any(roles));
$$;

alter table task enable row level security;
create policy task_select on task for select using (is_member(area_id));
create policy task_write  on task for insert with check (has_role(area_id, '{area_admin,manager}'));
create policy task_update on task for update using (is_member(area_id)) with check (is_member(area_id));
```

Field users may update `status`, `progress` and insert `task_update`/`attachment`; only managers insert/edit tasks, people, forms, sections. Express that with per-table policies. `membership` is readable by its own user and by area admins; written only by the service role (seed and admin tools).

Versioning is enforced in the database, not left to the app:

```sql
create or replace function public.task_edit(p_task uuid, p_values jsonb, p_section uuid, p_responsible uuid, p_source text)
returns uuid language plpgsql security invoker as $$
declare v_old task_version; v_new_id uuid; v_ver int; k text;
begin
  select * into v_old from task_version where id = (select current_version_id from task where id = p_task);
  v_ver := coalesce(v_old.version, 0) + 1;
  insert into task_version(area_id, task_id, version, values, section_id, responsible_person_id, changed_by, changed_at, source)
    select area_id, p_task, v_ver, p_values, p_section, p_responsible, auth.uid(), now(), p_source from task where id = p_task
    returning id into v_new_id;
  for k in select jsonb_object_keys(p_values || coalesce(v_old.values,'{}'::jsonb)) loop
    if (v_old.values -> k) is distinct from (p_values -> k) then
      insert into task_field_change(area_id, task_id, task_version_id, field_key, old_value, new_value, changed_by, changed_at)
        select area_id, p_task, v_new_id, k, v_old.values -> k, p_values -> k, auth.uid(), now() from task where id = p_task;
    end if;
  end loop;
  if v_old.section_id is distinct from p_section then insert into task_field_change(...) values (... 'section' ...); end if;
  if v_old.responsible_person_id is distinct from p_responsible then insert into task_field_change(...) values (... 'responsible' ...); end if;
  update task set current_version_id = v_new_id, section_id = p_section, responsible_person_id = p_responsible where id = p_task;
  return v_new_id;
end $$;
```

`task_create(...)` writes the task and version 1 the same way. The app never updates `task_version` or `task_field_change` rows.

Storage: one bucket `attachments`, private. Object key `area/<area_id>/task/<task_id>/<update_id>/<uuid>.<ext>`. Policies: members of the area may read and insert; nobody updates or deletes.

## 5. Seed

`npm run seed` (uses the service role key, never shipped to the browser):

1. Organisation "Default", plant "Main Works", area `bf1` "Blast Furnace 1".
2. Users: `sunita.m` (manager), `ravi.k` (field_user), `anil.v` (manager in `bf1` and in a second area `sp1` "Sinter Plant 1"), `meena.r` (member of `sp1` only). Password for all: `ChangeMe-2026!`, `must_change_password = true`.
3. Workforce: the 12 people from `seed-data.json`, `ravi.k` linked to person "Ravi Kumar".
4. Form "Shutdown jobs" v1 with fields: section (section), work_description (text, required), planned_hours (number), manpower (number), vendor (text), responsible (person, required), photo_on_completion (photo, required).
5. Task list "Blast Furnace 1 shutdown" with the 10 sections and 99 tasks, statuses distributed as in the prototype (`PATTERN`), each task created through `task_create` so version 1 exists.

## 6. Screens (match the prototype in look and wording)

Phone-first. Max content width 480px centred on desktop for the field screens; manager screens may use up to 960px for tables.

| Route | Who | Must have |
|-------|-----|-----------|
| `/login` | all | Area tag, User ID, Password, Sign in; error box for bad credentials and for scope refusal |
| `/areas` | multi-area users | List of the user's areas; others shown locked |
| `/` dashboard | all | Hero with compliance %, bar and legend; three tiles green/yellow/red; manager Menu grid (Create task, Upload tasks, Workforce, Assign tasks, PDF report, Form settings); field user "My tasks" card; sections list with % and "Behind" when < 50 % |
| `/sections/[id]` | all | Filters All / Not started / In progress / Completed; task rows with coloured stripe, hours, responsible, version chip when > 1 |
| `/tasks/[id]` | all | Plan card, version chip and "edited by", status steps (three), progress slider, updates timeline, add photo, field history with old → new; Edit button for managers; mic button |
| `/tasks/new` | manager | Section, description, hours, manpower, vendor, responsible, photo rule; creates via `task_create` |
| Edit sheet | manager | Same fields; saves via `task_edit`; toast "Saved as version N · k fields changed" |
| `/import/tasks` | manager | File picker, parsed columns → field dropdowns with sensible defaults by header name, warning box (skipped rows, parsed hours, filled-down responsible), preview of first 3, Import button; existing task match by section + description → `task_edit` with source `excel_import` |
| `/workforce` | manager | Tiles, Upload from Excel sheet (Name, Role, Section, Phone, Vendor team), Add person sheet, list with task load |
| `/assign` | manager | Tiles, filters Unassigned / All / per person, Assign button → sheet of people with load; assignment goes through `task_edit` with source `assignment` |
| `/form` | manager | Field list with Required toggle, add field by type, save creates a new `form_version` |
| `/report/[listId]` | manager | Three print-styled pages as in the prototype: summary + compliance by section; not started and in progress with last remark; photo evidence + sign-off. Print button. |
| Voice sheet | all | Listening state with level meter; transcript; Check and confirm with status, progress, manpower, remarks; Confirm writes a `task_update` of type `voice` with `text`, `extracted`, `confirmed` and the audio attachment |

Status colours: completed `#16a34a`, in progress `#f59e0b`, not started `#ef4444`. Nothing else is colour-coded.

## 7. Voice (first version)

- Start: tap the mic button. Wake word is out of scope for the browser version; keep the "Say Hey Monitor" hint off.
- Record with `MediaRecorder` (webm/opus) and transcribe live with `SpeechRecognition` (`lang` from the user's profile, default `en-IN`; a language chip in the sheet switches to `hi-IN` or `kn-IN` for that recording). Cloud speech services are acceptable to the client, so the server-side route `api/voice/transcribe` may call a hosted speech API when a key is configured; without a key, the browser transcript is used. If `SpeechRecognition` is unavailable, show the transcript box as editable text so the user can type.
- `extract(transcript, task)` rules: "completed|done|finished" → completed 100; "started|starting|begin" → in progress 10; a number followed by "percent|%" → progress; "stopped|hold|waiting|blocked" → in progress with remark flagged needs attention; "(\d+) (people|persons|men|workers)" → manpower; the rest → remarks. Return a confidence per field so the sheet can highlight low ones.
- Confirm step is mandatory. Save transcript, extracted, confirmed, and upload the audio blob to `attachments` linked to the update.

## 8. Acceptance (run before calling it done)

1. `meena.r` signs in to the `bf1` deployment → refused with the scope message; row in `audit_log`.
2. `anil.v` signs in → area picker with two areas; choosing `bf1` → dashboard.
3. `sunita.m` signs in → dashboard at once; menu visible. `ravi.k` → dashboard with My tasks; no menu, no Edit.
4. Create a task → appears in its section as not started, version 1 exists.
5. Edit planned hours and vendor → version 2, two `task_field_change` rows, history panel shows old → new.
6. Import the prototype's sheet layout (make a 12-row test .xlsx from `seed-data.json`): 10 created, blank rows skipped, "4 hrs" parsed to 4.
7. Assign an unassigned task → version increments, load count changes.
8. As `ravi.k`: set in progress 60 %, add a photo, record a voice update "completed, six people" → task completed, update with transcript and audio saved.
9. Report page renders three pages with correct counts; print preview is clean.
10. Direct API attempt to read a `sp1` task while signed in as `ravi.k` returns no rows (RLS).

## 9. Not in this version

Offline mode, SSO, notifications, server-side STT and LLM extraction, headless PDF, iOS packaging, second area UI beyond the picker.
