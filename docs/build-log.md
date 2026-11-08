# Task Monitor — Build log

Status of the first working version against `docs/build-spec.md`. Last updated 1 Nov 2026.

## Done

- **Scaffold**: Next.js 15 (App Router, `src/`), TypeScript, plain CSS. The tokens and component styles of the prototype are in `app/src/app/globals.css`. `app/.env.example` has the four variables from the spec.
- **Database** (`supabase/migrations/0001_init.sql`): all section 4 tables, enums, RLS with `is_member` / `has_role`, `task_create`, `task_edit`, `task_record_update`, `form_save`, `log_audit`, `public_area_name`, the `task_current` view and the private `attachments` bucket with policies. Idempotent; run twice in a local test and on the live project.
- **Seed**: `supabase/seed/seed-data.json` (from the prototype arrays), `seed.ts` (service key, `npm run seed`) and `seed.sql` (pure SQL for the dashboard SQL editor, incl. the four auth users). Both give 12 people, 10 sections, 99 tasks, 4 users.
- **Screens**: login + scope refusal, forced password change (`/password`), area picker, dashboard, sections, task detail (status, progress, photo, updates timeline, field history old → new), edit sheet, create task, assign, workforce (add + Excel upload), import tasks (column mapping), form settings, print-styled report (3 pages), voice sheet.
- **Voice**: `SpeechRecognition` + `MediaRecorder`, language chips (en-IN / hi-IN / kn-IN), rules `extract()` with per-field confidence, mandatory confirm step, audio uploaded to Storage and linked to the update. Typed fallback when the mic or `SpeechRecognition` is unavailable. Said on a dashboard or section screen, it finds the task by name and opens it.
- `npm run build` passes.

## UI pass (1 Nov 2026)

