# Functional Requirements Document
Furnace Analysis (Converter Analyzer) | Version 1.0 | 9 November 2026

## 1. Introduction

Requirements are identified FR-FA-nnn and business rules BR-FA-nn; test cases refer to these identifiers.

## 2. Overview

Furnace Analysis is an application on the common sign-in platform. It tracks the wear of the refractory lining of steel converters from the vendor's laser-scan reports.

An analyst uploads the vendor's six-page PDF report for one heat. An AI service reads the table of 22 zones (average and minimum lining thickness in mm). The analyst checks the values against the PDF, corrects anything wrong and saves. Nothing is stored until they save.

Each zone is judged against limits that an administrator keeps per converter (warning below, critical below, in mm). The dashboard shows the counts and the zones needing attention; the scan page shows every zone with its change since the previous scan; Trends shows one zone over time. When a saved scan has Warning or Critical zones, an email is sent to the configured recipients.

## 3. Users and roles

| Role | Permissions | Navigation |
|---|---|---|
| Viewer | Has the application. Dashboard, scan pages, Trends, Open vendor PDF. | Navigation: Dashboard, Trends. |
| Analyst | Viewer + Upload report (read, review, save scans). | Navigation: Dashboard, Upload report, Trends. |
| Administrator | Analyst + Settings: converters, limits and recommendations, email recipients, roles. | Navigation: Dashboard, Upload report, Trends, Settings. |
| Platform administrator | Grants or revokes applications per user at /admin/access. Always a Furnace Analysis administrator. | Also sees the access screen. |


## 4. Glossary

| Term | Meaning |
|---|---|
| Converter | The steel-making vessel whose lining is scanned. |
| Campaign | One lining life, from a new lining to the next reline. Number printed in the report. |
| Heat | One batch of steel; the report is identified by its heat number. |
| Measurement no. | Running scan number within a campaign. |
| Zone | One of 22 named areas of the lining. |
| Section | Group of zones: Tapside, Trunnion, Charge Pad, Slag line. |
| Average / Minimum | Average and smallest remaining lining thickness in a zone, mm. |
| Limit | Warning-below and Critical-below levels in mm for a zone, a section or all zones (*). |
| Limits version | Each save of limits creates the next version; the highest is active. |
| Repair? | Marker when the minimum rose 30 mm or more since the previous scan. |
| IST | Indian Standard Time, UTC+05:30. |


## 5. Functional requirements


### A. Access and navigation

- **FR-FA-001** Sign in with User ID and password on the platform sign-in page. A wrong User ID or password shows "User ID or password is incorrect." and no session is created. _[Everyone]_
- **FR-FA-002** A first sign-in with a temporary password forces the user to choose a new password (at least 8 characters, otherwise "Use at least 8 characters.") before anything else can be used. _[Everyone]_
- **FR-FA-003** After sign-in: an account with no application is refused with "<name> has not been given access to any application yet. Ask your administrator."; an account with one application goes straight into it; an account with several sees the application chooser, and an All apps icon appears in the header. _[Everyone]_
- **FR-FA-004** Every Furnace Analysis page needs a signed-in user who has been given the application. An anonymous visitor is sent to the sign-in page. A user without the needed role who opens a page by its address is sent back to the dashboard. _[Everyone]_
- **FR-FA-005** The header shows the logo, the navigation (Dashboard; Upload report for analysts and administrators; Trends; Settings for administrators), the user's name with the role label Viewer, Analyst or Administrator, and a Sign out button that ends the session. _[Everyone]_

### B. Dashboard (/furnace)

