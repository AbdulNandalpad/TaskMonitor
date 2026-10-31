# Task Monitor

A task tracking platform for plant operations. Managers create task lists (a shutdown job list, an inspection round, a safety audit), import tasks and workforce from Excel, and assign people. The field team records progress by voice and photo. Management gets a one-click PDF report compiled from what was entered on the floor.

Built area by area. One area (for example Blast Furnace 1) goes live first with a simple login that opens straight onto the dashboard. The data model and access control are multi-tenant from day one, so more areas are added by configuration, not by rebuilding.

## What is in this repository

| Path | What it is |
|------|------------|
| `docs/architecture.md` | Finalised system design: tenancy, access control, services, voice pipeline, photos, reports, deployment, security |
| `docs/data-model.md` | Database schema with task field history and form versioning |
| `docs/build-plan.md` | Phased build plan to the first live shutdown, with scope per release, team, estimates, acceptance criteria and risks |
| `docs/client-questions.md` | One-page checklist of open questions for the client, with the assumption we work to until each is answered |
| `prototype/shutdown-tracker.html` | Clickable prototype of every screen. Open it in a browser, or publish it as a page. No build step. |
| `prototype/screenshots/` | 22 screens captured from the prototype in scene order, for decks and videos |
| `prototype/demo-video-script.md` | Scene-by-scene script with voice-over for a demo video |

## Product rules agreed with the client

- **Area is the tenant.** A user belongs to one or more areas. A user who is not scoped to an area cannot sign in to it. Cross-area access is granted by an administrator, never self-selected.
- **Simple login first.** User ID and password. Single sign-on comes later, behind the same interface.
- **Straight to the dashboard.** With one area there is no selection screen. The area picker appears only for accounts scoped to several areas.
- **Three statuses, three colours.** Completed green, In progress yellow, Not started red. No blocked status.
- **Managers own the configuration.** Form fields, task creation, Excel import of tasks and workforce, and assignment are done by the unit manager in the app.
- **Nothing is overwritten.** Every edit to a task creates a new version. Old field values stay in the database and are shown in the task's history.
- **Voice to text is central.** A field user speaks, the agent transcribes and extracts the fields, the user checks and confirms. Transcript and audio are kept as evidence.
- **Connectivity is required.** No offline mode is promised. The app says clearly when there is no signal and accepts nothing it cannot save.
- **No client identity in demos.** Prototype, screenshots and script carry no company name or logo.

## Running the prototype

Open `prototype/shutdown-tracker.html` in any modern browser. Demo accounts are listed on the login screen; the password is any non-empty text. Add `#scene-dash`, `#scene-task` or any scene name from the file's `scene()` function to the URL to open a screen directly.

## Status

Design finalised and build plan agreed in principle, October 2026. Implementation has not started.
