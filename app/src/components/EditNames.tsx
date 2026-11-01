"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Person, Section, TaskList } from "@/lib/types";
import { Pen } from "./Icons";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

/* CR-6: small edit sheets for names and labels. The pencil buttons are only rendered for roles that may edit; the database
   enforces the same rule, so a direct update by anyone else is refused. */

async function save(kind: string, id: string, body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/edit/${kind}/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  return res.ok ? null : j.error ?? "Could not save";
}

function useSheetForm(kind: string, id: string, done: string) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>, build: (f: FormData) => Record<string, unknown>) {
    e.preventDefault();
    setBusy(true);
    const err = await save(kind, id, build(new FormData(e.currentTarget)));
    setBusy(false);
    if (err) return setError(err);
    setOpen(false); setError(null);
    router.refresh();
    toast(done);
  }
  return { open, setOpen, error, setError, busy, submit };
}

const Pencil = ({ label, onClick, text }: { label: string; onClick: () => void; text?: string }) => (
  <button type="button" className={text ? "btn sm" : "iconbtn pencil"} aria-label={label} title={label} onClick={onClick}><Pen />{text}</button>
);
const Err = ({ msg }: { msg: string | null }) => (msg ? <div className="errbox" role="alert"><span>{msg}</span></div> : null);
const dateOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");

/** Task list ("the main task"): name, start and end dates, planned hours. Managers and area admins. */
export function EditList({ list }: { list: TaskList }) {
  const f = useSheetForm("list", list.id, "Task list updated");
  return (
    <>
      <Pencil label="Edit task list" onClick={() => f.setOpen(true)} />
      {f.open && (
        <Sheet title="Edit task list" onClose={() => f.setOpen(false)}>
          <form onSubmit={(e) => f.submit(e, (d) => ({ name: d.get("name"), starts_at: d.get("starts"), ends_at: d.get("ends"), planned_hours: d.get("hours") }))} style={{ display: "grid", gap: 12 }}>
            <div className="field"><label htmlFor="l-name">Name</label><input id="l-name" name="name" defaultValue={list.name} required maxLength={120} /></div>
            <div className="two">
              <div className="field"><label htmlFor="l-start">Start date</label><input id="l-start" name="starts" type="date" defaultValue={dateOf(list.starts_at)} /></div>
              <div className="field"><label htmlFor="l-end">End date</label><input id="l-end" name="ends" type="date" defaultValue={dateOf(list.ends_at)} /></div>
            </div>
            <div className="field"><label htmlFor="l-hours">Planned hours</label><input id="l-hours" name="hours" type="number" step="0.5" min={0} defaultValue={list.planned_hours ?? ""} /></div>
            <Err msg={f.error} />
            <div className="note">Every change is recorded with the old and new value.</div>
            <div className="acts"><button className="btn" type="button" onClick={() => f.setOpen(false)}>Cancel</button><button className="btn primary" type="submit" disabled={f.busy}>Save</button></div>
          </form>
        </Sheet>
      )}
    </>
  );
}

/** Area name. Area admins only. */
export function EditArea({ area }: { area: { id: string; name: string } }) {
  const f = useSheetForm("area", area.id, "Area name updated");
  return (
    <>
      <Pencil label="Rename area" onClick={() => f.setOpen(true)} />
      {f.open && (
        <Sheet title="Rename area" onClose={() => f.setOpen(false)}>
          <form onSubmit={(e) => f.submit(e, (d) => ({ name: d.get("name") }))} style={{ display: "grid", gap: 12 }}>
            <div className="field"><label htmlFor="a-name">Area name</label><input id="a-name" name="name" defaultValue={area.name} required maxLength={120} /></div>
            <Err msg={f.error} />
            <div className="note">The new name shows everywhere at once: dashboard, sections, tasks and reports.</div>
            <div className="acts"><button className="btn" type="button" onClick={() => f.setOpen(false)}>Cancel</button><button className="btn primary" type="submit" disabled={f.busy}>Save</button></div>
          </form>
        </Sheet>
      )}
    </>
  );
}

/** Section name and head person. `inline` renders a text button for lists, otherwise a pencil icon. */
export function EditSection({ section, persons, inline }: { section: Pick<Section, "id" | "name" | "head_person_id">; persons: Person[]; inline?: boolean }) {
  const f = useSheetForm("section", section.id, "Section updated");
  return (
    <>
      <Pencil label={`Edit section ${section.name}`} text={inline ? "Edit" : undefined} onClick={() => f.setOpen(true)} />
      {f.open && (
        <Sheet title="Edit section" onClose={() => f.setOpen(false)}>
          <form onSubmit={(e) => f.submit(e, (d) => ({ name: d.get("name"), head_person_id: d.get("head") || null }))} style={{ display: "grid", gap: 12 }}>
            <div className="field"><label htmlFor="s-name">Section name</label><input id="s-name" name="name" defaultValue={section.name} required maxLength={120} /></div>
            <div className="field"><label htmlFor="s-head">Head of section</label>
              <select id="s-head" name="head" defaultValue={section.head_person_id ?? ""}><option value="">None</option>{persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <Err msg={f.error} />
            <div className="note">Every task in this section shows the new name at once.</div>
            <div className="acts"><button className="btn" type="button" onClick={() => f.setOpen(false)}>Cancel</button><button className="btn primary" type="submit" disabled={f.busy}>Save</button></div>
          </form>
        </Sheet>
      )}
    </>
  );
}

/** Person details; opened from the workforce list. */
export function EditPersonSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    const err = await save("person", person.id, { name: d.get("name"), role_title: d.get("role"), phone: d.get("phone"), team_size: d.get("team") });
    setBusy(false);
    if (err) return setError(err);
    onClose(); router.refresh(); toast("Person updated");
  }
  return (
    <Sheet title="Edit person" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div className="field"><label htmlFor="pe-name">Name</label><input id="pe-name" name="name" defaultValue={person.name} required maxLength={120} /></div>
        <div className="field"><label htmlFor="pe-role">Role</label><input id="pe-role" name="role" defaultValue={person.role_title ?? ""} /></div>
        <div className="two">
          <div className="field"><label htmlFor="pe-phone">Phone</label><input id="pe-phone" name="phone" type="tel" defaultValue={person.phone ?? ""} /></div>
          <div className="field"><label htmlFor="pe-team">Team size</label><input id="pe-team" name="team" type="number" min={0} defaultValue={person.team_size ?? ""} /></div>
        </div>
        <Err msg={error} />
        <div className="note">Every change is recorded with the old and new value.</div>
        <div className="acts"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={busy}>Save</button></div>
      </form>
    </Sheet>
  );
}

/** Form settings → Sections: the list of sections with an Edit action each. */
export function SectionsCard({ sections, persons }: { sections: Section[]; persons: Person[] }) {
  const head = new Map(persons.map((p) => [p.id, p.name]));
  return (
    <>
      <div className="sec">Sections · {sections.length}<span className="note">Rename a section or change its head</span></div>
      <div className="card">
        {sections.map((s) => (
          <div className="frow" key={s.id} style={{ gridTemplateColumns: "1fr auto" }}>
            <span><b>{s.name}</b><small>{s.head_person_id ? `Head: ${head.get(s.head_person_id) ?? "–"}` : "No head set"}</small></span>
            <EditSection section={s} persons={persons} inline />
          </div>
        ))}
      </div>
    </>
  );
}