- **FR-FA-010** One card per converter, with its name and the line "Latest scan: heat H, measurement M, date and time (IST) - open". _[Everyone]_
- **FR-FA-011** For the latest scan, tiles show the number of Critical zones, Warning zones and OK zones. A "No limit" tile appears when some zones have no applicable limit. _[Everyone]_
- **FR-FA-012** A converter with no limits shows a banner: "No limits are set for this converter yet, so zones show "No limit" instead of OK, Warning or Critical." Administrators also get a Set the limits link; others see "Ask an administrator to set them." _[Everyone]_
- **FR-FA-013** "Needs attention" lists the zones of the latest scan that are Critical or Warning, Critical first, then lowest minimum first, at most 8 rows. Columns: Zone (with its section), Average, Minimum, Status, Recommendation ("No recommendation set" when there is none). _[Everyone]_
- **FR-FA-014** "Recent scans" lists the latest 8 scans of the converter, newest first: Date, Heat, Meas., Critical, Warning, OK, and an Open button to the scan page. _[Everyone]_
- **FR-FA-015** The dashboard judges zones with the converter's current limits, so a change of limits shows at once. _[Everyone]_
- **FR-FA-016** With no scan at all the dashboard shows "No scans yet". Analysts and administrators get an Upload report button; viewers see "Nothing has been uploaded yet. An analyst will add the first report." _[Everyone]_

### C. Upload and read (/furnace/upload)

- **FR-FA-020** Only PDF files up to 15 MB are accepted. Several files can be chosen at once and are processed one after the other. A file that is not a PDF shows "This is not a PDF file."; one over 15 MB shows "The PDF is larger than 15 MB." _[Analyst, Administrator]_
- **FR-FA-021** Each file shows its state: Uploading..., "Reading the report. This takes about half a minute.", then the review form, then saved or an error. _[Analyst, Administrator]_
- **FR-FA-022** The PDF is read by an AI service. It returns the header (plant, converter, campaign, heat, measurement number, date and time, steel level, tonnes, bath level) and the table of 22 zones (zone name, average and minimum thickness in mm, angle and depth as printed). Values are copied exactly as printed. _[Analyst, Administrator]_
- **FR-FA-023** A review form shows what was read: editable Plant, Converter, Campaign, Heat, Measurement no., Scan date and time (India), and an editable Average and Minimum for every zone. It says: "Compare with the PDF, correct anything that is wrong, then save. Nothing is stored until you do." _[Analyst, Administrator]_
- **FR-FA-024** Under "Check before saving" the form lists problems found while reading: the date could not be read; a row could not be read; a zone appears twice; the minimum is above the average; a zone name is not a known zone; the number of zones is not 22; the measurement is already saved. _[Analyst, Administrator]_
- **FR-FA-025** Confirm and save stores the scan, its zones, the limits version used and a copy of the PDF. The zones are judged on the server with the converter's active limits (never trusted from the browser). The result is "Saved. N critical, N warning, N OK[, N without a limit] (limits version V | no limits set yet)." with an Open the scan link. _[Analyst, Administrator]_
- **FR-FA-026** A measurement (same converter, campaign and measurement number) can be saved only once. A second save is refused with "this measurement is already saved"; the review form already warns "Measurement M of campaign C is already saved. Saving again will be refused." _[Analyst, Administrator]_
- **FR-FA-027** Converter, campaign, heat, measurement number and date are all required. Otherwise saving is refused with "Converter, campaign, heat, measurement number and date are all needed". _[Analyst, Administrator]_
- **FR-FA-028** If the report cannot be read the user sees "The report could not be read" with a short detail; if the AI service is not configured, "Reading reports needs the AI service, which is not set up." _[Analyst, Administrator]_
- **FR-FA-029** The converter (named "<plant> Converter <code>") and the campaign are created automatically the first time a report for them is saved. _[Analyst, Administrator]_
- **FR-FA-030** At save, a zone row whose name is empty or whose average or minimum is not a number or is negative is left out. If no zone is left, saving is refused with "No zone readings to save". _[Analyst, Administrator]_

### D. Scan page (/furnace/scans/{id})

