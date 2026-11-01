"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pdf } from "./Icons";
import { Sheet } from "./Sheet";

/**
 * "Generate" on the dashboard: Summary report (opens at once) or Detailed report (first fills the AI work summaries that
 * are missing or out of date, a few tasks at a time with a progress bar, then opens the report).
 */
export function GenerateReport({ listId }: { listId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function detailed() {
    setBusy(true); setProblem(null); setProgress(null);
    try {
      let guard = 0;
      for (;;) {
        const res = await fetch(`/api/report/${listId}/summaries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 6 }) });
        const j = await res.json().catch(() => ({}));
        if (res.status === 503) { setProblem("AI summaries are not set up yet, so the report will show tasks without a summary."); setBusy(false); return; }
        if (!res.ok) { setProblem(j.error ?? "Could not prepare the summaries."); setBusy(false); return; }
        setProgress({ done: j.total - j.pending, total: j.total });
        if (!j.pending) break;
        if (!j.generated || ++guard > 60) { setProblem(`${j.pending} summaries could not be written. The report will show those tasks without one.`); setBusy(false); return; }
      }
      router.push(`/report/${listId}/detailed`);
    } catch {
      setProblem("Could not reach the server. Try again."); setBusy(false);
    }
  }

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  return (
    <>
      <div className="card pad generate">
        <h3>Reports</h3>
        <p className="note">Summary for a quick status, detailed with timeline, work summary and photos for each task.</p>
        <button className="btn primary" type="button" onClick={() => setOpen(true)}><Pdf />Generate report</button>
      </div>
      {open && (
        <Sheet title="Generate report" onClose={() => !busy && setOpen(false)}>
          <div className="choices">
            <button type="button" className="choice" disabled={busy} onClick={() => router.push(`/report/${listId}`)}>
              <b>Summary report</b><span>Three pages: compliance by section, open items, photo selection. Ready at once.</span>
            </button>
            <button type="button" className="choice" disabled={busy} onClick={detailed}>
              <b>Detailed report</b><span>One block per task with start, end, duration, an AI-written work summary and its photos. Also as Excel.</span>
            </button>
          </div>
          {busy && (
            <div role="status" aria-live="polite" className="gen-progress">
              <div className="note">{progress ? `Writing work summaries · ${progress.done} of ${progress.total} tasks ready` : "Preparing the evidence…"}</div>
              <div className="bar"><i className="g" style={{ width: `${pct}%` }} /></div>
            </div>
          )}
          {problem && (
            <div className="warnbox" role="alert">
              <span>{problem}</span>
            </div>
          )}
          {problem && <div className="acts"><button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary" type="button" onClick={() => router.push(`/report/${listId}/detailed`)}>Open report anyway</button></div>}
        </Sheet>
      )}
    </>
  );
}
