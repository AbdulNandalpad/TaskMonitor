from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

SHOTS = r"C:\Users\Abdul Nandalpad\.claude\projects\C--Users-Abdul-Nandalpad-Documents-JSW\988b2b12-a3ee-41cd-84bf-2810175d6abb\tool-results\mcp-claude-in-chrome-blob-"
OUT = r"C:\Users\Abdul Nandalpad\Documents\JSW\TaskMonitor\docs\test-execution\Task_Monitor_Test_Execution_Report.docx"

# id, module, scenario, severity, status, actual, shot
R = [
("TC_001","Task Creation","Create task","P1","Pass",
 "Created 'TC_001 Fix login issue' with Section, Work description and Responsible (Ravi Kumar). Toast 'Task 125 created · Ravi Kumar notified'; task opened with unique Task ID 125 and appears in the list. Note: the app's form has no Priority or Due Date field (its fields are Section, Work description, Planned hours, Manpower, Vendor, Responsible, Photo required), so those test data items could not be entered.",
 "1793735057138-4r3vql.jpg"),
("TC_002","Task Creation","Create task","P2","Pass",
 "Clicked 'Create task' with Work description blank. Task not saved; browser validation 'Please fill out this field.' shown on the Work description field.",
 "1793735048214-3eaj16.jpg"),
("TC_003","Task Status","Not Started","P1","Pass",
 "New tasks 125 and 126 show 'Not started' (0%) on the task details. The summary report also lists task 126 under 'Not started'.", None),
("TC_004","Task Status","In-Progress","P1","Pass",
 "Clicked 'In progress' on task 125. There is no Save button: the change saves at once ('Status updated'), progress moves to 10% and the timeline shows 'Status set to In progress.' Dashboard and report totals stayed consistent afterwards.", None),
("TC_005","Task Status","Completed","P1","Pass",
 "Clicked 'Completed' on task 125. Status 100%, timeline 'Status set to Completed.' with date/time (4 Nov 01:14). The detailed report shows START and END for the task. No Save button is needed.", None),
("TC_006","Task Status","Completed","P2","Pass",
 "On the completed task all three status buttons are disabled and the page says 'Completed is final: status and progress are locked.' The click on 'Not started' had no effect; status stayed Completed.",
 "1793735079508-oeo4zr.jpg"),
("TC_007","Task Assignment","Assign to engineer","P1","Pass",
 "Created task 126 as Unassigned, then used Assign tasks > Assign > Ravi Kumar. Task details show Responsible: Ravi Kumar, version 2, timeline 'Assigned · version 2 — Unassigned → Ravi Kumar'. Assignment is by the 12 seeded people/teams (Ravi Kumar exists).", None),
("TC_008","Task Assignment","Reassign","P2","Pass",
 "Edit > Responsible changed from Ravi Kumar to A. Sharma and saved as version 3. Timeline and field history record 'Ravi Kumar → A. Sharma'. Assign tasks page counts moved: A. Sharma 10 to 11 and the unassigned count dropped to 20. 'Anil Sharma' does not exist, so A. Sharma was used as Engineer B.", None),
("TC_009","Comments - Manual","Add comment","P1","Pass",
 "Added remark 'Work started on the issue' to task 126. Saved and shown in the timeline with author (Sunita Mehta) and date/time (4 Nov 01:16).", None),
("TC_010","Comments - Manual","Empty comment","P2","Pass",
 "Clicked 'Save remark' with the box blank. Nothing saved; the message 'Type a remark first.' is shown.",
 "1793735165006-mvwvvo.jpg"),
("TC_011","Comments - Voice","English","P1","Blocked",
 "Could not be run: the browser automation has no microphone or audio input, so 'Testing completed successfully' could not be spoken. The voice sheet itself opens and starts listening (English / Hindi / Kannada selector present). Needs a person to speak into the phone or laptop.", None),
("TC_012","Comments - Voice","Kannada","P1","Blocked",
 "Could not be run: no way to speak Kannada into the browser. Needs a manual run with a real microphone. Note the app translates spoken Kannada to English for the saved remark and keeps the original.", None),
("TC_013","Comments - Voice","Hindi","P1","Blocked",
 "Could not be run: no way to speak Hindi into the browser. Needs a manual run with a real microphone. Same translate-to-English behaviour as TC_012.", None),
("TC_014","Comments - Voice","Mic permission denied","P2","Blocked",
 "Not run: blocking the microphone is a Chrome site-permission setting that the automation must not change. In this session the mic was allowed, so the voice sheet opened normally. To be run manually with the mic set to Block.", None),
("TC_015","Comments - Voice","Edit transcript","P2","Partial",
 "No speech was possible, so the recording was silent; the transcriber returned 'Spelling?' for the silence. On the 'Check and confirm' sheet the transcript and remark are editable: changed them to 'Fix is ready for testing' and confirmed. The timeline saved the edited text and shows 'Spoken · original: Spelling?'. Edit-before-save works; accuracy of real speech not tested.",
 "1793735275410-ogj7rp.jpg"),
("TC_016","Comments - Manual","Kannada / Hindi","P2","Pass",
 "Typed 'ಪರೀಕ್ಷೆ ಪೂರ್ಣಗೊಂಡಿದೆ' and 'परीक्षण पूर्ण हुआ'. Both saved with no character corruption, but by the client's English-consistency rule the headline text is the English translation ('Inspection completed', 'Test completed'), with 'Written in Kannada/Hindi · original: …' in the original script underneath. The expected result says 'displayed in the correct script'; the original is displayed, the main text is English by design.",
 "1793735232128-9ym1es.jpg"),
("TC_017","PDF Report","Summary report","P1","Partial",
 "Summary report page generated (BF1-Shutdown-Report.pdf, 3 pages) with report title, generated date (04 Nov 2026 01:19), compliance by section, open items and photo evidence. The actual PDF file download (Download PDF button, which uses the browser's print/save) was not executed in this run.", None),
("TC_018","PDF Report","Summary counts","P1","Pass",
 "Dashboard: 126 tasks, 64 completed, 38 in progress, 24 not started (65%). Summary report: 64 / 126 completed, 38 in progress, 24 not started, 65%. Per-section rows also match the dashboard. (Actual data was used; the seeded 2/2/2 data does not exist.)", None),
("TC_019","PDF Report","Detailed report","P1","Fail",
 "Detailed report (12 pages, 126 tasks) lists task ID, title, status, START/END, duration and responsible person. It does not list the task's comments: remarks appear only through the AI work summary, and only 3 of 126 tasks have one ('No AI summary has been generated for this task yet' for tasks 125 and 126). So the English, Kannada and Hindi comments added in this run are not in the report and Kannada/Hindi rendering could not be checked there. Retry: after using Generate > Detailed report on the dashboard, summaries rose from 3 to 15 of 126 and then stopped; tasks 125 and 126 still had none, and no Kannada or Hindi text appears anywhere in the report. Result unchanged: comments are not reliably in the detailed report.", None),
("TC_020","PDF Report","No data","P2","Blocked",
 "Not run: the Reports screens have no date-range or filter control, so there is no way to select a period with no tasks. Feature gap against the test case.", None),
]