- **FR-FA-040** Title "Heat H - measurement M"; subtitle "converter name - date and time (IST)"; tiles Critical, Warning, OK (and No limit). _[Everyone]_
- **FR-FA-041** A note states the limits version used now (and its note), the version the scan was judged with when it was saved (or that it was saved before any limits existed), the scan the changes are measured against (or "This is the first scan, so there is nothing to compare with."), the steel level in m at t tonnes and the bath level in m. _[Everyone]_
- **FR-FA-042** A table lists all zones grouped by section in the order Tapside, Trunnion, Charge Pad, Slag line. Columns: Zone (angle and depth in small text), Average, Minimum, Status, change in average, change in minimum, Limits (min) as "warning / critical mm", Recommendation. _[Everyone]_
- **FR-FA-043** Status is shown as a badge with both an icon and a label: OK, Warning, Critical or No limit. _[Everyone]_
- **FR-FA-044** The change columns show the difference since the previous scan of the same converter (any campaign, by scan time): negative means thinner, increases carry a +, and "-" is shown when there is no previous scan. _[Everyone]_
- **FR-FA-045** A "Repair?" marker is shown next to the change in minimum when the minimum rose by 30 mm or more, because wear cannot make a lining thicker (gunning or a scan difference is likely). _[Everyone]_
- **FR-FA-046** Open vendor PDF opens the original PDF of that heat (signed-in users with the application only). Back returns to the dashboard. An unknown scan address shows a not found page. _[Everyone]_

### E. Trends (/furnace/trends)

- **FR-FA-050** A Zone selector lists the zones of the latest scan in section order (and a Converter selector when there is more than one converter). Show redraws the chart and table. The first zone is chosen by default. _[Everyone]_
- **FR-FA-051** The chart plots two lines for the chosen zone across successive scans in date order (up to 500): Average and Minimum, thickness in mm. Every scan is a dot with the text "date - heat H - average|minimum N mm". _[Everyone]_
- **FR-FA-052** When a minimum limit applies to the zone, dashed lines at its warning and critical levels are drawn and labelled "warning N" and "critical N"; the legend adds "Dashed lines: limits on the minimum". _[Everyone]_
- **FR-FA-053** Below the chart a table lists Date, Heat, Average, Minimum and change in minimum (against the previous scan), newest first; the oldest row shows "-". _[Everyone]_
- **FR-FA-054** Empty states: "No scans yet" (no data at all) and "No readings for this zone". _[Everyone]_

### F. Limits and recommendations (Settings)

- **FR-FA-060** For each converter an administrator edits a table of limits: Zone, section or *; Metric (Minimum or Average); Warning below (mm); Critical below (mm); Recommendation (warning); Recommendation (critical). Rows can be added and removed. _[Administrator]_
- **FR-FA-061** The most specific limit wins: an exact zone name, then its section (Tapside, Trunnion, Charge Pad, Slag line), then *. Names are matched ignoring upper and lower case. Minimum and Average limits are separate. _[Administrator]_
- **FR-FA-062** A value below the critical level is Critical; otherwise below the warning level is Warning; otherwise OK. A value equal to a level is not below it. With no applicable limit the status is "No limit" (never OK). The status of a zone is the worse of its Average status and its Minimum status. _[Administrator]_
- **FR-FA-063** Save as new version creates version N+1 and makes it active; earlier versions are kept and listed ("Earlier versions"). An optional note of up to 300 characters is stored. Success: "Saved as a new version. Scans uploaded from now on are judged with it." With no level at all: "Give at least one warning or critical level." _[Administrator]_
- **FR-FA-064** Levels must be numbers ("Limits must be numbers"), and a critical level above its warning level is refused ("<zone>: the critical level must not be above the warning level"). Equal levels are accepted. _[Administrator]_
- **FR-FA-065** Limits can be loaded from Excel or CSV: Download Excel template gives furnace-analysis-limits-template.xlsx (sheet Limits; columns Zone, Metric, Warning below (mm), Critical below (mm), Recommendation (warning), Recommendation (critical)); Upload Excel or CSV fills the table for checking before saving. Messages: "N rows loaded from the file. Check them, then save."; "Row N: metric must be Average or Minimum"; "Row N: give a warning or a critical level"; "Row N: the critical level must not be above the warning level"; "No limit rows were found in the file." _[Administrator]_
- **FR-FA-066** The page shows the active version, when it was saved and its note, and up to ten earlier versions. _[Administrator]_
- **FR-FA-067** The recommendation text of a limit appears beside Critical and Warning zones on the dashboard, the scan page and in emails. _[Everyone]_

