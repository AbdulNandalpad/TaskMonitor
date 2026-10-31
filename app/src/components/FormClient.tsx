"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Close } from "./Icons";
import { useToast } from "./Toast";

export type FieldRow = { key: string; label: string; type: string; required: boolean; options?: unknown };

const TYPES: [string, string][] = [["Text", "text"], ["Number", "number"], ["Dropdown", "dropdown"], ["Yes/No", "yes_no"], ["Date", "date"], ["Person", "person"], ["Photo", "photo"]];
const typeLabel = (t: string) => TYPES.find((x) => x[1] === t)?.[0] ?? (t === "section" ? "Dropdown" : t);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const f = (label: string, type: string, required: boolean): FieldRow => ({ key: slug(label), label, type, required });
const TEMPLATES: Record<string, FieldRow[]> = {
  "Shutdown jobs": [f("Section", "section", true), f("Work description", "text", true), f("Planned hours", "number", false), f("Manpower", "number", false), f("Vendor", "text", false), f("Responsible", "person", true), f("Photo on completion", "photo", true)],
  "Inspection round": [f("Location", "dropdown", true), f("Check point", "text", true), f("Reading", "number", false), f("Within limit", "yes_no", true), f("Inspector", "person", true), f("Photo if abnormal", "photo", false)],
  "Safety audit": [f("Section", "section", true), f("Observation", "text", true), f("Severity", "dropdown", true), f("Owner", "person", true), f("Due date", "date", true), f("Evidence photo", "photo", true)],
  Blank: [f("Title", "text", true), f("Responsible", "person", true)],
};

export function FormClient({ formId, listName, version, fields: initial, canEdit }: { formId: string; listName: string; version: number; fields: FieldRow[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [fields, setFields] = useState<FieldRow[]>(initial);
  const [tmpl, setTmpl] = useState<string | null>("Shutdown jobs");
  const [busy, setBusy] = useState(false);

  async function save() {
    const seen = new Set<string>();
    const out = fields.map((x) => {
      let key = x.key || slug(x.label) || "field", n = 2;
      while (seen.has(key)) key = `${x.key}_${n++}`;
      seen.add(key);
      return { ...x, key };
    });
    setBusy(true);
    const res = await fetch("/api/form", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form_id: formId, fields: out, note: tmpl ? `Template: ${tmpl}` : null }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return toast(j.error ?? "Could not save the form");
    toast(`Form saved as version ${j.version} · ${out.length} fields`);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <div className="card pad" style={{ display: "grid", gap: 12 }}>
        <div className="field"><label>Task list</label><div style={{ fontWeight: 500 }}>{listName}</div></div>
        <div className="field"><label>Template</label>
          <div className="tmpl">{Object.keys(TEMPLATES).map((t) => (
            <button key={t} type="button" aria-pressed={tmpl === t} disabled={!canEdit} onClick={() => { setTmpl(t); setFields(TEMPLATES[t].map((x) => ({ ...x }))); }}>{t}</button>
          ))}</div></div>
        <div className="note">Saving creates form version {version + 1}. Existing tasks keep their recorded values; new fields start empty on them.</div>
      </div>
      <div className="sec">Fields · {fields.length}<span className="note">Tap Required to toggle</span></div>
      <div className="card">
        {fields.map((x, i) => (
          <div className="frow" key={`${x.key}-${i}`}>
            <span className="grip">⋮⋮</span>
            <span><b>{x.label}</b><small>{typeLabel(x.type)}{x.type === "dropdown" || x.type === "section" ? " · options from the section list" : ""}</small></span>
            <button type="button" className={`req${x.required ? " on" : ""}`} disabled={!canEdit} onClick={() => setFields(fields.map((y, k) => (k === i ? { ...y, required: !y.required } : y)))}>{x.required ? "Required" : "Optional"}</button>
            <button type="button" className="iconbtn" aria-label="Remove field" disabled={!canEdit} onClick={() => setFields(fields.filter((_, k) => k !== i))}><Close size={16} /></button>
          </div>
        ))}
        {canEdit && (
          <div className="types"><span className="note" style={{ width: "100%" }}>Add a field</span>
            {TYPES.map(([label, type]) => (
              <button key={type} type="button" onClick={() => setFields([...fields, { key: `new_${type}_field_${fields.length + 1}`, label: `New ${label.toLowerCase()} field`, type, required: false }])}>+ {label}</button>
            ))}
          </div>
        )}
      </div>
      <button className="btn primary block" type="button" onClick={save} disabled={busy || !canEdit || !fields.length}>Save form</button>
    </>
  );
}
