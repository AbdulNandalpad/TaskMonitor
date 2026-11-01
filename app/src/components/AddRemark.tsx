"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postUpdate } from "@/lib/upload";
import { Pen } from "./Icons";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

/** Typed remark, no microphone. Saves a `note` update; status and progress are not touched. */
export function AddRemark({ taskId, variant }: { taskId: string; variant: "tile" | "button" }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError("Type a remark first.");
    setBusy(true);
    try {
      await postUpdate(taskId, { type: "note", text: text.trim() });
      setOpen(false); setText(""); setError(null);
      router.refresh();
      toast("Remark added");
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <>
      {variant === "tile" ? (
        <button type="button" className="ph add" onClick={() => setOpen(true)} aria-label="Add remark">+ Remark</button>
      ) : (
        <button type="button" className="btn sm" onClick={() => setOpen(true)}><Pen />Add remark</button>
      )}
      {open && (
        <Sheet title="Add remark" onClose={() => setOpen(false)}>
          <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
            <div className="field">
              <label htmlFor="remark-text">Remark</label>
              <textarea id="remark-text" value={text} onChange={(e) => { setText(e.target.value); setError(null); }} rows={5} autoFocus
                placeholder="What should the next person know?" />
            </div>
            {error && <div className="errbox" role="alert"><span>{error}</span></div>}
            <div className="note">Saved with your name and the time. Status and progress are not changed.</div>
            <div className="acts">
              <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save remark"}</button>
            </div>
          </form>
        </Sheet>
      )}
    </>
  );
}
