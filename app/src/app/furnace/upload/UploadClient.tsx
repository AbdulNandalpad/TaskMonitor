"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Zone = { zone: string; section: string; avg_mm: number; min_mm: number; angle: string; depth: string };
type Draft = {
  plant: string; converter_code: string; converter_name: string; campaign_no: number; heat: string; meas_no: number; scanned_at: string;
  steel_level_m: number | null; steel_tonnes: number | null; bath_level_m: number | null; zones: Zone[]; warnings: string[]; blockers: string[];
};
type State = "uploading" | "reading" | "review" | "saving" | "saved" | "duplicate" | "error";
type Item = {
  id: string; name: string; size?: number; state: State;
  draft?: Draft; token?: string; key?: string; bytes?: number; error?: string; duplicateId?: string | null;
  result?: { id: string; severity: string; counts: { critical: number; warning: number; ok: number; unset: number }; limitVersion: number | null; mail: { sent: number; failed: number; skipped: number; recipients: number } };
};

const MAX = 15 * 1024 * 1024;
const CHIP: Record<State, { label: string; cls: string }> = {
  uploading: { label: "Uploading", cls: "busy" }, reading: { label: "Reading", cls: "busy" }, review: { label: "Ready to confirm", cls: "ready" },
  saving: { label: "Saving", cls: "busy" }, saved: { label: "Saved", cls: "ok" }, duplicate: { label: "Already saved", cls: "warn" }, error: { label: "Failed", cls: "err" },
};
const mb = (n?: number) => (n ? `${(n / 1048576).toFixed(1)} MB` : "");

