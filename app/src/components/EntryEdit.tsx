"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

/** Edit action for a remark the user may correct, plus the "edited" chip that reveals the original text. */
export function EntryEdit({
  updateId, text, canEdit, editCount, original, editedWhen, editedBy,
}: {
  updateId: string; text: string; canEdit: boolean; editCount: number; original: string | null; editedWhen: string | null; editedBy: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [value, setValue] = useState(text);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return setError("Type a remark first.");
    setBusy(true);
    const res = await fetch(`/api/updates/${updateId}/correct`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: value.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(j.error ?? "Could not save the correction");
    setOpen(false); setError(null);
    router.refresh();
    toast(j.pending ? "Remark corrected · English translation needs the voice service" : j.translated ? "Remark corrected · saved in English" : "Remark corrected · the original is kept");
  }

  if (!canEdit && !editCount) return null;
  return (
    <div className="entry-meta">
      {editCount > 0 && (
        <button type="button" className="chip" aria-expanded={showOriginal} onClick={() => setShowOriginal(!showOriginal)} title="Show the original text">
          edited{editedWhen ? ` · ${editedWhen}` : ""}
        </button>
      )}
      {canEdit && <button type="button" className="linkbtn" onClick={() => { setValue(text); setOpen(true); }}>Edit</button>}
      {showOriginal && original != null && (
        <div className="orig"><b>Original{editedBy ? ` (edited by ${editedBy})` : ""}:</b> {original}</div>
      )}
      {open && (
        <Sheet title="Correct remark" onClose={() => setOpen(false)}>
          <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
            <div className="field">
              <label htmlFor={`entry-${updateId}`}>Remark</label>
              <textarea id={`entry-${updateId}`} value={value} onChange={(e) => { setValue(e.target.value); setError(null); }} rows={5} autoFocus />
            </div>
            {error && <div className="errbox" role="alert"><span>{error}</span></div>}
            <div className="note">The corrected text replaces what is shown. The original is kept and the entry is marked as edited.</div>
            <div className="acts">
              <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save correction"}</button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
}