### G. Converters (Settings)

- **FR-FA-070** An administrator can Add or rename converter (code and name required, plant optional). An existing code is renamed. A converter can be created before its first report so that limits can be set first. _[Administrator]_

### H. Email notifications (Settings)

- **FR-FA-080** Recipients table: Name, Email, Converter (All or one), Send from (Warning and critical, or Critical only), Active, Delete. Adding needs a valid email address ("not a valid email address"). _[Administrator]_
- **FR-FA-081** When a scan is saved and its worst status is Warning or Critical, an email goes to every active recipient whose converter matches (or is All) and whose Send from level is reached. No email is sent for an all-OK scan. _[System]_
- **FR-FA-082** Email subject "<Severity>: <converter>, heat H (measurement M)". Body: a table of the Warning and Critical zones (zone, section, average, minimum, status, recommendations), Critical first then lowest minimum first, and an Open the report button linking to the scan page. _[System]_
- **FR-FA-083** Sending uses an email service. When it is not configured nothing is sent and the save result says "Email: N sent, N not sent because email is not set up, N failed." _[System]_
- **FR-FA-084** Settings shows the last 8 emails as "address sent | not sent (email not set up) | failed (reason)". _[Administrator]_

### I. Roles and access

- **FR-FA-090** An administrator sets a user's Furnace Analysis role by User ID: Analyst (can upload), Administrator, Viewer, or No extra role. An unknown User ID is refused ("no such user"). A change applies at the user's next page load. _[Administrator]_
- **FR-FA-091** A platform administrator grants or revokes the application per user on the platform access screen (/admin/access). Access is denied by default. Platform administrators are always Furnace Analysis administrators. _[Platform administrator]_

### J. Data protection and audit

- **FR-FA-100** Furnace Analysis data and PDFs are visible only to signed-in users who have the application. PDFs are kept in a private store and served only through the application. _[System]_
- **FR-FA-101** Writing is allowed only through server rules by the proper role: a viewer cannot save scans or limits even by calling the interface directly (answer 403 "Not allowed"); an analyst cannot change limits, recipients, roles or converters. _[System]_
- **FR-FA-102** An audit entry is recorded when a scan is saved (heat, measurement) and when limits are saved (version). There is no audit screen. _[System]_

## 6. Business rules

| ID | Rule |
|---|---|
| BR-FA-01 | One vendor report PDF is one heat and one scan. There is no pairing of files and no "file 1 / file 2". |
| BR-FA-02 | A scan has 22 zones: Tapside Area-1 to 4; Left Trunion-1 to 4 and Right Trunion-1 to 4; ChargePad-1, 1A, 2, 2A, 3, 3A, 4, 4A; SL-Drive and SL-NON Drive. |
| BR-FA-03 | Section of a zone is taken from its name: Tapside*, *Trunion* or *Trunnion*, ChargePad* or Charge Pad*, SL-*. Anything else is section "Other" and gets a warning when reading. |
| BR-FA-04 | Only two numbers per zone are measured and judged: average thickness and minimum thickness, both in mm. Angle and depth ranges are printed text kept with the zone; they are never compared. |
| BR-FA-05 | Thicker is better. A value below a limit is bad: below critical = Critical, else below warning = Warning, else OK. Equal to the limit is not below it. |
| BR-FA-06 | Zone status = the worse of the status of its average and of its minimum. No applicable limit gives "No limit", never OK. |
| BR-FA-07 | Limit lookup per zone and metric: exact zone, then section, then *. Case does not matter. |
| BR-FA-08 | Limits are versioned per converter. Saving creates the next version and makes it active. Dashboard and scan pages always judge with the active version; the version a scan was saved with is only reported as a note. |
| BR-FA-09 | Change since previous scan = this scan minus the previous scan of the same converter by scan time, across campaigns. A rise of 30 mm or more in the minimum is marked "Repair?"; 29 mm or less is not. |
| BR-FA-10 | Times are scan times as printed by the scanner (Indian time). They are always displayed in IST (UTC+05:30) whatever the browser's time zone. |
| BR-FA-11 | Zones are listed grouped by section in the order Tapside, Trunnion, Charge Pad, Slag line; inside a section in natural order (1, 1A, 2, 2A ...; Left before Right). |
| BR-FA-12 | A saved measurement cannot be edited or replaced in the application. A wrong value is corrected before saving, in the review form. |


