# Change request 1 — client feedback of 1 November 2026

Source: tester and client contact, three points. Each item below is the rule, where it is enforced, and how to prove it.

## CR-1 Audio recording is not stored

Rule: the app no longer keeps audio. The recorded clip is sent to the transcription service, used once, and discarded. Nothing of kind `audio` is written to Storage or to `attachment`.

Changes
- Voice sheet: after transcription the audio blob is released; no upload to the `attachments` bucket; no `attachment` row of kind `audio`.
- Server route for transcription: accept the clip in memory only; never write it to disk or Storage; do not log it.
- `task_update` keeps `text` (English transcript), `extracted` and `confirmed`. Add `extracted.original_transcript` and `extracted.language` (see CR-2).
- Copy: "Transcript and audio are kept with this update as evidence" becomes "The transcript is kept with this update as the record."
- Build log and architecture §7 note the change; the `attachment_kind` enum keeps `audio` for compatibility but nothing writes it.
- Existing audio objects in Storage from the acceptance run may stay; nothing reads them.

Prove: record a voice update; `attachment` has no new rows; Storage shows no new object; the update shows the English transcript.

## CR-2 Every transcript and remark is saved in English

Rule: the user may speak English, Hindi, Hinglish or Kannada. The transcript shown in the confirm sheet and the remark saved on the task are English. The original-language text is kept in `extracted.original_transcript` with `extracted.language`.

Changes
- Transcription: for any language other than English, produce an English transcript. Use the transcription service's translate-to-English mode where it exists; otherwise have the extraction step return `transcript_en` alongside the fields. Keep the original transcript as well.
- Extraction prompt: always return `remarks` in plain English, even when the input is Hindi or Kannada. Names of equipment and sections stay as spoken (GB 05A, tuyere).
- Confirm sheet: shows the English transcript as the main text, with a small "Spoken in Kannada" line under it when the language differs. The remarks field is pre-filled in English.
- Browser-only fallback (no server key): the browser transcript is in the spoken language; show a notice "Saved as spoken; English translation needs the voice service" rather than silently saving Kannada.
- `app/scripts/ai-live-test.ts` becomes the regression test for this: each case must produce an English `remarks` and the expected status/progress/manpower.

Prove: the Kannada case in `ai-live-test.ts` prints an English transcript and English remarks; a manual Kannada recording on a phone shows English in the confirm sheet.

## CR-3 Status moves forward only

Rule: `not_started` → `in_progress` → `completed`, never backwards. `completed` is final. Progress cannot be set to 0 once the task is in progress (0 would mean not started) and cannot be set below the current value.

Changes
- Database: in `task_record_update`, rank the statuses 0/1/2 and raise `'status cannot go back'` (errcode `22023`) when the requested status ranks lower than the current one, or when the task is `completed` and any status/progress change is requested. Reject a progress value below the current progress with `'progress cannot go down'`. The function is the only write path, so the API and the voice path inherit the rule.
- Task screen: status buttons for earlier states are disabled with a tooltip "Cannot go back"; on a completed task the status row and slider are read-only. Slider minimum is the current progress once in progress; 100 completes.
- Voice confirm sheet: if the extracted status ranks lower than the current status, keep the current status, show "Status stays In progress; it cannot go back" under the field, and still save the remark.
- Manager edit sheet does not touch status (unchanged).
- Migration: new file `supabase/migrations/0002_forward_only_status.sql` with `create or replace function task_record_update(...)`; idempotent; paste-able in the SQL editor. The parent session applies it on the live project.

Prove: acceptance additions — (a) set in progress then try not started → 4xx and unchanged; (b) complete then try in progress → 4xx; (c) progress 60 then 40 → rejected; (d) UI buttons disabled as described.

## Not in this change

Reopening a completed task by a manager (would need a new, audited action), progress edits by managers after completion, deleting old audio objects.
