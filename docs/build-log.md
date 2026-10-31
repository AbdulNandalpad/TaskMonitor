# Task Monitor — Build log

Status of the first working version against `docs/build-spec.md`. Last updated 1 Nov 2026.

## Done

- **Scaffold**: Next.js 15 (App Router, `src/`), TypeScript, plain CSS. The tokens and component styles of the prototype are in `app/src/app/globals.css`. `app/.env.example` has the four variables from the spec.
- **Database** (`supabase/migrations/0001_init.sql`): all section 4 tables, enums, RLS with `is_member` / `has_role`, `task_create`, `task_edit`, `task_record_update`, `form_save`, `log_audit`, `public_area_name`, the `task_current` view and the private `attachments` bucket with policies. Idempotent; run twice in a local test and on the live project.
- **Seed**: `supabase/seed/seed-data.json` (from the prototype arrays), `seed.ts` (service key, `npm run seed`) and `seed.sql` (pure SQL for the dashboard SQL editor, incl. the four auth users). Both give 12 people, 10 sections, 99 tasks, 4 users.
- **Screens**: login + scope refusal, forced password change (`/password`), area picker, dashboard, sections, task detail (status, progress, photo, updates timeline, field history old → new), edit sheet, create task, assign, workforce (add + Excel upload), import tasks (column mapping), form settings, print-styled report (3 pages), voice sheet.
- **Voice**: `SpeechRecognition` + `MediaRecorder`, language chips (en-IN / hi-IN / kn-IN), rules `extract()` with per-field confidence, mandatory confirm step, audio uploaded to Storage and linked to the update. Typed fallback when the mic or `SpeechRecognition` is unavailable. Said on a dashboard or section screen, it finds the task by name and opens it.
- `npm run build` passes.

## Acceptance (section 8) against the live project

Run with `npm run dev` up: `npx tsx scripts/acceptance.ts` (from `app/`). 24 checks, all pass: 1 scope refusal + `audit_log` row; 2 picker with two areas; 3 manager vs field user (menu, Edit); 4 create task v1; 5 edit → v2 with two `task_field_change` rows and old → new in history, field user gets 403; 6 12-row xlsx → 10 created, 2 blank rows skipped, "4 hrs" → 4, re-import creates no duplicates; 7 assign → version +1, load +1; 8 in progress 60 %, photo, voice "completed, six people" → completed with transcript and audio; 9 report renders three pages with matching counts, field user cannot open it; 10 `ravi.k` reads no `sp1` rows (also via the REST endpoint), anonymous reads nothing, field user cannot call `task_create`.

Also checked by hand in the browser pane (phone width): sign in, edit sheet (saved as version 2, history shows 4 h → 6 h), voice sheet with the typed fallback (the pane blocks the microphone), confirm step, update saved.

## Not done / known gaps

- **Real microphone, `SpeechRecognition` and photo capture on a phone were not exercised** (the pane blocks the mic; the API-level run uploaded stand-in audio and a PNG). Test on a real phone before the client sees it.
- Server-side STT route (`api/voice/transcribe`) is not built; the browser transcript is always used.
- Add person creates the workforce record only; **no login is created** (needs the service key and an admin tool). Memberships are written by seed / admin only.
- Voice confirm records manpower in the update but does not change the task's manpower value (that would be a new version).
- Photo-on-completion rule is stored per task but not enforced when completing.
- The area picker shows only areas the user is a member of (RLS hides others), so "others shown locked" is not visible. Picking `sp1` in the `bf1` deployment opens an area with only a test list.
- Form settings `Task list` name is shown, not editable. Form field options (dropdown values) are not editable.
- Password lockout is deferred (Supabase rate limits). Forced first-login password change is implemented but was not clicked through in the UI (the acceptance run flips `must_change_password` off temporarily and restores it).
- Report "Download PDF" is the browser print dialog. No headless PDF.
- No offline mode, SSO, notifications (the bell shows a count toast).
- Imports run row by row inside one request (`maxDuration` 60 s); fine for ~100 rows, would need a job queue for thousands.

## Decisions taken where the spec was open

- `task_create`, `task_edit`, `task_record_update`, `form_save` are `security definer` with an explicit role check, not `security invoker`: Postgres grants cannot say "managers only per area", and the browser role has no insert/update rights on `task_version`, `task_field_change`, `task_update` or `task` columns other than `status` and `progress`. `p_actor` is honoured only for the service role (seed).
- `task_edit` returns `null` and writes nothing when no value changed. It also writes an `edit` / `assignment` row to the updates timeline.
- Scope refusals and sign-ins are audited through `log_audit()` as the signed-in user just before sign-out, so the service key is not needed. The service key is not used by the app at all, only by `seed.ts`.
- The app bar "bell" and the "Hey Monitor" wake-word hint are out, as the spec says.

## Test data left in the live project

The acceptance run created extra data that cannot be deleted through the app (versions are immutable): task "ACCEPT-4 head pulley bearing replacement" (several copies, one per run), 10 imported tasks prefixed "TEST ", and an `sp1` list "SP1 isolation check" with one task. Reset the project (re-run migration on a fresh project or truncate) before a client demo if clean numbers are wanted.

## How to run

```bash
cd app
cp .env.example .env.local      # fill URL, publishable key, service role key (seed only), NEXT_PUBLIC_AREA_CODE=bf1
npm install
npm run dev                     # http://localhost:3000
npm run build
```

Database: apply `supabase/migrations/0001_init.sql` then `supabase/seed/seed.sql` in the Supabase SQL editor (or `npx supabase link` + `npx supabase db push`, then `npm run seed` with the service key). Seed users `sunita.m` (manager), `ravi.k` (field user), `anil.v` (manager, `bf1` + `sp1`), `meena.r` (`sp1` only); password `ChangeMe-2026!`, changed on first sign-in.
