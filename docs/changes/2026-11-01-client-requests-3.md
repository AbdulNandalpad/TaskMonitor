# Change request 3 (screenshots from client review)

## CR-8 The area title on the dashboard is editable by managers

Problem: "Blast Furnace 1" (the dashboard heading) has no edit control. Rule in CR-6 allowed only `area_admin`, and the client's manager account is a `manager`.

Rule: managers and area admins can rename the area from the dashboard heading. Every rename is audited as before (`area_renamed`, old and new). The area `code` (bf1, used for scoping) is never editable.

Changes
- Migration `0006_area_rename_managers.sql`: replace policy `area_update` so `has_role(id, '{area_admin,manager}')` for using and with check; the column grant stays `update (name)` only. Idempotent.
- Dashboard: show the pencil icon next to the area heading for manager and area admin, same sheet pattern as the list name. Sign-in page label and the report header read the live name.
- Update the CR-6 check that expected 403 for a manager renaming the area: it now succeeds with an audit row; a field user is still refused.

Prove: as a manager, rename the area, see the new name on the dashboard, sign-in label and report, one audit row; restore the name. Field user: no pencil, direct update changes 0 rows.

## CR-9 Tasks list grouped by section

Problem: the All tasks page is a flat table; the client wants it grouped by section.

Changes (screen only, no migration)
- `/tasks`: group rows under section headers, in section order. Each header shows the section name, its head person, the count and a small progress bar with the done count (for example "SGP · D. Patil · 9 of 16 done"). Headers are collapsible; the default is all expanded, and the state is remembered per user in the browser.
- Filters (status chips, search, section dropdown, responsible) keep working and apply before grouping; sections with no matching tasks are hidden. The section dropdown still narrows to one section.
- Keep the columns, but drop the repeated Section column inside groups (the header carries it). Row numbers keep the global task number.
- On phone width, headers stay sticky while scrolling their group.
- Section rename (CR-6) shows in the headers immediately.

Prove: the Tasks page shows 10 group headers for the seeded list in order; collapsing one hides its rows; the Not started chip leaves only groups that contain not-started tasks; search "belt" shows only the matching groups.