export function UploadClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  /** Remove the file from the list and, if it was never saved, the PDF that was uploaded for it. */
  async function discard(it: Item) {
    setItems((xs) => xs.filter((x) => x.id !== it.id));
    if (it.key && it.state !== "saved") { try { await createClient().storage.from("fa-reports").remove([it.key]); } catch { /* the file may stay; it is private and unused */ } }
  }

  /** The server reads the stored PDF and signs what it read; the readings cannot be changed on this screen. */
  async function read(id: string, key: string) {
    patch(id, { state: "reading", error: undefined, draft: undefined });
    try {
      const res = await fetch("/api/furnace/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return patch(id, { state: "error", key, error: `${j.error ?? "The report could not be read"}${j.detail ? ` (${j.detail})` : ""}` });
      patch(id, { state: j.duplicate_id ? "duplicate" : "review", draft: j.draft, token: j.token, bytes: j.pdf_bytes, duplicateId: j.duplicate_id ?? null });
    } catch {
      patch(id, { state: "error", key, error: "Could not reach the server. Try again." });
    }
  }

  async function process(file: File) {
    const id = crypto.randomUUID();
    setItems((xs) => [...xs, { id, name: file.name, size: file.size, state: "uploading" }]);
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

  async function onFiles(files: FileList | File[] | null) {
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
      <div
        className={`fa-drop${over ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
      >
        <svg className="fa-drop-ic" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M12 17v-6m0 0-2.5 2.5M12 11l2.5 2.5" /></svg>
        <b>Drop vendor report PDFs here</b>
        <div className="fa-note" style={{ margin: "4px 0 12px" }}>Six pages per heat, up to 15 MB each. You can choose several.</div>
        <button type="button" className="fa-btn primary" onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} aria-label="Choose report PDFs" />
      </div>

      {items.length > 0 && <h3 className="fa-section">Files</h3>}
      {items.map((it) => (
        <section key={it.id} className="fa-card fa-file">
          <div className="fa-file-head">
            <div className="fa-file-name"><b>{it.name}</b>{it.size ? <small>{mb(it.size)}</small> : null}</div>
            <span className={`fa-chip ${CHIP[it.state].cls}`}>{CHIP[it.state].label}</span>
          </div>

          {(it.state === "uploading" || it.state === "reading") && <Busy it={it} />}

          {it.state === "error" && (
            <>
              <div className="fa-banner err" role="alert">{it.error}</div>
              <div className="fa-actions">
                {it.key && <button type="button" className="fa-btn" onClick={() => read(it.id, it.key!)}>Read again</button>}
                <button type="button" className="fa-btn" onClick={() => discard(it)}>Remove</button>
              </div>
            </>
          )}

          {it.state === "duplicate" && it.draft && (
            <div className="fa-dup">
              <p style={{ margin: 0 }}>Heat <b>{it.draft.heat}</b>, measurement <b>{it.draft.meas_no}</b> of campaign {it.draft.campaign_no} ({it.draft.scanned_at.slice(0, 10)}) is already in the system, so it will not be saved again.</p>
              <div className="fa-actions">
                {it.duplicateId && <Link className="fa-btn" href={`/furnace/scans/${it.duplicateId}`}>Open the saved scan</Link>}
                <button type="button" className="fa-btn" onClick={() => discard(it)}>Remove</button>
              </div>
            </div>
          )}

          {(it.state === "review" || it.state === "saving") && it.draft && (
            <Review it={it} onSave={() => save(it)} onReread={() => read(it.id, it.key!)} onDiscard={() => discard(it)} />
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

/** Spinner with the step the file is at: 1 uploading the PDF, 2 reading it. */
function Busy({ it }: { it: Item }) {
  const up = it.state === "uploading";
  return (
    <div className="fa-busy" role="status" aria-live="polite">
      <span className="fa-spin" aria-hidden="true" />
      <div>
        <b>{up ? `Uploading the PDF${it.size ? ` (${mb(it.size)})` : ""}…` : "Reading the report…"}</b>
        <div className="fa-note" style={{ margin: "2px 0 0" }}>{up ? "Step 1 of 2. Keep this page open until the upload finishes." : "Step 2 of 2. This takes about half a minute."}</div>
        <div className="fa-steps"><i className="on" /><i className={up ? "" : "on"} /></div>
      </div>
    </div>
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
      <p className="fa-note">These readings were taken from the PDF and cannot be changed here. Compare them with the PDF; if they are wrong, press Read again.</p>
      <dl className="fa-facts">
        <div><dt>Plant</dt><dd>{d.plant || "–"}</dd></div>
        <div><dt>Converter</dt><dd>{d.converter_code || "–"}</dd></div>
        <div><dt>Campaign</dt><dd>{Number.isFinite(d.campaign_no) ? d.campaign_no : "–"}</dd></div>
        <div><dt>Heat</dt><dd>{d.heat || "–"}</dd></div>
        <div><dt>Measurement no.</dt><dd>{Number.isFinite(d.meas_no) ? d.meas_no : "–"}</dd></div>
        <div><dt>Scan date and time (India)</dt><dd>{d.scanned_at ? d.scanned_at.slice(0, 16).replace("T", " ") : "–"}</dd></div>
      </dl>
      <details className="fa-readings" open>
        <summary>{d.zones.length} zone readings</summary>
        <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Zone readings taken from the PDF"><table className="fa-tbl">
          <thead><tr><th>Zone</th><th>Section</th><th className="n">Average (mm)</th><th className="n">Minimum (mm)</th></tr></thead>
          <tbody>{d.zones.map((z) => (
            <tr key={z.zone}><td><b>{z.zone}</b></td><td>{z.section}</td><td className="n">{z.avg_mm}</td><td className="n">{z.min_mm}</td></tr>
          ))}</tbody>
        </table></div>
      </details>
      {it.error && <div className="fa-banner err" role="alert" style={{ marginTop: 12 }}>{it.error}</div>}
      <div className="fa-actions" style={{ marginTop: 16 }}>
        <button type="button" className="fa-btn primary" onClick={onSave} disabled={busy || blocked}>{busy ? "Saving…" : "Confirm and save"}</button>
        <button type="button" className="fa-btn" onClick={onReread} disabled={busy}>Read again</button>
        <button type="button" className="fa-btn" onClick={onDiscard} disabled={busy}>Remove</button>
      </div>
    </>
  );
}
