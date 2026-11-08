"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as XLSX from "xlsx";
import { parseLimitRows, type Limit } from "@/lib/fa/evaluate";

async function send(url: string, method: "POST" | "DELETE", body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: j.error ?? "Could not save" };
  } catch {
    return { ok: false, error: "Could not reach the server." };
  }
}

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  return m ? <div className={`fa-banner ${m.ok ? "good" : "err"}`} role={m.ok ? "status" : "alert"} style={{ marginTop: 10 }}>{m.text}</div> : null;
}

// ------------------------------------------------------------------ converters
export function ConverterForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await send("/api/furnace/converters", "POST", { code: f.get("code"), name: f.get("name"), plant: f.get("plant") });
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error! });
    if (r.ok) router.refresh();
  }
  return (
    <form onSubmit={submit}>
      <div className="fa-form">
        <label>Converter code<input name="code" placeholder="1" required /></label>
        <label>Name<input name="name" placeholder="JSW SMS4 Converter 1" required /></label>
        <label>Plant<input name="plant" placeholder="JSW SMS4" /></label>
      </div>
      <button className="fa-btn" type="submit">Add or rename converter</button>
      <Msg m={msg} />
    </form>
  );
}

// ------------------------------------------------------------------ limits
type Row = { zone: string; metric: "avg" | "min"; warn: string; crit: string; recW: string; recC: string };
const toRow = (l: Limit): Row => ({ zone: l.zone, metric: l.metric, warn: l.warn_below == null ? "" : String(l.warn_below), crit: l.critical_below == null ? "" : String(l.critical_below), recW: l.rec_warning ?? "", recC: l.rec_critical ?? "" });
const blank = (): Row => ({ zone: "*", metric: "min", warn: "", crit: "", recW: "", recC: "" });