## 7. Screens

| Address | Screen |
|---|---|
| /launch | After sign-in routing |
| /apps | Application chooser |
| /furnace | Dashboard |
| /furnace/upload | Upload report (Analyst, Administrator) |
| /furnace/scans/{id} | One scan |
| /furnace/trends | Trends |
| /furnace/settings | Settings (Administrator) |
| /admin/access | Platform access (platform administrator) |
| /api/furnace/scans/{id}/pdf | Vendor PDF (signed-in with application) |


## 8. Non-functional requirements

- HTTPS only. Supported on current Chrome and Edge; Firefox and Safari best effort.
- Phone-width layout: no sideways page scroll; tables scroll inside their card.
- Reading a PDF takes about 30 seconds (90 seconds at most). Times are always shown in IST.
- Data is private to signed-in users who have the application; writes follow server-side role rules.

## 9. Out of scope

- Offline mode
- Editing or deleting a saved scan
- Generated PDF reports (the original vendor PDF is stored and can be opened)
- Audit trail screen and user-management screen
- In-app notifications (notification is by email)
- Percentage thresholds, tolerances and section-level status

## Appendix A. Worked example

Six scans of one converter judged with limits Set A.

### A.1 Scans

| Heat | Meas. | Campaign | Scan time (IST) | Steel level (m) @ t | Bath level (m) |
|---|---|---|---|---|---|
| 2083 | 20 | 2 | 24 Sep 2026 17:00:07 | 8.57 @ 350 | -3.1 |
| 2203 | 21 | 2 | 30 Sep 2026 07:57:17 | 8.56 @ 350 | -3.11 |
| 2614 | 22 | 2 | 19 Oct 2026 21:07:41 | 8.64 @ 350 | -3.03 |
| 2668 | 23 | 2 | 22 Oct 2026 11:08:43 | 8.61 @ 350 | -3.06 |
| 2751 | 24 | 2 | 26 Oct 2026 10:35:16 | 8.7 @ 350 | -2.97 |
| 2886 | 25 | 2 | 01 Nov 2026 03:48:33 | 8.71 @ 350 | -2.96 |


### A.2 Average / minimum (mm)

