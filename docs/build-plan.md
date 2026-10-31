# Task Monitor — Build plan

Status: proposed, 31 October 2026. Durations are estimates for planning, not commitments; they assume the team below, client decisions on the open questions within the first two weeks, and access to a test device set and the plant network for the pilot.

## Goal

A first area live on the client's next planned shutdown, with managers running the task list in Task Monitor instead of the spreadsheet and the field team recording by voice and photo. Voice to text is in the first release, not a later one.

## Team

| Role | Allocation | Notes |
|------|-----------|-------|
| Delivery lead / business analyst | 0.5 | Client contact, scope, acceptance |
| Backend engineer | 1 | API, database, imports, reports, voice service |
| Mobile engineer | 1 | Flutter app, audio and camera, wake word |
| Web engineer | 1 | Manager console, dashboard, report templates |
| QA engineer | 0.5 | Test plan, device testing, voice test set |
| DevOps | 0.25 | Environments, CI, customer deployment |

## Releases

### Release 0 — Discovery and foundations (weeks 1–2)

Deliverables
- Answers to the open questions in `architecture.md` §13, recorded in this repository.
- Field inventory of the first task list agreed with the client (the shutdown form).
- Workforce list for the area obtained, with employee IDs where they exist.
- Test devices identified (the phones the field team actually carries).
- Repository structure, CI pipeline, dev environment, database with RLS, authentication skeleton.
- Design tokens and component library carried over from the prototype.

Exit: client confirms vocabulary (Area, Section, Task), the three statuses and the first form.

### Release 1 — Manager core (weeks 3–6)

Scope
- Login with user ID and password; area scoping and refusal; forced password change; lockout.
- Dashboard: compliance by section, three colour tiles, section list.
- Form settings: field types, required flags, photo rules, versioning.
- Create task; edit task with versioning and field history; task detail with history panel.
- Excel import of tasks with column mapping, preview, skip report, update-as-new-version.
- Workforce: list, add person, Excel import, login creation.
- Assignment: unassigned first, assign and reassign with history, load per person.
- Web manager console for all of the above; mobile app shows the same dashboard, sections and task detail read-only.

Exit: the client's December sheet imports cleanly end to end; a manager edits a task and sees the history; an unauthorised account is refused.

### Release 2 — Field recording with voice (weeks 6–10)

Scope
- Mobile: status and progress controls, photo capture with stamping, upload to object storage, thumbnails.
- Voice: record, transcribe, extract, confirm, store with audio; wake word on device; voice navigation to a task.
- Custom vocabulary built from the task list's sections and equipment tags.
- Voice test set: 200 utterances recorded on site in the pilot languages; word error rate and extraction accuracy measured against the targets in `architecture.md` §6.3.
- Notifications: assignment, status change on monitored tasks.
- Connectivity handling: clear "no signal" state; no silent queuing.

Exit: a field user records ten real updates by voice on the shop floor with the acceptance targets met.

### Release 3 — Reporting and pilot readiness (weeks 10–12)

Scope
- PDF report: summary, compliance by section, not started and in progress with last remark, photo evidence, sign-off block. Excel export in the client's layout.
- Live dashboard refinements from Release 1 feedback.
- Audit log views for administrators.
- Customer environment: install on the plant network, TLS, backups, monitoring, device distribution.
- User guides: one page for field users, four pages for managers. Training session per role.

Exit: user acceptance testing signed off on staging; production installed and smoke-tested.

### Pilot — the next shutdown (date set by the client)

- Task Monitor runs the task list in parallel with the spreadsheet for the first day, then alone.
- Daily check-in with the shutdown coordinator; defects fixed same day where possible.
- Success measure: management pulls the end-of-shutdown report from Task Monitor; the spreadsheet is not needed.

### Release 4 — Second area and hardening (after the pilot)

- Enable a second area by configuration; a two-area supervisor account exercises the area picker and cross-area scoping.
- Fixes and improvements from the pilot.
- Candidates, each only if asked: single sign-on, maintenance system integration, iOS, multi-area reporting.

## Timeline

| Weeks | Release | Milestone |
|-------|---------|-----------|
| 1–2 | 0 | Foundations ready, questions answered |
| 3–6 | 1 | Manager core on staging |
| 6–10 | 2 | Voice recording accepted on site |
| 10–12 | 3 | Production installed, UAT signed |
| Client's date | Pilot | First shutdown run in Task Monitor |
| +4 weeks | 4 | Second area enabled |

About twelve weeks to production readiness, then the pilot on the client's shutdown date.

## Definition of done per feature

- Unit tests for domain rules (versioning, status transitions, import parsing, scope refusal).
- API tests that prove cross-area access is refused at the database layer, not only by the API.
- Accessible, bright UI matching the prototype; works on the client's test devices.
- Logged, monitored, documented in the user guide where user-facing.

## Risks and how they are handled

| Risk | Handling |
|------|----------|
| Shop-floor noise defeats speech recognition | Noise suppression on device, custom vocabulary, confirm step always; measured test set before pilot; typing remains available |
| Audio must not leave the network | Voice service behind one interface; self-hosted speech and extraction engines are a deployment choice, costed separately (GPU server) |
| Dirty spreadsheet data | Import preview, skip report, raw input kept; manual fix in app with history |
| Workforce list has no unique IDs | Name matching with manual resolution screen during import |
| Devices and connectivity on the floor | Test on the client's phones and Wi-Fi in Release 2; explicit no-signal state |
| Scope creep before the pilot | Releases above are the scope; anything else goes to Release 4 |

## Commercial shape (for discussion)

- Fixed-price build for Releases 0–3 and pilot support.
- Per-area subscription after go-live covering hosting support, updates and the voice service usage.
- Optional packages: self-hosted voice stack, SSO, maintenance system integration.
