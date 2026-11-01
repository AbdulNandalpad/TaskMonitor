# Change request 2 — client feedback of 1 November 2026 (second batch)

Builds on `2026-11-01-client-requests.md` (CR-1 to CR-5). Same conventions: rule, where enforced, how to prove.

## CR-6 Names and labels are editable in the app

Rule: a manager or area admin can rename what the client sees, without a developer. Every rename is recorded, nothing is overwritten silently.

What becomes editable, and where
| Element | Who | Where | Record |
|---------|-----|-------|--------|
| Task list name (the "main task", e.g. "Blast Furnace 1 shutdown"), its start/end dates and planned hours | manager, area admin | dashboard: tap the list title → sheet | `audit_log` row `task_list_renamed` with old and new values |
| Section names and their head person | manager, area admin | section screen: Edit in the app bar → sheet; also from Form settings → Sections | `audit_log` row `section_renamed` |
| Task fields (description, hours, manpower, vendor, responsible, section) | manager, area admin | already in place (edit sheet, versioned) | `task_version` + `task_field_change` (unchanged) |
| Workforce person name, role, phone, team size | manager, area admin | workforce list: tap a person → sheet | `audit_log` row `person_edited` |
| Form field labels and required flags | per client answer 3: any signed-in role | Form settings (already in place) | new `form_version` (unchanged) |
| Area name | area admin only | dashboard header: long-press / Edit | `audit_log` row `area_renamed` |

Not editable: task sequence numbers, timestamps, who did what, status history, anything in the history panels.

Changes
- Database: `task_list`, `section`, `person`, `area` get update policies for `{area_admin,manager}` (area: `{area_admin}` only) on the listed columns only (column-level grants as for `task`). A trigger on each writes the `audit_log` row with `detail = {"field": ..., "old": ..., "new": ...}` per changed column. One idempotent migration `0004_editable_names.sql`.
- Screens: small edit sheets as listed; the dashboard title and section title get a pencil icon for the roles that may edit. Renaming a section updates every task's displayed section at once (it is a reference, not a copy).
- Report and dashboard read live names, so a rename shows everywhere immediately.

Prove: rename the task list, a section, a person and the area; each shows the new name on dashboard, section, task and report, and `audit_log` has one row per change with old and new. A field user sees no pencil icons and a direct update is refused.

## CR-7 Detailed report with timeline, AI work summary and photo evidence

Rule: a second report type, "Detailed report", alongside the existing summary. One block per task, grouped by section in section order, with: section name, work description, start time, end time, duration, status and progress, an AI-written summary of what the evidence says happened, and the photos.

Definitions
- Start time: the `at` of the first `task_update` whose `status_after` is `in_progress` (or the first update that moved progress above 0). Empty if the task never started.
- End time: the `at` of the first update whose `status_after` is `completed`. Empty if not completed.
- Duration: end minus start, shown as hours and minutes; compared with planned hours.
- Evidence: all updates of the task in order (status, progress, remarks typed or spoken, corrected text where edited, photo entries with their labels) plus the task's plan fields.
- AI summary: 2–4 sentences in plain English, past tense, written from the evidence only; names of people and equipment as recorded; must not invent facts not present in the evidence; says explicitly when there is no evidence beyond a status change. Uses the same hosted model as voice extraction. Each summary is stored once in `task_summary (task_id, generated_at, evidence_hash, text, model)` and regenerated only when the evidence hash changes, so the report is fast and repeatable.
- Photo evidence: every photo attachment of the task as a thumbnail with label, time and who took it; tapping opens the full image. If the task has the "photo on completion" rule and no photo exists, the block says "No completion photo".

Changes
- New route `/report/[listId]/detailed`, print-styled like the summary report. Page order: cover with list name, dates, overall counts; then sections in order, each with its tasks; then a sign-off page. Manager and area admin only.
- "Generate" button on the dashboard gets two choices: Summary report, Detailed report. Generating the detailed report first fills missing summaries (queue or sequential, with a progress indicator), then renders.
- Server route `api/report/[listId]/summaries` that computes evidence per task, hashes it, calls the model for tasks whose hash changed, stores results. Rate-limit to a few concurrent calls; keep prompts and outputs out of logs.
- Excel export of the same table (one row per task: section, description, start, end, duration, planned hours, status, progress, summary, photo count).
- Migration `0005_task_summary.sql` for the table with RLS select for members and writes by the service role / the route.

Prove: generate the detailed report for the seeded list; every started task shows a start time, every completed task an end time and duration; the GB 05A belt task shows its remarks reflected in a summary; photos appear under the tasks that have them; a task with a completion-photo rule and no photo says so; generating twice makes no new model calls (hash unchanged).

## Not in this change

Editing timestamps or history; deleting sections or people (deactivate only, later); summaries in languages other than English.
