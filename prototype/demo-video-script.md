# Task Monitor — demo video script

**Purpose:** a 2½-minute walkthrough for plant management. A manager signs in and lands on the dashboard, creates and imports tasks, manages the workforce, assigns people and edits a task without losing history. A field user records by voice and photo. Management gets a one-click PDF.
**Format:** 16:9, 1920×1080. Phone screenshots sit centred in a device frame on a gradient background (indigo to cyan, the app's own colours). Report and desktop scenes use the wide screenshots full-bleed.
**Screenshots:** `prototype/screenshots/01-login.png` … `22-desktop.png`. Phone frames are 860×1800; the report is 2560×1800 and the desktop view 2880×1800.
**Voice:** calm, confident. About 140 words per minute. Total narration ≈ 360 words ≈ 2 min 35 s.
**Music:** light, steady, low in the mix. No sound effects on taps.
**Captions:** on. Use the narration text as subtitles.
**No client identity.** No company name, logo or plant name beyond generic unit names. Keep it that way.
**Colours mean status.** Green completed, yellow in progress, red not started. Nothing else is colour-coded.

---

## Scene list

| # | Screenshot | On screen | Voice-over | Time |
|---|-----------|-----------|------------|------|
| 1 | `22-desktop.png`, then cut to `01-login.png` | Title card "Task Monitor" over the gradient. Phone slides in on the login screen. Pulse on the "Area · Blast Furnace 1" tag. | Every plant runs on lists. Shutdown jobs, inspection rounds, safety audits. Today they live in spreadsheets, and the status comes back by phone calls and messages. Task Monitor puts every list in one place, one area at a time. | 0:00–0:14 |
| 2 | `01-login.png`, then `04-manager-dashboard.png` | User ID and password filled. Tap Sign in. Cut straight to the dashboard. | Sign in with a user ID and password. One area, so there is nothing in between: the dashboard opens at once. | 0:14–0:22 |
| 3 | `02-login-other-area.png` | Login with the red refusal message. | Access is scoped per area. An account from another area is refused until an administrator grants it. Nothing leaks across. | 0:22–0:30 |
| 4 | `04-manager-dashboard.png` | Hold on the dashboard. Highlight the compliance number, then the three tiles in turn: green, yellow, red. Then the six menu tiles. | The manager's dashboard. One number, compliance for the list. Three colours only: green completed, yellow in progress, red not started. And the menu: create tasks, upload from Excel, workforce, assign, report, form settings. | 0:30–0:44 |
| 5 | `05-create-task.png` | Create task form. Pulse on the required markers and the Responsible dropdown. | Tasks can be created one at a time, with the fields the manager defined for this list. | 0:44–0:50 |
| 6 | `06-upload-tasks-excel.png` | Excel import. Slow pan down the column-to-field mapping, then the warning box, then the preview rows. | Or imported from Excel. Map each sheet column to a form field, check the preview, and import. Blank rows are skipped and untidy durations are cleaned up on the way in. A row that matches an existing task updates it as a new version. | 0:50–1:04 |
| 7 | `07-workforce.png`, then `08-workforce-upload.png` | Workforce list with load per person. Cut to the upload sheet with its mapping. | The workforce lives in the app too. Add a person, or upload the whole list from Excel. New people get a login for this area. | 1:04–1:13 |
| 8 | `09-assign-tasks.png`, then `10-assign-sheet.png` | Assign screen, unassigned tasks first. Cut to the assign sheet with people, vendor teams and their current load. | Unassigned tasks come first. Tap Assign and pick a person or a vendor team. Each one shows their current load. The section head stays as monitor. | 1:13–1:23 |
| 9 | `12-edit-task.png`, then `13-task-history.png` | Edit sheet with "Save as v2". Cut to the task with the version-2 chip, the edit entry, and the field history showing old values struck through. | Lists change. When a task is edited, nothing is overwritten. Every change is saved as a new version, and the old values stay in the history: who changed what, when, from what to what. | 1:23–1:36 |
| 10 | `14-field-dashboard.png`, then `15-section.png` | Field user's dashboard with "My tasks", then a section list with the three-colour stripes. | Now the field side. Ravi signs in and sees his own tasks. Inside a section, every task with planned hours, owner and status. | 1:36–1:45 |
| 11 | `16-task.png` | Task card. Highlight the four plan fields, the three status buttons, and the update timeline. | The task card holds the plan, the status, and every update so far, with the words spoken on site and the photos taken there. | 1:45–1:53 |
| 12 | `17-voice.png` | Voice sheet in listening state. Animate the waveform. | Ravi says: Hey Monitor. The agent wakes, listens and transcribes, in his own language. No typing with gloves on. | 1:53–2:01 |
| 13 | `18-confirm.png` | Check-and-confirm sheet. Highlight Status, Progress, Manpower, Remarks, then Confirm. | From what he said, it fills in status, progress, manpower and remarks. He checks, taps Confirm, and the transcript and audio stay attached to the task as evidence. | 2:01–2:12 |
| 14 | `19-photo.png` | Photo added to the timeline with the "Before" tag. | Photos go straight onto the task, stamped with the step, the time and who took them. | 2:12–2:18 |
| 15 | `20-generating.png` | Manager dashboard with the progress list: collecting tasks, compiling transcripts, attaching photos, rendering PDF. | Back to the manager. One click. | 2:18–2:22 |
| 16 | `21-report.png` | Wide report. Slow pan across the summary tiles and the compliance-by-section table, then page two: not started and in progress with the last remark. | The report compiles from the data entered on the floor: compliance by section, what has not started, what is in progress with the last remark, and photo evidence with a sign-off page. Nothing retyped, nothing chased by phone. | 2:22–2:35 |
| 17 | `22-desktop.png` | Title card. Tagline fades in: "Create the list. Record by voice. Keep the history. Report in one click." | Task Monitor. Create the list, record by voice, keep the history, report in one click. One area first, every area next. | 2:35–2:45 |

Optional scene for a technical audience: `03-area-picker.png` with "An account scoped to two areas chooses one at sign-in. Single-area accounts never see this screen." (6 s)

---

## Notes for the editor

- **Colours.** Gradient background: `#4f46e5` → `#7c3aed` → `#06b6d4`. Accent for highlights: `#f97316` (orange, matches the mic button). Status colours: green `#16a34a`, yellow `#f59e0b`, red `#ef4444`. Do not introduce other status colours.
- **Font.** Inter (Google Fonts). Titles 600–700 weight.
- **Motion.** Phone slides or fades between scenes. Use a soft pulse or spotlight to highlight a control, never a red arrow.
- **Sample data.** People, vendor teams and job descriptions are sample data from a generic blast furnace job list. Unit names are generic. Do not add any company name or logo.
- **What the prototype cannot show.** Real microphone capture, real Excel parsing and the PDF download are simulated. Show the report pages, not a file being saved. Do not mention offline working; the product requires connectivity.

---

## Narration only (for the voice artist)

Every plant runs on lists. Shutdown jobs, inspection rounds, safety audits. Today they live in spreadsheets, and the status comes back by phone calls and messages. Task Monitor puts every list in one place, one area at a time.

Sign in with a user ID and password. One area, so there is nothing in between: the dashboard opens at once.

Access is scoped per area. An account from another area is refused until an administrator grants it. Nothing leaks across.

The manager's dashboard. One number, compliance for the list. Three colours only: green completed, yellow in progress, red not started. And the menu: create tasks, upload from Excel, workforce, assign, report, form settings.

Tasks can be created one at a time, with the fields the manager defined for this list.

Or imported from Excel. Map each sheet column to a form field, check the preview, and import. Blank rows are skipped and untidy durations are cleaned up on the way in. A row that matches an existing task updates it as a new version.

The workforce lives in the app too. Add a person, or upload the whole list from Excel. New people get a login for this area.

Unassigned tasks come first. Tap Assign and pick a person or a vendor team. Each one shows their current load. The section head stays as monitor.

Lists change. When a task is edited, nothing is overwritten. Every change is saved as a new version, and the old values stay in the history: who changed what, when, from what to what.

Now the field side. Ravi signs in and sees his own tasks. Inside a section, every task with planned hours, owner and status.

The task card holds the plan, the status, and every update so far, with the words spoken on site and the photos taken there.

Ravi says: Hey Monitor. The agent wakes, listens and transcribes, in his own language. No typing with gloves on.

From what he said, it fills in status, progress, manpower and remarks. He checks, taps Confirm, and the transcript and audio stay attached to the task as evidence.

Photos go straight onto the task, stamped with the step, the time and who took them.

Back to the manager. One click.

The report compiles from the data entered on the floor: compliance by section, what has not started, what is in progress with the last remark, and photo evidence with a sign-off page. Nothing retyped, nothing chased by phone.

Task Monitor. Create the list, record by voice, keep the history, report in one click. One area first, every area next.
