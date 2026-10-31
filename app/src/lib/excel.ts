/* Excel helpers (run in the browser). SheetJS parses the file; rows are mapped to form fields and posted to a route handler. */
import * as XLSX from "xlsx";

export type Sheet = { name: string; headers: string[]; rows: string[][]; sheets: string[] };

export async function readWorkbook(file: File, sheetName?: string): Promise<Sheet> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const name = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: "", raw: false });
  const text = grid.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim())));
  // header row = first of the first ten rows with at least three filled cells
  let h = text.findIndex((r, i) => i < 10 && r.filter(Boolean).length >= 3);
  if (h < 0) h = 0;
  const width = Math.max(0, ...text.slice(h).map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? "");
  return { name, headers: pad(text[h] ?? []), rows: text.slice(h + 1).map(pad), sheets: wb.SheetNames };
}

/** "4 hrs" -> 4, "08 hrs" -> 8, "6 hra" -> 6, "3.5" -> 3.5. Anything without a number is null. */
export function normaliseHours(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const m = /(\d+(?:[.,]\d+)?)/.exec(String(raw));
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function normaliseStatus(raw: string): "not_started" | "in_progress" | "completed" | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/(^|\b)(not|pending|open|yet|nil|to start|planned)\b/.test(s)) return "not_started";
  if (/complet|done|closed|finish/.test(s)) return "completed";
  if (/progress|ongoing|started|wip|running/.test(s)) return "in_progress";
  return null;
}

export function normaliseProgress(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = /(\d+(?:\.\d+)?)/.exec(s);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!s.includes("%") && n > 0 && n <= 1 && /\./.test(s)) n *= 100; // Excel stores 60% as 0.6
  return Math.max(0, Math.min(100, Math.round(n)));
}

export const TASK_FIELDS = ["skip", "Section", "Work description", "Planned hours", "Manpower", "Vendor", "Responsible", "Status", "Progress", "Remarks"] as const;
export type TaskField = (typeof TASK_FIELDS)[number];

/** Sensible default mapping by header name. */
export function guessTaskField(header: string): TaskField {
  const h = header.toLowerCase();
  if (/s\.?\s*no|sr\.?\s*no|serial/.test(h)) return "skip";
  if (/work\s*desc|job|task/.test(h)) return "Work description";
  if (/area|section|zone/.test(h)) return "Section";
  if (/duration|hours|hrs/.test(h)) return "Planned hours";
  if (/manpower|man\s*power|people/.test(h)) return "Manpower";
  if (/vendor|agency|contractor/.test(h)) return "Vendor";
  if (/responsible|owner|incharge|in-charge/.test(h)) return "Responsible";
  if (/compliance\s*%|progress|%/.test(h)) return "Progress";
  if (/compliance\s*desc|remark|comment/.test(h)) return "Remarks";
  if (/^status/.test(h)) return "Status";
  return "skip";
}

export type MappedTask = {
  row: number;
  section: string;
  work_description: string;
  planned_hours: number | null;
  planned_hours_raw: string;
  manpower: number | null;
  vendor: string;
  responsible: string;
  status: "not_started" | "in_progress" | "completed" | null;
  progress: number | null;
  remarks: string;
  filledDown: boolean;
};

/** Maps sheet rows to tasks: merged-cell columns (Section, Responsible) are filled down, blank descriptions skipped. */
export function parseRows(rows: string[][], mapping: TaskField[]) {
  const idx = (f: TaskField) => mapping.map((m, i) => (m === f ? i : -1)).filter((i) => i >= 0);
  const cell = (r: string[], f: TaskField) => idx(f).map((i) => r[i]).filter(Boolean).join(f === "Remarks" ? " · " : " ");
  const out: MappedTask[] = [];
  let skipped = 0, filledDown = 0, hoursParsed = 0;
  let lastSection = "", lastResp = "";
  rows.forEach((r, n) => {
    let section = cell(r, "Section"), resp = cell(r, "Responsible");
    if (section) lastSection = section;
    if (resp) lastResp = resp;
    const desc = cell(r, "Work description");
    if (!desc) { skipped++; return; }
    let fd = false;
    if (!section && lastSection) { section = lastSection; }
    if (!resp && lastResp && idx("Responsible").length) { resp = lastResp; fd = true; filledDown++; }
    const hrsRaw = cell(r, "Planned hours");
    const hrs = normaliseHours(hrsRaw);
    if (hrsRaw && !/^\d+(\.\d+)?$/.test(hrsRaw.trim())) hoursParsed++;
    out.push({
      row: n + 1, section, work_description: desc, planned_hours: hrs, planned_hours_raw: hrsRaw,
      manpower: normaliseHours(cell(r, "Manpower")), vendor: cell(r, "Vendor"), responsible: resp,
      status: normaliseStatus(cell(r, "Status")), progress: normaliseProgress(cell(r, "Progress")),
      remarks: cell(r, "Remarks"), filledDown: fd,
    });
  });
  return { tasks: out, skipped, filledDown, hoursParsed };
}

export const WORKFORCE_FIELDS = ["skip", "Name", "Role", "Section", "Phone", "Vendor team"] as const;
export type WorkforceField = (typeof WORKFORCE_FIELDS)[number];
export function guessWorkforceField(header: string): WorkforceField {
  const h = header.toLowerCase();
  if (/name/.test(h)) return "Name";
  if (/designation|role|title/.test(h)) return "Role";
  if (/area|section/.test(h)) return "Section";
  if (/mobile|phone|contact/.test(h)) return "Phone";
  if (/agency|vendor|contractor/.test(h)) return "Vendor team";
  return "skip";
}
export type MappedPerson = { name: string; role: string; section: string; phone: string; vendor: string };
export function parsePeople(rows: string[][], mapping: WorkforceField[]) {
  const col = (f: WorkforceField) => mapping.indexOf(f);
  const get = (r: string[], f: WorkforceField) => (col(f) >= 0 ? r[col(f)] ?? "" : "");
  const people: MappedPerson[] = [];
  let skipped = 0;
  for (const r of rows) {
    const name = get(r, "Name");
    if (!name) { skipped++; continue; }
    people.push({ name, role: get(r, "Role"), section: get(r, "Section"), phone: get(r, "Phone"), vendor: get(r, "Vendor team") });
  }
  return { people, skipped };
}
