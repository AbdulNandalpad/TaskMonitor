"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Person, Section, Task } from "@/lib/types";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

export function EditTask({ task, sections, persons }: { task: Task; sections: Section[]; persons: Person[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const v = task.values;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (k: string, old: unknown) => (f.get(k) === "" ? (old ?? null) : Number(f.get(k)));
    const values = {
      ...v,
      work_description: String(f.get("desc")).trim() || v.work_description,
      planned_hours: num("hrs", v.planned_hours), manpower: num("man", v.manpower), vendor: String(f.get("ven")).trim(),
    };
    setBusy(true);
    const res = await fetch(`/api/tasks/${task.id}/edit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values, section_id: f.get("sec"), responsible_person_id: f.get("resp") || null, source: "app_edit" }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return toast(j.error ?? "Could not save");
    setOpen(false);
    if (!j.changed) return toast("No changes made");
    router.refresh();
    toast(`Saved as version ${j.version} · ${j.changed} field${j.changed === 1 ? "" : "s"} changed`);
  }

  return (
    <>
      <button className="btn sm" type="button" onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <Sheet title="Edit task" onClose={() => setOpen(false)}>
          <form onSubmit={save} style={{ display: "grid", gap: 12 }}>
            <div className="note">Changes are saved as version {task.version + 1}. Version {task.version} stays in the history with its values.</div>
            <div className="field"><label htmlFor="e-desc">Work description</label><textarea id="e-desc" name="desc" defaultValue={v.work_description} /></div>
            <div className="two">
              <div className="field"><label htmlFor="e-hrs">Planned hours</label><input id="e-hrs" name="hrs" type="number" step="0.5" defaultValue={v.planned_hours ?? ""} /></div>
              <div className="field"><label htmlFor="e-man">Manpower</label><input id="e-man" name="man" type="number" defaultValue={v.manpower ?? ""} /></div>
            </div>
            <div className="field"><label htmlFor="e-sec">Section</label>
              <select id="e-sec" name="sec" defaultValue={task.section_id ?? ""}>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="field"><label htmlFor="e-resp">Responsible</label>
              <select id="e-resp" name="resp" defaultValue={task.responsible_person_id ?? ""}><option value="">Unassigned</option>{persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label htmlFor="e-ven">Vendor</label><input id="e-ven" name="ven" defaultValue={v.vendor ?? ""} placeholder="In‑house" /></div>
            <div className="acts">
              <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn primary" type="submit" disabled={busy}>Save as v{task.version + 1}</button>
            </div>
          </form>
        </Sheet>
      )}
    </>
  );
}