export function LimitsEditor({ converterId, initial, zones, sections }: { converterId: string; initial: Limit[]; zones: string[]; sections: string[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial.length ? initial.map(toRow) : [blank()]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  function template() {
    const data = [
      ["Zone", "Metric", "Warning below (mm)", "Critical below (mm)", "Recommendation (warning)", "Recommendation (critical)"],
      ["*", "Minimum", "", "", "", ""],
      ["Tapside", "Average", "", "", "", ""],
      ["ChargePad-1A", "Minimum", "", "", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Limits");
    XLSX.writeFile(wb, "furnace-analysis-limits-template.xlsx");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      const { rows: parsed, problems } = parseLimitRows(aoa);
      if (problems.length) return setMsg({ ok: false, text: problems.slice(0, 4).join(" · ") });
      if (!parsed.length) return setMsg({ ok: false, text: "No limit rows were found in the file." });
      setRows(parsed.map(toRow));
      setMsg({ ok: true, text: `${parsed.length} rows loaded from the file. Check them, then save.` });
    } catch {
      setMsg({ ok: false, text: "The file could not be read. Use the template." });
    }
  }

  async function save() {
    setBusy(true); setMsg(null);
    const payload = rows.filter((r) => r.warn.trim() !== "" || r.crit.trim() !== "").map((r) => ({
      zone: r.zone.trim() || "*", metric: r.metric, warn_below: r.warn.trim() === "" ? null : Number(r.warn), critical_below: r.crit.trim() === "" ? null : Number(r.crit),
      rec_warning: r.recW.trim() || null, rec_critical: r.recC.trim() || null,
    }));
    if (!payload.length) { setBusy(false); return setMsg({ ok: false, text: "Give at least one warning or critical level." }); }
    const r = await send("/api/furnace/limits", "POST", { converter_id: converterId, note, rows: payload });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved as a new version. Scans uploaded from now on are judged with it." } : { ok: false, text: r.error! });
    if (r.ok) { setNote(""); router.refresh(); }
  }

  return (
    <>
      <datalist id="fa-zones">{["*", ...sections, ...zones].map((z) => <option key={z} value={z} />)}</datalist>
      <div className="fa-tablewrap"><table className="fa-tbl">
        <thead><tr><th>Zone, section or *</th><th>Metric</th><th className="n">Warning below (mm)</th><th className="n">Critical below (mm)</th><th>Recommendation (warning)</th><th>Recommendation (critical)</th><th></th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>
            <td><input className="fa-in" list="fa-zones" value={r.zone} onChange={(e) => set(i, "zone", e.target.value)} aria-label="Zone" /></td>
            <td><select className="fa-in" value={r.metric} onChange={(e) => set(i, "metric", e.target.value)} aria-label="Metric"><option value="min">Minimum</option><option value="avg">Average</option></select></td>
            <td><input className="fa-in num" inputMode="decimal" value={r.warn} onChange={(e) => set(i, "warn", e.target.value)} aria-label="Warning below" /></td>
            <td><input className="fa-in num" inputMode="decimal" value={r.crit} onChange={(e) => set(i, "crit", e.target.value)} aria-label="Critical below" /></td>
            <td><input className="fa-in" value={r.recW} onChange={(e) => set(i, "recW", e.target.value)} aria-label="Recommendation for warning" /></td>
            <td><input className="fa-in" value={r.recC} onChange={(e) => set(i, "recC", e.target.value)} aria-label="Recommendation for critical" /></td>
            <td><button type="button" className="fa-btn sm" onClick={() => setRows((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : [blank()]))} aria-label="Remove row">Remove</button></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="fa-actions" style={{ marginTop: 12 }}>
        <button type="button" className="fa-btn" onClick={() => setRows((r) => [...r, blank()])}>Add row</button>
        <button type="button" className="fa-btn" onClick={template}>Download Excel template</button>
        <label className="fa-btn" style={{ cursor: "pointer" }}>Upload Excel or CSV<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      <div className="fa-form" style={{ marginTop: 14 }}>
        <label>Note for this version (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="for example: limits agreed with refractory team" maxLength={300} /></label>
      </div>
      <button type="button" className="fa-btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save as new version"}</button>
      <Msg m={msg} />
    </>
  );
}

// ------------------------------------------------------------------ recipients
type Rec = { id: string; converter_id: string | null; name: string; email: string; min_severity: "warning" | "critical"; active: boolean };

export function RecipientsEditor({ converters, initial }: { converters: { id: string; name: string }[]; initial: Rec[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const r = await send("/api/furnace/recipients", "POST", { name: f.get("name"), email: f.get("email"), converter_id: f.get("converter") || null, min_severity: f.get("sev"), active: true });
    setMsg(r.ok ? { ok: true, text: "Added." } : { ok: false, text: r.error! });
    if (r.ok) { form.reset(); router.refresh(); }
  }
  async function patch(r: Rec, p: Partial<Rec>) {
    const next = { ...r, ...p };
    const x = await send("/api/furnace/recipients", "POST", { id: r.id, name: next.name, email: next.email, converter_id: next.converter_id, min_severity: next.min_severity, active: next.active });
    if (!x.ok) setMsg({ ok: false, text: x.error! }); else router.refresh();
  }
  async function remove(r: Rec) {
    const x = await send("/api/furnace/recipients", "DELETE", { id: r.id });
    if (!x.ok) setMsg({ ok: false, text: x.error! }); else router.refresh();
  }
  return (
    <>
      {initial.length > 0 && (
        <div className="fa-tablewrap"><table className="fa-tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Converter</th><th>Send from</th><th>Active</th><th></th></tr></thead>
          <tbody>{initial.map((r) => (
            <tr key={r.id}>
              <td>{r.name || "–"}</td><td>{r.email}</td><td>{converters.find((c) => c.id === r.converter_id)?.name ?? "All"}</td>
              <td><select className="fa-in" value={r.min_severity} onChange={(e) => patch(r, { min_severity: e.target.value as Rec["min_severity"] })} aria-label="Minimum severity"><option value="warning">Warning and critical</option><option value="critical">Critical only</option></select></td>
              <td><input type="checkbox" checked={r.active} onChange={(e) => patch(r, { active: e.target.checked })} aria-label={`${r.email} active`} /></td>
              <td><button type="button" className="fa-btn sm" onClick={() => remove(r)}>Delete</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <form onSubmit={add} style={{ marginTop: 14 }}>
        <div className="fa-form">
          <label>Name<input name="name" /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Converter<select name="converter" defaultValue=""><option value="">All converters</option>{converters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Send from<select name="sev" defaultValue="warning"><option value="warning">Warning and critical</option><option value="critical">Critical only</option></select></label>
        </div>
        <button className="fa-btn" type="submit">Add recipient</button>
      </form>
      <Msg m={msg} />
    </>
  );
}

// ------------------------------------------------------------------ roles
export function RolesForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await send("/api/furnace/roles", "POST", { login: f.get("login"), role: f.get("role") });
    setMsg(r.ok ? { ok: true, text: "Role saved." } : { ok: false, text: r.error! });
  }
  return (
    <form onSubmit={submit}>
      <div className="fa-form">
        <label>User ID<input name="login" placeholder="ravi.k" required /></label>
        <label>Role<select name="role" defaultValue="analyst"><option value="analyst">Analyst (can upload)</option><option value="admin">Administrator</option><option value="viewer">Viewer</option><option value="none">No extra role</option></select></label>
      </div>
      <button className="fa-btn" type="submit">Save role</button>
      <Msg m={msg} />
    </form>
  );
}
