"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Zone = { zone: string; section: string; avg_mm: number | string; min_mm: number | string; angle: string; depth: string };
type Draft = {
  plant: string; converter_code: string; converter_name: string; campaign_no: number | string; heat: string; meas_no: number | string; scanned_at: string;
  steel_level_m: number | null; steel_tonnes: number | null; bath_level_m: number | null; zones: Zone[]; warnings: string[];
};
type Item = {
  id: string; name: string; state: "uploading" | "reading" | "review" | "saving" | "saved" | "error";
  draft?: Draft; key?: string; bytes?: number; error?: string;
  result?: { id: string; severity: string; counts: { critical: number; warning: number; ok: number; unset: number }; limitVersion: number | null; mail: { sent: number; failed: number; skipped: number; recipients: number } };
};

const MAX = 15 * 1024 * 1024;

export function UploadClient() {
  const [items, setItems] = useState<Item[]>([]);
  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function process(file: File) {
    const id = crypto.randomUUID();
    setItems((xs) => [...xs, { id, name: file.name, state: "uploading" }]);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return patch(id, { state: "error", error: "This is not a PDF file." });
    if (file.size > MAX) return patch(id, { state: "error", error: "The PDF is larger than 15 MB." });
    try {
      const key = `uploads/${crypto.randomUUID()}.pdf`;
      const up = await createClient().storage.from("fa-reports").upload(key, file, { contentType: "application/pdf", upsert: false });
      if (up.error) return patch(id, { state: "error", error: `Upload failed: ${up.error.message}` });
      patch(id, { state: "reading", key });
      const res = await fetch("/api/furnace/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return patch(id, { state: "error", error: `${j.error ?? "The report could not be read"}${j.detail ? ` (${j.detail})` : ""}` });
      patch(id, { state: "review", draft: j.draft, bytes: j.pdf_bytes });
    } catch {
      patch(id, { state: "error", error: "Could not reach the server. Try again." });
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) await process(f); // one at a time: each reading is a model call
  }

  async function save(it: Item) {
    if (!it.draft || !it.key) return;
    patch(it.id, { state: "saving", error: undefined });
    try {
      const res = await fetch("/api/furnace/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: it.draft, pdf_key: it.key, pdf_bytes: it.bytes }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return patch(it.id, { state: "review", error: j.error ?? "Could not save" });
      patch(it.id, { state: "saved", result: j });
    } catch {
      patch(it.id, { state: "review", error: "Could not reach the server. Try again." });
    }
  }

  const setDraft = (id: string, f: (d: Draft) => Draft) => setItems((xs) => xs.map((x) => (x.id === id && x.draft ? { ...x, draft: f(x.draft) } : x)));

  return (
    <>
      <div className="fa-drop">
        <b>Vendor report PDF</b>
        <div className="fa-note">Six pages per heat. Up to 15 MB each.</div>
        <input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} aria-label="Choose report PDFs" />
      </div>

      {items.map((it) => (
        <section key={it.id} className="fa-card" style={{ marginTop: 18 }}>
          <h2>{it.name}</h2>
          {it.state === "uploading" && <p className="fa-note">Uploading…</p>}
          {it.state === "reading" && <p className="fa-note">Reading the report. This takes about half a minute.</p>}
          {it.state === "error" && <div className="fa-banner err" role="alert">{it.error}</div>}
          {(it.state === "review" || it.state === "saving") && it.draft && (
            <Review it={it} setDraft={setDraft} onSave={() => save(it)} />
          )}
          {it.state === "saved" && it.result && (
            <div className="fa-banner good" role="status">
              Saved. {it.result.counts.critical} critical, {it.result.counts.warning} warning, {it.result.counts.ok} OK
              {it.result.counts.unset ? `, ${it.result.counts.unset} without a limit` : ""}
              {it.result.limitVersion ? ` (limits version ${it.result.limitVersion})` : " (no limits set yet)"}.
              {it.result.mail.recipients ? ` Email: ${it.result.mail.sent} sent${it.result.mail.skipped ? `, ${it.result.mail.skipped} not sent because email is not set up` : ""}${it.result.mail.failed ? `, ${it.result.mail.failed} failed` : ""}.` : ""}{" "}
              <Link href={`/furnace/scans/${it.result.id}`}>Open the scan</Link>
            </div>
          )}
        </section>
      ))}
    </>
  );
}

function Review({ it, setDraft, onSave }: { it: Item; setDraft: (id: string, f: (d: Draft) => Draft) => void; onSave: () => void }) {
  const d = it.draft!;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(it.id, (x) => ({ ...x, [k]: v }));
  const setZone = (i: number, k: "avg_mm" | "min_mm", v: string) => setDraft(it.id, (x) => ({ ...x, zones: x.zones.map((z, j) => (j === i ? { ...z, [k]: v } : z)) }));
  return (
    <>
      {d.warnings.length > 0 && <div className="fa-banner" role="status"><b>Check before saving</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{d.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      <p className="fa-note">Compare with the PDF, correct anything that is wrong, then save. Nothing is stored until you do.</p>
      <div className="fa-form">
        <label>Plant<input value={d.plant} onChange={(e) => set("plant", e.target.value)} /></label>
        <label>Converter<input value={d.converter_code} onChange={(e) => set("converter_code", e.target.value)} /></label>
        <label>Campaign<input inputMode="numeric" value={String(d.campaign_no)} onChange={(e) => set("campaign_no", e.target.value)} /></label>
        <label>Heat<input value={d.heat} onChange={(e) => set("heat", e.target.value)} /></label>
        <label>Measurement no.<input inputMode="numeric" value={String(d.meas_no)} onChange={(e) => set("meas_no", e.target.value)} /></label>
        <label>Scan date and time (India)<input type="datetime-local" value={d.scanned_at.slice(0, 16)} onChange={(e) => set("scanned_at", e.target.value ? `${e.target.value}:00+05:30` : "")} /></label>
      </div>
      <div className="fa-tablewrap"><table className="fa-tbl">
        <thead><tr><th>Zone</th><th>Section</th><th className="n">Average (mm)</th><th className="n">Minimum (mm)</th></tr></thead>
        <tbody>{d.zones.map((z, i) => (
          <tr key={z.zone}><td><b>{z.zone}</b></td><td>{z.section}</td>
            <td className="n"><input className="fa-in num" style={{ maxWidth: 110 }} inputMode="decimal" value={String(z.avg_mm)} onChange={(e) => setZone(i, "avg_mm", e.target.value)} aria-label={`${z.zone} average`} /></td>
            <td className="n"><input className="fa-in num" style={{ maxWidth: 110 }} inputMode="decimal" value={String(z.min_mm)} onChange={(e) => setZone(i, "min_mm", e.target.value)} aria-label={`${z.zone} minimum`} /></td></tr>
        ))}</tbody>
      </table></div>
      {it.error && <div className="fa-banner err" role="alert" style={{ marginTop: 12 }}>{it.error}</div>}
      <div className="fa-actions" style={{ marginTop: 14 }}>
        <button type="button" className="fa-btn primary" onClick={onSave} disabled={it.state === "saving"}>{it.state === "saving" ? "Saving…" : "Confirm and save"}</button>
      </div>
    </>
  );
}
