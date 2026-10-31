# Task Monitor — Questions to settle with the client

One page for the next call. Each question says why it matters and what happens if there is no answer yet. Record the answers in this file and commit.

| # | Question | Why it matters | If undecided, we assume |
|---|----------|----------------|-------------------------|
| 1 | **May audio and transcripts leave the plant network** for cloud speech-to-text and language services? | Decides the voice stack. Cloud services are faster to set up and cheaper to run; on-premise needs a GPU server and more effort. This is the single biggest cost and timeline driver. | Cloud services, with an on-premise option priced separately |
| 2 | **Which languages must voice recognise** in the pilot? Hindi, English, Kannada, mixed speech, any other? | Sets the speech engine configuration and the test set we record on site before the pilot. | Hindi and English, mixed speech allowed |
| 3 | **Who may create and change forms**: area administrators only, or every manager? | Sets roles and permissions in Release 1. Wrong answer later means re-training. | Managers and administrators both can |
| 4 | **How long must photos and audio be kept?** | Sets storage sizing and the retention rule. Audio is bigger than photos. | Life of the task list plus seven years |
| 5 | **Is there an employee list to import**, and does it have a unique employee ID? | Decides whether workforce import can match people reliably or needs a manual resolution step. | Name matching with a manual fix screen |
| 6 | **When is the next planned shutdown** for the first area? | Fixes the pilot date and therefore the whole plan backwards from it. | Pilot in week 13 of the plan |
| 7 | **Which phones does the field team carry** today (make, Android version), and can we have three for testing? | Voice and camera behaviour differ by device. We test on the real ones in Release 2. | Mid-range Android, version 12 or later |
| 8 | **Will the system run inside the plant network** on the client's servers, or may it be hosted? | Decides the deployment shape, who provides servers and TLS certificates, and who holds backups. | Customer-hosted on two VMs inside the plant |
| 9 | **Is the Dec-2025 job list the real first task list**, and will someone own cleaning it before import? | Blank rows, free-text durations and merged cells are handled, but an owner on the client side speeds up the first import. | We clean during import and report what was skipped |
| 10 | **Who signs off the end-of-list report**, and in what order? | Sets the sign-off block on the PDF and any approval step before it is shared. | Shutdown coordinator, area head, plant management |

## Already agreed (do not reopen)

- Area is the login scope. One area first. Cross-area access only when an administrator grants it.
- User ID and password now; single sign-on later.
- Login opens the dashboard directly. No screen in between for single-area users.
- Three statuses and colours: completed green, in progress yellow, not started red. No blocked status.
- Managers create tasks, import tasks and workforce from Excel, and assign people in the app.
- Every edit keeps the old field values as history.
- Voice to text with a confirm step is in the first release.
- No offline mode is promised.
- No client name or logo in demos, screenshots or videos.

## Answers

Received 31 October 2026 via WhatsApp. Questions 7, 9 and 10 were not in the message sent and remain open.

| # | Answer | Consequence for the build |
|---|--------|---------------------------|
| 1 | Cloud speech service is acceptable for now; may be revisited with the client after finalisation. | Voice uses cloud speech-to-text and hosted extraction. On-premise stack stays a priced option. |
| 2 | English preferred; end users choose their own language; mixed speech expected. | Per-user language setting in the profile (default `en-IN`), language switch in the voice sheet, engine configured for mixed Hindi/English. |
| 3 | Anyone can create or change the task form, for now. | Form settings open to all signed-in roles in the first version; a role restriction stays one flag away. |
| 4 | At least 3 months. | Retention default 90 days minimum, configurable per area; nothing deleted automatically in the first version. |
| 5 | No employee list to import; we upload the workforce ourselves. | Workforce Excel upload and Add person are required in the first version (already in scope). |
| 6 | For the demo we host everything ourselves, in the cloud; production hosting to be discussed after finalisation. | Supabase (iamnuniraa org) + Vercel for the demo. Customer-hosted shape remains documented. |
| 7 | Open | Test on mid-range Android, version 12 or later |
| 8 | See 6 | |
| 9 | Open | We clean during import and report what was skipped |
| 10 | Open | Shutdown coordinator, area head, plant management |
