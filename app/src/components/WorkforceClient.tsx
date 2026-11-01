"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HUES, initials } from "@/lib/format";
import { guessWorkforceField, parsePeople, readWorkbook, WORKFORCE_FIELDS, type Sheet as XSheet, type WorkforceField } from "@/lib/excel";
import type { Person } from "@/lib/types";
import { Arrow, Assign, Plus, Xl } from "./Icons";
import { Sheet } from "./Sheet";
import { EditPersonSheet } from "./EditNames";
import { useToast } from "./Toast";

const av = (name: string) => <span className="avatar" style={{ background: HUES[name.length % HUES.length] }}>{initials(name)}</span>;

export function WorkforceClient({ persons, load, unassigned, sections }: { persons: Person[]; load: Record<string, number>; unassigned: number; sections: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<"add" | "upload" | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const vendors = persons.filter((p) => p.kind === "vendor_team").length;

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name")).trim();
    if (!name) return toast("Name is required");
    const res = await fetch("/api/people", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role_title: String(f.get("role")).trim() || null, kind: f.get("type") === "Vendor team" ? "vendor_team" : "employee" }),
    });
    const j = await res.json();
    if (!res.ok) return toast(j.error ?? "Could not add");
    setSheet(null); router.refresh(); toast(`${name} added to this area`);
  }

  return (
    <>
      <div className="tiles">
        <div className="tile accent"><div className="v num">{persons.length}</div><div className="l">People · teams</div></div>
        <div className="tile info"><div className="v num">{vendors}</div><div className="l">Vendor teams</div></div>
        <div className="tile warn"><div className="v num">{unassigned}</div><div className="l">Tasks unassigned</div></div>
      </div>
      <div className="ctl-row">
        <button className="btn primary" type="button" onClick={() => setSheet("upload")}><Xl />Upload from Excel</button>
        <button className="btn" type="button" onClick={() => setSheet("add")}><Plus />Add person</button>
        <Link className="btn m-only" href="/assign"><Assign />Assign tasks</Link>
      </div>
      <div className="sec">People in this area<span className="note">Tap a person to edit</span></div>
      <div className="card">
        {persons.map((p) => (
          <button type="button" className="person" key={p.id} onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
            {av(p.name)}<span><b>{p.name}</b><small>{p.role_title}</small></span>
            <span className={`load num${(load[p.id] ?? 0) > 12 ? " hi" : ""}`}>{load[p.id] ?? 0} tasks</span>
          </button>
        ))}
      </div>
      <div className="note" style={{ padding: "0 4px" }}>People belong to this area. Granting someone access to another area is done by the administrator, not by the person.</div>

      {sheet === "add" && (
        <Sheet title="Add person" onClose={() => setSheet(null)}>
          <form onSubmit={add} style={{ display: "grid", gap: 12 }}>
            <div className="field"><label htmlFor="p-name">Name <span className="req">*</span></label><input id="p-name" name="name" placeholder="Full name" required /></div>
            <div className="field"><label htmlFor="p-role">Role</label><input id="p-role" name="role" placeholder="Designation" /></div>
            <div className="field"><label htmlFor="p-type">Type</label><select id="p-type" name="type"><option>Employee</option><option>Vendor team</option></select></div>
            <div className="acts"><button className="btn" type="button" onClick={() => setSheet(null)}>Cancel</button><button className="btn primary" type="submit">Add to area</button></div>
          </form>
        </Sheet>
      )}
      {editing && <EditPersonSheet person={editing} onClose={() => setEditing(null)} />}
      {sheet === "upload" && <UploadSheet existing={persons.map((p) => p.name)} sections={sections} onClose={() => setSheet(null)} />}
    </>
  );
}

function UploadSheet({ existing, onClose }: { existing: string[]; sections: string[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<XSheet | null>(null);
  const [map, setMap] = useState<WorkforceField[]>([]);
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    try {
      const s = await readWorkbook(f);
      setFile(f); setSheet(s); setMap(s.headers.map(guessWorkforceField));
      toast("File read · columns detected");
    } catch { toast("That file could not be read"); }
  }
  const parsed = sheet ? parsePeople(sheet.rows, map) : null;
  const have = new Set(existing.map((n) => n.toLowerCase()));
  const updated = parsed ? parsed.people.filter((p) => have.has(p.name.toLowerCase())).length : 0;

  async function run() {
    if (!parsed) return;
    setBusy(true);
    const res = await fetch("/api/import/workforce", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ people: parsed.people, filename: file?.name, sheet: sheet?.name, mapping: map, skipped: parsed.skipped }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return toast(j.error ?? "Import failed");
    onClose(); router.refresh();
    toast(`${j.created + j.updated} people imported · ${j.created} new`);
  }

  return (
    <Sheet title="Upload workforce from Excel" onClose={onClose}>
      <div className="card filecard" style={{ border: "1px solid var(--line)" }}>
        <span className="xl">XLS</span>
        <span><b>{file ? file.name : "Choose an Excel file"}</b><span>{sheet ? `Sheet ${sheet.name} · ${sheet.rows.length} rows · ${sheet.headers.length} columns` : "Name, Role, Section, Phone, Vendor team"}</span></span>
        <label className="btn sm">{file ? "Change" : "Choose"}<input type="file" accept=".xlsx,.xls,.csv" aria-label="Choose workforce file" onChange={(e) => pick(e.target.files?.[0])} /></label>
      </div>
      {sheet && parsed && (
        <>
          <div className="sec">Sheet column → person field</div>
          <div className="card">
            {sheet.headers.map((h, i) => (
              <div className="maprow" key={i}>
                <span className="col">{h || `Column ${i + 1}`}<small>column {String.fromCharCode(65 + i)}</small></span><Arrow />
                <select aria-label={`Field for ${h}`} className={map[i] === "skip" ? "skip" : ""} value={map[i]} onChange={(e) => setMap(map.map((m, k) => (k === i ? (e.target.value as WorkforceField) : m)))}>
                  {WORKFORCE_FIELDS.map((f) => <option key={f} value={f}>{f === "skip" ? "Skip this column" : f}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="note">{updated} of {parsed.people.length} people already exist and will be updated. {parsed.people.length - updated} are new.{parsed.skipped ? ` ${parsed.skipped} blank rows are skipped.` : ""}</div>
          <div className="acts"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" disabled={busy || !map.includes("Name")} onClick={run}>{busy ? "Importing…" : `Import ${parsed.people.length} people`}</button></div>
        </>
      )}
    </Sheet>
  );
}