| Zone | Section | 2083 | 2203 | 2614 | 2668 | 2751 | 2886 |
|---|---|---|---|---|---|---|---|
| Tapside Area-1 | Tapside | 1087 / 359 | 1162 / 159 | 907 / 458 | 938 / 350 | 1080 / 557 | 1008 / 286 |
| Tapside Area-2 | Tapside | 969 / 635 | 1241 / 680 | 826 / 432 | 896 / 639 | 903 / 568 | 857 / 576 |
| Tapside Area-3 | Tapside | 799 / 625 | 820 / 632 | 750 / 571 | 792 / 567 | 768 / 556 | 741 / 522 |
| Tapside Area-4 | Tapside | 802 / 704 | 793 / 715 | 789 / 675 | 814 / 698 | 744 / 642 | 750 / 594 |
| Left Trunion-1 | Trunnion | 1417 / 657 | 1383 / 632 | 753 / 503 | 958 / 662 | 1069 / 888 | 1045 / 721 |
| Left Trunion-2 | Trunnion | 1566 / 1557 | 2265 / 1694 | 856 / 636 | 988 / 863 | 1032 / 907 | 1005 / 900 |
| Left Trunion-3 | Trunnion | 749 / 625 | 947 / 642 | 713 / 544 | 739 / 549 | 735 / 559 | 690 / 489 |
| Left Trunion-4 | Trunnion | 796 / 646 | 805 / 623 | 752 / 578 | 773 / 565 | 703 / 472 | 673 / 453 |
| Right Trunion-1 | Trunnion | 1139 / 304 | 1118 / 114 | 940 / 255 | 1023 / 385 | 977 / 404 | 951 / 108 |
| Right Trunion-2 | Trunnion | 1296 / 1005 | 1529 / 969 | 909 / 707 | 1085 / 820 | 1075 / 850 | 1114 / 805 |
| Right Trunion-3 | Trunnion | 806 / 661 | 840 / 677 | 706 / 589 | 725 / 591 | 742 / 617 | 726 / 589 |
| Right Trunion-4 | Trunnion | 818 / 725 | 805 / 709 | 790 / 681 | 795 / 690 | 782 / 677 | 786 / 677 |
| ChargePad-1 | Charge Pad | 957 / 83 | 1019 / 111 | 972 / 210 | 1162 / 236 | 1044 / 228 | 959 / 130 |
| ChargePad-1A | Charge Pad | 1138 / 60 | 1214 / 442 | 914 / 414 | 1075 / 375 | 1031 / 124 | 861 / 202 |
| ChargePad-2 | Charge Pad | 917 / 802 | 991 / 852 | 887 / 785 | 1045 / 857 | 953 / 827 | 880 / 729 |
| ChargePad-2A | Charge Pad | 909 / 799 | 1141 / 853 | 894 / 765 | 1022 / 870 | 952 / 815 | 867 / 737 |
| ChargePad-3 | Charge Pad | 764 / 537 | 753 / 531 | 708 / 447 | 790 / 472 | 697 / 403 | 669 / 366 |
| ChargePad-3A | Charge Pad | 752 / 537 | 764 / 532 | 713 / 452 | 764 / 468 | 685 / 413 | 641 / 366 |
| ChargePad-4 | Charge Pad | 789 / 641 | 753 / 604 | 743 / 586 | 789 / 648 | 740 / 550 | 700 / 516 |
| ChargePad-4A | Charge Pad | 732 / 603 | 712 / 587 | 706 / 525 | 732 / 535 | 666 / 476 | 603 / 450 |
| SL-Drive | Slag line | 782 / 683 | 874 / 692 | 732 / 631 | 753 / 627 | 736 / 616 | 707 / 587 |
| SL-NON Drive | Slag line | 818 / 721 | 821 / 729 | 744 / 670 | 775 / 675 | 771 / 677 | 759 / 671 |


### A.3 Limits Set A and zone status

| Zone / section | Metric | Warning below | Critical below |
|---|---|---|---|
| * | Average | 700 | 500 |
| * | Minimum | 400 | 150 |


| Zone | 2083 | 2203 | 2614 | 2668 | 2751 | 2886 |
|---|---|---|---|---|---|---|
| Tapside Area-1 | Warning | Warning | Ok | Warning | Ok | Warning |
| Tapside Area-2 | Ok | Ok | Ok | Ok | Ok | Ok |
| Tapside Area-3 | Ok | Ok | Ok | Ok | Ok | Ok |
| Tapside Area-4 | Ok | Ok | Ok | Ok | Ok | Ok |
| Left Trunion-1 | Ok | Ok | Ok | Ok | Ok | Ok |
| Left Trunion-2 | Ok | Ok | Ok | Ok | Ok | Ok |
| Left Trunion-3 | Ok | Ok | Ok | Ok | Ok | Warning |
| Left Trunion-4 | Ok | Ok | Ok | Ok | Ok | Warning |
| Right Trunion-1 | Warning | Critical | Warning | Warning | Ok | Critical |
| Right Trunion-2 | Ok | Ok | Ok | Ok | Ok | Ok |
| Right Trunion-3 | Ok | Ok | Ok | Ok | Ok | Ok |
| Right Trunion-4 | Ok | Ok | Ok | Ok | Ok | Ok |
| ChargePad-1 | Critical | Critical | Warning | Warning | Warning | Critical |
| ChargePad-1A | Critical | Ok | Ok | Warning | Critical | Warning |
| ChargePad-2 | Ok | Ok | Ok | Ok | Ok | Ok |
| ChargePad-2A | Ok | Ok | Ok | Ok | Ok | Ok |
| ChargePad-3 | Ok | Ok | Ok | Ok | Warning | Warning |
| ChargePad-3A | Ok | Ok | Ok | Ok | Warning | Warning |
| ChargePad-4 | Ok | Ok | Ok | Ok | Ok | Ok |
| ChargePad-4A | Ok | Ok | Ok | Ok | Warning | Warning |
| SL-Drive | Ok | Ok | Ok | Ok | Ok | Ok |
| SL-NON Drive | Ok | Ok | Ok | Ok | Ok | Ok |


