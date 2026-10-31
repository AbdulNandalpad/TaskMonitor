"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { guessTaskField, parseRows, readWorkbook, TASK_FIELDS, type Sheet, type TaskField } from "@/lib/excel";
import { Arrow, Chk, WarnIcon } from "./Icons";
import { useToast } from "./Toast";

export function ImportTasks({ existing }: { existing: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [map, setMap] = useState<TaskField[]>([]);
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined, sheetName?: string) {
    if (!f) return;
    try {
      const s = await readWorkbook(f, sheetName);
      setFile(f); setSheet(s); setMap(s.headers.map(guessTaskField));
      toast("File read · columns detected");
    } catch { toast("That file could not be read"); }
  }

  const parsed = useMemo(() => (sheet ? parseRows(sheet.rows, map) : null), [sheet, map]);
  const known = useMemo(() => new Set(existing), [existing]);
  const matches = parsed ? parsed.tasks.filter((t) => known.has(`${t.section.trim().toLowerCase()}|${t.work_description.trim().toLowerCase()}`)).length : 0;
  const mapped = map.filter((m) => m !== "skip").length;
  const ready = !!parsed && map.includes("Work description");

  async function run() {
    if (!parsed) return;
    setBusy(true);
    const res = await fetch("/api/import/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks: parsed.tasks, filename: file?.name, sheet: sheet?.name, mapping: sheet!.headers.map((h, i) => [h, map[i]]), skipped: parsed.skipped }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return toast(j.error ?? "Import failed");
    toast(`${j.created} tasks imported${j.updated ? ` · ${j.updated} updated as new versions` : ""}${j.skipped ? ` · ${j.skipped} blank rows skipped` : ""}`);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <div className="stepper">
        <div className="done"><i><Chk size={12} /></i>Choose file</div>
        <div className={sheet ? "cur" : ""}><i>2</i>Map columns</div>
        <div><i>3</i>Import</div>
      </div>
      <div className="card filecard">
        <span className="xl">XLS</span>
        <span><b>{file ? file.name : "Choose an Excel file"}</b><span>{sheet ? `Sheet ${sheet.name} · ${sheet.rows.length} rows · ${sheet.headers.length} columns` : "The shutdown job list (.xlsx, .xls or .csv)"}</span></span>
        <label className="btn sm">{file ? "Change" : "Choose"}<input type="file" accept=".xlsx,.xls,.csv" id="u-file" aria-label="Choose a file" onChange={(e) => pick(e.target.files?.[0])} /></label>
      </div>
      {sheet && sheet.sheets.length > 1 && (
        <div className="field"><label htmlFor="u-sheet">Sheet</label>
          <select id="u-sheet" value={sheet.name} onChange={(e) => pick(file!, e.target.value)}>{sheet.sheets.map((s) => <option key={s}>{s}</option>)}</select></div>
      )}
      {sheet && parsed && (
        <>
          <div className="sec">Sheet column → form field<span className="note">{mapped} of {sheet.headers.length} mapped</span></div>
          <div className="card">
            {sheet.headers.map((h, i) => (
              <div className="maprow" key={i}>
                <span className="col">{h || `Column ${i + 1}`}<small>column {String.fromCharCode(65 + i)}</small></span><Arrow />
                <select aria-label={`Field for ${h}`} className={map[i] === "skip" ? "skip" : ""} value={map[i]} onChange={(e) => setMap(map.map((m, k) => (k === i ? (e.target.value as TaskField) : m)))}>
                  {TASK_FIELDS.map((f) => <option key={f} value={f}>{f === "skip" ? "Skip this column" : f}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="warnbox"><WarnIcon /><span>
            {parsed.skipped} row{parsed.skipped === 1 ? "" : "s"} have no description and will be skipped.
            {parsed.hoursParsed ? ` ${parsed.hoursParsed} durations written like “4 hrs” will be read as numbers.` : ""}
            {parsed.filledDown ? ` Responsible is merged across rows, so it is filled down (${parsed.filledDown} rows).` : ""}
            {` ${matches} row${matches === 1 ? "" : "s"} match${matches === 1 ? "es an" : " existing"} task${matches === 1 ? "" : "s"} and update${matches === 1 ? "s it" : " them"} as a new version.`}
          </span></div>
          <div className="sec">Preview · first 3 of {parsed.tasks.length} tasks</div>
          <div className="card prev"><table>
            <thead><tr><th>Section</th><th>Work description</th><th>Planned hours</th><th>Responsible</th></tr></thead>
            <tbody>{parsed.tasks.slice(0, 3).map((t) => <tr key={t.row}><td>{t.section}</td><td>{t.work_description}</td><td className="num">{t.planned_hours ?? "–"}</td><td>{t.responsible || "–"}</td></tr>)}</tbody>
          </table></div>
          <button className="btn primary block" type="button" disabled={busy || !ready} onClick={run}>{busy ? "Importing…" : `Import ${parsed.tasks.length} tasks`}</button>
          {!map.includes("Work description") && <div className="note">Map one column to “Work description” to continue.</div>}
        </>
      )}
    </>
  );
}