OBS = [
 "Detailed report overview shows 'Planned hours 72' and 'Dates – to –', while the dashboard shows 767 h planned. The overview figure looks wrong and should be checked.",
 "Silent audio was transcribed as 'Spelling?' by the speech service. A silence or very short recording should probably be rejected or left blank instead of producing words.",
 "Task 102 still shows an untranslated Kannada remark in the summary report; it was entered before the English-translation change. Old entries are not back-filled.",
 "Test data left on the live site by this run: tasks 125 (TC_001 Fix login issue, completed) and 126 (TC_007 Assignment and comments test) with their remarks and one voice update. The app cannot delete tasks.",
]

def shade(cell, hexcol):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), hexcol)
    tcPr.append(shd)

COL = {"Pass":"D1FAE5","Fail":"FECACA","Blocked":"FDE68A","Partial":"E0E7FF"}

d = Document()
st = d.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10)
sec = d.sections[0]
sec.left_margin = sec.right_margin = Inches(0.8)

h = d.add_heading("Task Monitor – Test Execution Report", 0)
p = d.add_paragraph()
p.add_run("Executed: ").bold = True; p.add_run("4 Nov 2026, in Chrome on the live site (task-monitor-navy.vercel.app), signed in as Sunita Mehta (Manager), area Blast Furnace 2.\n")
p.add_run("Test cases: ").bold = True; p.add_run("Task_Monitor_Test_Cases.xlsx (20 cases: 12 P1, 8 P2).\n")
p.add_run("Method: ").bold = True; p.add_run("Each case was driven in the browser and the result read back from the page. No microphone or file-download actions could be done by the automation; those are marked Blocked or Partial.")

d.add_heading("Summary", 1)
cnt = {}
for r in R: cnt[r[4]] = cnt.get(r[4], 0) + 1
t = d.add_table(rows=1, cols=2); t.style = "Light Grid Accent 1"
t.rows[0].cells[0].text = "Result"; t.rows[0].cells[1].text = "Cases"
for k in ["Pass","Partial","Fail","Blocked"]:
    c = t.add_row().cells; c[0].text = k; c[1].text = str(cnt.get(k,0)); shade(c[0], COL[k])
c = t.add_row().cells; c[0].text = "Total"; c[1].text = str(len(R))
d.add_paragraph()
d.add_paragraph("Pass = expected result seen. Partial = part of the case run, rest not possible here. Fail = expected result not met. Blocked = case could not be run in this setup.")
d.add_paragraph("Headline: creation, status, assignment, manual comments and the summary report work as expected. The detailed report does not show comments (TC_019). Voice cases need a person speaking into a real microphone. The reports have no date filter (TC_020).")

d.add_heading("Results", 1)
t = d.add_table(rows=1, cols=5); t.style = "Table Grid"
for i, x in enumerate(["TC ID","Module / scenario","Sev","Status","Actual result"]):
    t.rows[0].cells[i].text = x; shade(t.rows[0].cells[i], "C7D2FE")
    for r_ in t.rows[0].cells[i].paragraphs[0].runs: r_.bold = True
for tc, mod, scn, sev, stt, act, _ in R:
    c = t.add_row().cells
    c[0].text = tc; c[1].text = f"{mod} – {scn}"; c[2].text = sev; c[3].text = stt; c[4].text = act
    shade(c[3], COL[stt])
widths = [Inches(0.7), Inches(1.3), Inches(0.4), Inches(0.7), Inches(3.9)]
for row in t.rows:
    for i, w in enumerate(widths): row.cells[i].width = w
    for cell in row.cells:
        for para in cell.paragraphs:
            for run in para.runs: run.font.size = Pt(9)

d.add_heading("Observations (outside the test cases)", 1)
for o in OBS: d.add_paragraph(o, style="List Bullet")

d.add_heading("Evidence screenshots", 1)
import os
for tc, mod, scn, sev, stt, act, shot in R:
    if shot and os.path.exists(SHOTS + shot):
        d.add_paragraph(f"{tc} – {mod} – {scn} ({stt})").runs[0].bold = True
        d.add_picture(SHOTS + shot, width=Inches(5.6))

d.save(OUT)
print("saved", OUT)