- **Logo**: `app/src/components/Logo.tsx` (`LogoMark`, `Logo` with wordmark; `color` and `white` tones) and `app/src/app/icon.svg` (favicon). Mark: a rounded tile on the indigo → violet → cyan gradient with a white "pulse that settles into a check" line and an orange live-dot. No client name anywhere.
- **Sign-in / password** (`AuthShell`): brand panel on the gradient + form card. Side by side on a desktop, stacked on a phone (card at the bottom). The area is shown once, as an eyebrow label over "Sign in". Fixed the area tag whose dot broke onto its own line.
- **Desktop shell** (`Screen` + `AppNav`): persistent top bar (logo, Dashboard / Create task / Upload tasks / Workforce / Assign tasks / PDF report / Form settings for managers, Dashboard only for field users, user chip, sign out), page header, centred column (928px, 1248px for `wide` screens). Dashboard is a two-column grid (hero + tiles + sections | menu or My tasks); task detail is two columns (task + status + photo | updates + history). Bottom sheets become centred dialogs at ≥ 960px.
- **Dashboard, second pass (calm layout)**: one white summary card (big % number, stacked bar, the three counts inline in their status colours) replaces the gradient hero plus three tiles. Sections are the main content: a 2-column card grid on desktop, rows on a phone, each with the bar and the "Behind" flag. Managers: the Menu grid shows only on a phone (where the top bar is hidden); on desktop the top bar is the single place for actions — Dashboard · Workforce · Assign tasks · PDF report, one primary "Create task" button, and Upload tasks (Excel) + Form settings under "More". The desktop right column is a "Needs attention" card (N unassigned → Assign, sections that are Behind → section); for field users it is the My tasks card. The person's name/role appears once on desktop (user chip) and once on a phone (app bar). The mic FAB is 50px without the pulse ring on desktop. The Workforce "Assign tasks" button is phone-only (desktop has it in the bar).
- **Dashboard, third pass (enterprise restraint) and `/tasks`**: neutral near-white canvas, 1px borders instead of shadows, 8px spacing, tabular numerals, smaller type. The summary card carries the compliance figure and a slim stacked bar; under it four navigable KPI tiles (All tasks, Completed, In progress, Not started) link to the new read-only list `/tasks?status=…` (hover ring, focus outline, pressed state). Sections are an aligned table on desktop (section, tasks, done, not started, progress bar, %, "Behind") and rows on a phone. New `/tasks` page (`TaskListClient`): status chips, search on work description, section and responsible filters, all in the query string (`status`, `section`, `assignee`, `q`); a data table on desktop (#, task, section, responsible, planned h, status, progress), task rows grouped by section on a phone; every row opens `/tasks/[id]`. "Tasks" is in the top bar for both roles; "My tasks" links to `/tasks?assignee=<me>`. Avatars and menu icons use one neutral tint (`HUES` is now a single neutral value); the mic FAB is flat indigo; status colours unchanged.
- **Phone menu (burger)**: `components/MobileMenu.tsx`, rendered by `Screen` at the right end of the phone app bar on every signed-in screen (44px, `aria-label="Menu"`, `aria-expanded`). Opens a slide-in panel from the right with a scrim: user name and role once at the top, the links from `lib/nav.ts` (`navLinks().phone`: Dashboard, Tasks, and for managers Create task, Upload tasks (Excel), Workforce, Assign tasks · N unassigned, PDF report, Form settings) with the active page highlighted, Sign out at the bottom. Closes on scrim tap, Escape and navigation; focus is trapped and returned to the burger; body scroll is locked; `100dvh` and safe-area insets. Hidden at ≥ 960px, where `AppNav` renders the same definition (`primary` / `create` / `more`). The dashboard Menu grid and the app-bar sign-out icon are gone.
- **Phone** (≤ 959px): per-screen app bar as before; 44px tap targets (extended hit areas on pill filters), 16px inputs so iOS does not zoom, `100dvh`, `viewport-fit=cover` with `env(safe-area-inset-*)` on the app bar, body, sheets, FAB and toast; the report page fits the viewport with its tables scrolling inside `.tbl`. Verified at 320, 360, 375, 390, 414, 430, 768 and 812×375 (no horizontal scroll on any screen). Screenshots in `docs/ui/`.

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

## Hosting

The single source repository is `iammuniraa-wq/task-monitor` (GitHub). Vercel project `task-monitor` (team veveycrm) deploys `main` from it: Framework Preset Next.js, Root Directory `app`, env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_AREA_CODE=bf1`. Earlier the preset was "Other", which built nothing and returned 404 on Visit.

## AI voice (starting point for AI features)

Code lives in `app/src/lib/ai/` (config, `anthropic.ts`, `openai.ts`, `voice.ts`); new AI capabilities go next to `voice.ts` and reuse the two clients.

- **Transcription:** the recorded audio is posted to `/api/voice/transcribe`, which calls OpenAI `gpt-4o-transcribe` with a plant glossary prompt (tuyere, stave, BLT, SGP, TRT, ...) and the language chip as a hint. If the route is unavailable the browser transcript is used.
- **Extraction:** `/api/voice/extract` sends the transcript and the task context to Claude (`claude-sonnet-5-5`, forced tool call, structured JSON with per-field confidence). If it is unavailable the local rules reader (`lib/voice/extract.ts`) is used.
- The confirm step is unchanged and mandatory. The transcript is editable there, with a "Read again" button. The engines used are stored in `task_update.extracted.engines`.
- **Server-only env vars:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (optional `ANTHROPIC_MODEL`, `OPENAI_TRANSCRIBE_MODEL`). Set them in `app/.env.local` and in the Vercel project, never as `NEXT_PUBLIC_`. Without them everything still works with the browser transcript and rules.
- **Data flow to note for IT/privacy review:** audio goes to OpenAI (US), the transcript and task title go to Anthropic. Nothing else leaves the system. Kannada accuracy of `gpt-4o-transcribe` is the weakest of the three languages: test with real recordings.
- Offline check without keys: `npx tsx scripts/ai-mock-test.ts`.

## Change requests of 1 Nov 2026 (CR-1 to CR-5)

Spec: `docs/changes/2026-11-01-client-requests.md`. Migrations `0002_forward_only_status.sql` (CR-3) and `0003_remark_corrections.sql` (CR-5) are applied on the live project.

- **CR-1 no audio stored:** the voice sheet releases the clip after transcription; no Storage upload, no `attachment` row of kind audio. Copy: "The transcript is kept with this update as the record." Old audio objects stay; nothing reads new ones.
- **CR-2 English transcripts and remarks:** transcription runs in the spoken language (best accuracy), then Claude returns `transcript_en` and English `remarks` (`lib/ai/voice.ts`). The confirm sheet shows the English text with a "Spoken in X" line; `extracted.original_transcript` and `extracted.language` keep the original. Without the AI keys the browser transcript is used and a notice says the English translation needs the voice service. Regression: `scripts/ai-live-test.ts` (needs both keys).
- **CR-3 forward-only status:** enforced in `task_record_update` (409 from the API). The task screen disables earlier status buttons ("Cannot go back"), locks status and progress once completed, and the slider starts at the current progress. The voice sheet keeps the current status and says so; the Excel import skips backward statuses (counted in the import report).
- **CR-4 typed remarks:** "Add remark" sheet on the task screen (tile next to Add photo; button in the top bar on desktop), saved as a `note` through `task_record_update`.
- **CR-5 corrections:** `task_update_correct()`; Edit action on notes and voice entries the user may correct (author or manager), "edited" chip that reveals the original; the report shows corrected text and lists corrected remarks in an appendix.
- **Acceptance:** `npx tsx scripts/acceptance-changes.ts` (runs as ravi.k and anil.v). Not runnable: live Hindi/Kannada AI test (no keys on this machine), viewer and second-field-user refusals (no such seed users; covered by the local database test).

## Change requests, second batch (CR-6 and CR-7)

Spec: `docs/changes/2026-11-01-client-requests-2.md`. Migrations `0004_editable_names.sql` and `0005_task_summary.sql` are applied on the live project.

- **CR-6 editable names:** small edit sheets for the task list (name, dates, planned hours; pencil on the dashboard), sections (name, head; pencil in the section app bar and a Sections card in Form settings), people (tap a person on Workforce) and the area (area admins only; pencil in the dashboard header). One route, `/api/edit/[kind]/[id]`, with allow-listed columns; the database enforces the same with column-level grants, role policies and an audit trigger that writes one `audit_log` row per changed column (`task_list_renamed`, `section_renamed`, `person_edited`, `area_renamed`; detail `{field, old, new}`). Delete rights on those tables are removed.
- **CR-7 detailed report:** `/report/[listId]/detailed` (print-styled: overview, one page per section with a block per task, sign-off) with start (first update that moved the task forward), end (first update to completed), duration vs planned, status, an AI work summary and every photo as a thumbnail; "No completion photo" when the rule applies and none exists. Excel export at `/api/report/[listId]/export`. The dashboard has a Reports card with a Generate button offering Summary report or Detailed report; the detailed choice first fills the missing summaries a few tasks at a time with a progress bar.
- **Summaries:** `lib/report/summaries.ts` hashes each task's evidence (plan fields, ordered updates with corrected text, photo records) and calls the model only when the hash changed; results are stored through `task_summary_save()` in `task_summary` (migration 0005). A second generation with unchanged evidence makes zero model calls. Prompts and outputs are not logged. Without `ANTHROPIC_API_KEY` the route answers 503 and the report shows tasks without a summary.
- **Acceptance:** `npx tsx scripts/acceptance-changes2.ts` (18 checks, model stubbed). Not run live: area admin renaming the area (no area admin is seeded; covered by the local database test of 0004) and real AI summaries (no key on this machine).

## Change requests, third batch (CR-8 and CR-9)

Spec: `docs/changes/2026-11-01-client-requests-3.md`. Migration `0006_area_rename_managers.sql` is applied on the live project.

- **CR-8:** the area heading on the dashboard has a pencil for managers and area admins (`titleAction` on `Screen`). The `area_update` policy now allows `{area_admin,manager}`; the column grant is still `update (name)`, so the area code (bf1) cannot be edited. Each rename writes one `area_renamed` audit row. The sign-in label and the report header read the live name.
- **CR-9:** `/tasks` is grouped by section in section order. Each header shows the section name, head, "done of total" and a mini bar; headers collapse (default expanded, remembered per user in `localStorage`), filters apply before grouping and empty groups are hidden, the repeated Section column is gone, and phone headers are sticky below the app bar. Checked in the browser: collapsing a group removed its rows, the state survived a reload, no horizontal scroll at 375 px.
- **Acceptance:** `scripts/acceptance-changes2.ts` is now 24 checks (the CR-6 manager-403 check became the CR-8 success check, plus five CR-9 checks).
- **Dev note:** if a dev server shows a 404 for `_next/static/chunks/app/(app)/layout.js`, its `.next` cache is stale; start a clean one with `NEXT_DIST_DIR=.next-dev3 npx next dev -p 3100`.

## English-only remarks, for every way of entering one

Client request: whatever language a person records or types in (Kannada, Hindi, Hinglish), the remark shown and reported is English, so reports are consistent.

- Voice (already, CR-2): English transcript and English remarks from the extraction step; original kept in `extracted.original_transcript` with `extracted.language`.
- **New:** typed remarks (Add remark), corrections (Edit on an entry) and any Hindi or Kannada typed into the voice confirm fields are translated to English on save by `lib/ai/translate.ts` (`ensureEnglish`, Claude, forced tool call, equipment names and tag numbers kept as written). The English text is saved as the entry text; the original is kept in `extracted.original_text` with `extracted.language`. The timeline shows "Written in Kannada · original: ..." under the English text.
- Typed remarks always go through the model (Hinglish in Latin letters cannot be spotted by script); voice text only when non-Latin letters remain. If the AI key is missing or the model fails, the remark is saved as written, flagged `extracted.translation_pending`, the timeline says "English translation pending: saved as written" and the toast says the translation needs the voice service. Nothing is lost.
- A correction keeps the corrected text in English; the first original of the entry stays in `text_original` (the Kannada wording of the correction itself is not kept).
- Not done: translating old entries recorded before this change (a backfill would need a small database function to write the English text; none of the current live data is non-English). Excel-imported remarks are not translated.
- Tests: `scripts/translate-mock-test.ts` (mocked model) and three new checks in `scripts/acceptance-changes.ts` (20 of 20 pass; without a key on this machine they prove the save-as-written and pending path; the translated path needs the key on the server).

## Fix: AI extraction and translation failed on the live site (found by a phone test)

Symptom: on a phone the Kannada transcript stayed Kannada and the sheet said "Saved as spoken; English translation needs the voice service" even though both keys were set in Vercel (Production).

Cause: every Claude call returned HTTP 400 `invalid_request_error: tool_choice: type "tool" and "any" are not supported for this model`. Claude Sonnet 5.5 rejects a forced tool choice, and `lib/ai/anthropic.ts` forced one. The routes caught the error and the sheet fell back to the browser transcript and the rules reader, so nothing visibly broke and the real reason was hidden.

Fix (`a9ad63a`): `tool_choice` is automatic and the system prompt says to answer by calling the named tool once. The routes now return the failure reason (`detail`: status, error type, a short message; never a key) and the confirm sheet shows it after "Saved as spoken", so a configuration problem is visible at once.

Verified live on `task-monitor-navy.vercel.app` as ravi.k: `/api/voice/extract` for Kannada, Hindi and English text returns English transcript, English remarks, status, progress, manpower and the language; a typed Kannada remark is saved in English with the original in `extracted.original_text`; `/api/voice/transcribe` with a generated English clip returns the text from `gpt-4o-transcribe` in about 1.6 s. Not tested live: Kannada or Hindi audio through the transcriber (no Kannada voice available to generate a test clip) and the report summaries.

## Fixes from the browser test run (4 Nov 2026)
Test report: `docs/test-execution/Task_Monitor_Test_Execution_Report.docx` (20 cases run in Chrome on the live site).
- Detailed report (TC_019): each task block now lists its remarks, English first with the original Kannada/Hindi wording underneath; the Excel export has a Remarks column. Previously remarks appeared only through the AI summary.
- Detailed report overview: planned hours is the sum of the tasks (was a stale list value, 72 against 767 on the dashboard); dates fall back to the first start and last end when the list has none.
- AI summaries skip tasks with no updates (nothing to summarise); those blocks say "No updates recorded yet." and the overview counts only tasks with updates.
- Voice sheet: a recording with no typed or browser transcript and no sound at the microphone is not sent to the speech service (it invented "Spelling?" from silence); the sheet asks the user to speak again.
- Not changed: no date-range filter on reports (TC_020, new feature); old non-English remarks stay as entered until edited (Edit on the entry translates them).

## Platform layer: one login, several apps (8 Nov 2026)
Direction agreed with the owner: Task Monitor becomes one app of several behind one login; Furnace Analysis is app #2 (vendor PDF report uploaded by JSW staff, email notifications through Resend to a configurable recipients table; design starts when the sample report is shared).
- `supabase/migrations/0007_platform_apps.sql` (apply in the SQL editor): `app`, `app_access` (default deny), `platform_admin`, functions `has_app`, `my_apps`, `app_access_set`, `platform_users`, `is_platform_admin`. `is_member` and `has_role` now also require the Task Monitor app, so removing a user's Task Monitor access closes every Task Monitor table at the database. Everyone with a membership is backfilled with Task Monitor. Furnace Analysis is registered but switched off (`enabled = false`) until it exists.
- App: `/launch` (sign-in landing: no app signs out with a message, one app goes straight in, several show the chooser), `/apps` (chooser, "All apps" link appears in the nav only for multi-app users), `/furnace` (guarded placeholder), `/admin/access` + `POST /api/admin/access` (platform admins grant or revoke per user and app). Task Monitor keeps its addresses.
- Safe to deploy before the migration: `myApps` falls back to "Task Monitor only" while `my_apps()` does not exist.
- Platform admin is set in SQL: `insert into platform_admin select id from profiles where login = '<login>';`
- Tests: pglite 18/18 (migration twice, grants, revoke closes data, refusals); `app/scripts/acceptance-platform.ts` runs against the live project once 0007 is applied.