### A.4 Zone counts

| Heat | Scan time (IST) | Critical | Warning | OK |
|---|---|---|---|---|
| 2083 | 24 Sep 2026 17:00:07 | 2 | 2 | 18 |
| 2203 | 30 Sep 2026 07:57:17 | 2 | 1 | 19 |
| 2614 | 19 Oct 2026 21:07:41 | 0 | 2 | 20 |
| 2668 | 22 Oct 2026 11:08:43 | 0 | 4 | 18 |
| 2751 | 26 Oct 2026 10:35:16 | 1 | 4 | 17 |
| 2886 | 01 Nov 2026 03:48:33 | 2 | 7 | 13 |


### A.5 Repair? markers

| Scan vs previous | Zones |
|---|---|
| 2203 vs 2083 | Tapside Area-2 (+45), Left Trunion-2 (+137), ChargePad-1A (+382), ChargePad-2 (+50), ChargePad-2A (+54) |
| 2614 vs 2203 | Tapside Area-1 (+299), Right Trunion-1 (+141), ChargePad-1 (+99) |
| 2668 vs 2614 | Tapside Area-2 (+207), Left Trunion-1 (+159), Left Trunion-2 (+227), Right Trunion-1 (+130), Right Trunion-2 (+113), ChargePad-2 (+72), ChargePad-2A (+105), ChargePad-4 (+62) |
| 2751 vs 2668 | Tapside Area-1 (+207), Left Trunion-1 (+226), Left Trunion-2 (+44), Right Trunion-2 (+30) |
| 2886 vs 2751 | ChargePad-1A (+78) |


### A.6 Needs attention (heat 2886, Set A)

1 Right Trunion-1 (avg 951, min 108) Critical; 2 ChargePad-1 (avg 959, min 130) Critical; 3 ChargePad-1A (avg 861, min 202) Warning; 4 Tapside Area-1 (avg 1008, min 286) Warning; 5 ChargePad-3 (avg 669, min 366) Warning; 6 ChargePad-3A (avg 641, min 366) Warning; 7 ChargePad-4A (avg 603, min 450) Warning; 8 Left Trunion-4 (avg 673, min 453) Warning.

### A.7 Trends (newest first)

| Zone | Rows |
|---|---|
| ChargePad-1A | 2886: avg 861, min 202, change +78 / 2751: avg 1031, min 124, change -251 / 2668: avg 1075, min 375, change -39 / 2614: avg 914, min 414, change -28 / 2203: avg 1214, min 442, change +382 / 2083: avg 1138, min 60, change - |
| Left Trunion-2 | 2886: avg 1005, min 900, change -7 / 2751: avg 1032, min 907, change +44 / 2668: avg 988, min 863, change +227 / 2614: avg 856, min 636, change -1058 / 2203: avg 2265, min 1694, change +137 / 2083: avg 1566, min 1557, change - |


### A.8 Limits Set B

| Zone / section | Metric | Warning below | Critical below | Recommendation (warning) | Recommendation (critical) |
|---|---|---|---|---|---|
| * | Minimum | 400 | 150 | Monitor next heat | Stop and inspect |
| Tapside | Minimum | 250 | 100 |  |  |
| ChargePad-1A | Minimum | 150 | 100 |  |  |


With Set B on heat 2886: 2 Critical (Right Trunion-1, ChargePad-1), 2 Warning (ChargePad-3, ChargePad-3A), 18 OK. Tapside Area-1 and ChargePad-1A are OK because their section or zone limit takes precedence over *.

## Document history

| Version | Change | Date |
|---|---|---|
| 1.0 | First issue. | 9 Nov 2026 |

