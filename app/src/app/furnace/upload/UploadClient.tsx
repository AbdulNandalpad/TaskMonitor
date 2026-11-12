"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Zone = { zone: string; section: string; avg_mm: number; min_mm: number; angle: string; depth: string };
type Draft = {
  plant: string; converter_code: string; converter_name: string; campaign_no: number; heat: string; meas_no: number; scanned_at: string;
  steel_level_m: number | null; steel_tonnes: number | null; bath_level_m: number | null; zones: Zone[]; warnings: string[]; blockers: string[];
};
type Item = {
  id: string; name: string; state: "uploading" | "reading" | "review" | "saving" | "saved" | "error";
  draft?: Draft; token?: string; key?: string; bytes?: number; error?: string;
  result?: { id: string; severity: string; counts: { critical: number; warning: number; ok: number; unset: number }; limitVersion: number | null; mail: { sent: number; failed: number; skipped: number; recipients: number } };
};

const MAX = 15 * 1024 * 1024;

export function UploadClient() {
  const [items, setItems] = useState<Item[]>([]);
  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const discard = (id: string) => setItems((xs) => xs.filter((x) => x.id !== id));

  /** The server reads the stored PDF and signs what it read; the readings cannot be changed on this screen. */
  async function read(id: string, key: string) {
    patch(id, { state: "reading", error: undefined, draft: undefined });
    try {
      const res = await fetch("/api/furnace/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return patch(id, { state: "error", key, error: `${j.error ?? "The report could not be read"}${j.detail ? ` (${j.detail})` : ""}` });
      patch(id, { state: "review", draft: j.draft, token: j.token, bytes: j.pdf_bytes });
    } catch {
      patch(id, { state: "error", key, error: "Could not reach the server. Try again." });
    }
  }

  async function process(file: File) {
    const id = crypto.randomUUID();
    setItems((xs) => [...xs, { id, name: file.name, state: "uploading" }]);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return patch(id, { state: "error", error: "This is not a PDF file." });
    if (file.size > MAX) return patch(id, { state: "error", error: "The PDF is larger than 15 MB." });
    try {
      const key = `uploads/${crypto.randomUUID()}.pdf`;
      const up = await createClient().storage.from("fa-reports").upload(key, file, { contentType: "application/pdf", upsert: false });
      if (up.error) return patch(id, { state: "error", error: `Upload failed: ${up.error.message}` });
      patch(id, { key });
      await read(id, key);
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
      const res = await fetch("/api/furnace/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: it.draft, token: it.token, pdf_key: it.key, pdf_bytes: it.bytes }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return patch(it.id, { state: "review", error: j.error ?? "Could not save" });
      patch(it.id, { state: "saved", result: j });
    } catch {
      patch(it.id, { state: "review", error: "Could not reach the server. Try again." });
    }
  }

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
          {it.state === "error" && (
            <>
              <div className="fa-banner err" role="alert">{it.error}</div>
              <div className="fa-actions">
                {it.key && <button type="button" className="fa-btn" onClick={() => read(it.id, it.key!)}>Read again</button>}
                <button type="button" className="fa-btn" onClick={() => discard(it.id)}>Discard</button>
              </div>
            </>
          )}
          {(it.state === "review" || it.state === "saving") && it.draft && (
            <Review it={it} onSave={() => save(it)} onReread={() => read(it.id, it.key!)} onDiscard={() => discard(it.id)} />
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

function Review({ it, onSave, onReread, onDiscard }: { it: Item; onSave: () => void; onReread: () => void; onDiscard: () => void }) {
  const d = it.draft!;
  const blocked = d.blockers.length > 0;
  const busy = it.state === "saving";
  return (
    <>
      {blocked && <div className="fa-banner err" role="alert"><b>This report cannot be saved as read</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{d.blockers.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      {d.warnings.length > 0 && <div className="fa-banner" role="status"><b>Check before saving</b><ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{d.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      <p className="fa-note">These are the readings taken from the PDF. They are read-only and cannot be changed here. Compare them with the PDF; if they are wrong, press Read again.</p>
      <dl className="fa-facts">
        <div><dt>Plant</dt><dd>{d.plant || "–"}</dd></div>
        <div><dt>Converter</dt><dd>{d.converter_code || "–"}</dd></div>
        <div><dt>Campaign</dt><dd>{Number.isFinite(d.campaign_no) ? d.campaign_no : "–"}</dd></div>
        <div><dt>Heat</dt><dd>{d.heat || "–"}</dd></div>
        <div><dt>Measurement no.</dt><dd>{Number.isFinite(d.meas_no) ? d.meas_no : "–"}</dd></div>
        <div><dt>Scan date and time (India)</dt><dd>{d.scanned_at ? d.scanned_at.slice(0, 16).replace("T", " ") : "–"}</dd></div>
      </dl>
      <div className="fa-tablewrap"><table className="fa-tbl">
        <thead><tr><th>Zone</th><th>Section</th><th className="n">Average (mm)</th><th className="n">Minimum (mm)</th></tr></thead>
        <tbody>{d.zones.map((z) => (
          <tr key={z.zone}><td><b>{z.zone}</b></td><td>{z.section}</td><td className="n">{z.avg_mm}</td><td className="n">{z.min_mm}</td></tr>
        ))}</tbody>
      </table></div>
      {it.error && <div className="fa-banner err" role="alert" style={{ marginTop: 12 }}>{it.error}</div>}
      <div className="fa-actions" style={{ marginTop: 14 }}>
        <button type="button" className="fa-btn primary" onClick={onSave} disabled={busy || blocked}>{busy ? "Saving…" : "Confirm and save"}</button>
        <button type="button" className="fa-btn" onClick={onReread} disabled={busy}>Read again</button>
        <button type="button" className="fa-btn" onClick={onDiscard} disabled={busy}>Discard</button>
      </div>
    </>
  );
}
