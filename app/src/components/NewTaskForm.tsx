"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Person, Section } from "@/lib/types";
import { useToast } from "./Toast";

export function NewTaskForm({ listId, sections, persons }: { listId: string; sections: Section[]; persons: Person[] }) {
  const router = useRouter();
  const toast = useToast();
  const [photo, setPhoto] = useState(true);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const desc = String(f.get("desc")).trim();
    if (!desc) return toast("Work description is required");
    setBusy(true);
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        list_id: listId, section_id: f.get("sec"), responsible_person_id: f.get("resp") || null,
        values: { work_description: desc, planned_hours: Number(f.get("hrs")) || 0, manpower: Number(f.get("man")) || 0, vendor: String(f.get("ven")).trim(), photo_on_completion: photo },
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return toast(j.error ?? "Could not create the task");
    const who = persons.find((p) => p.id === f.get("resp"));
    toast(`Task ${j.seq} created${who ? ` · ${who.name} notified` : ""}`);
    router.push(`/tasks/${j.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
      <div className="card pad" style={{ display: "grid", gap: 12 }}>
        <div className="field"><label htmlFor="n-sec">Section <span className="req">*</span></label>
          <select id="n-sec" name="sec">{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label htmlFor="n-desc">Work description <span className="req">*</span></label>
          <textarea id="n-desc" name="desc" placeholder="What has to be done, where" required /></div>
        <div className="two">
          <div className="field"><label htmlFor="n-hrs">Planned hours</label><input id="n-hrs" name="hrs" type="number" step="0.5" defaultValue={8} /></div>
          <div className="field"><label htmlFor="n-man">Manpower</label><input id="n-man" name="man" type="number" defaultValue={6} /></div>
        </div>
        <div className="field"><label htmlFor="n-ven">Vendor</label><input id="n-ven" name="ven" placeholder="In‑house" /></div>
        <div className="field"><label htmlFor="n-resp">Responsible <span className="req">*</span></label>
          <select id="n-resp" name="resp" defaultValue=""><option value="">Unassigned</option>{persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="switch"><div className="lbl"><b>Photo required on completion</b><span>From form settings · can be changed per task</span></div>
          <button className="tog" type="button" role="switch" aria-checked={photo} aria-label="Photo required" onClick={() => setPhoto(!photo)} /></div>
      </div>
      <div className="note" style={{ padding: "0 4px" }}>Fields come from the Shutdown jobs form. Change them in Form settings.</div>
      <button className="btn primary block" type="submit" disabled={busy}>Create task</button>
    </form>
  );
}
