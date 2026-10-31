"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, type Status, type Task } from "@/lib/types";
import { TaskRow, StatusChip } from "./TaskRow";
import { Chk } from "./Icons";

export type ListRow = Task & { sectionName: string; resp: string | null };
type Filter = "all" | Status;
type Init = { status: string; section: string; assignee: string; q: string };

const isStatus = (s: string): s is Status => ["not_started", "in_progress", "completed"].includes(s);

/** Task list with status chips, section and assignee filters and a search box. Table on desktop, task rows on a phone. */
export function TaskListClient({ rows, sections, persons, initial }: { rows: ListRow[]; sections: { id: string; name: string }[]; persons: { id: string; name: string }[]; initial: Init }) {
  const router = useRouter();
  const [status, setStatus] = useState<Filter>(isStatus(initial.status) ? initial.status : "all");
  const [section, setSection] = useState(initial.section);
  const [assignee, setAssignee] = useState(initial.assignee);
  const [q, setQ] = useState(initial.q);

  const sync = (next: Partial<{ status: Filter; section: string; assignee: string; q: string }>) => {
    const v = { status, section, assignee, q, ...next };
    const p = new URLSearchParams();
    if (v.status !== "all") p.set("status", v.status);
    if (v.section) p.set("section", v.section);
    if (v.assignee) p.set("assignee", v.assignee);
    if (v.q.trim()) p.set("q", v.q.trim());
    const qs = p.toString();
    router.replace(`/tasks${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((t) =>
      (!section || t.section_id === section) &&
      (!assignee || (assignee === "unassigned" ? !t.responsible_person_id : t.responsible_person_id === assignee)) &&
      (!needle || String(t.values.work_description ?? "").toLowerCase().includes(needle)));
  }, [rows, section, assignee, q]);
  const count = (s: Filter) => (s === "all" ? base.length : base.filter((t) => t.status === s).length);
  const shown = base.filter((t) => status === "all" || t.status === status);
  const F: [Filter, string][] = [["all", "All"], ["not_started", "Not started"], ["in_progress", "In progress"], ["completed", "Completed"]];

  // phone: group by section
  const groups: { name: string; items: ListRow[] }[] = [];
  shown.forEach((t) => {
    const g = groups[groups.length - 1];
    if (g && g.name === t.sectionName) g.items.push(t); else groups.push({ name: t.sectionName, items: [t] });
  });

  return (
    <>
      <div className="toolbar">
        <div className="filters" role="group" aria-label="Status">
          {F.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => { setStatus(k); sync({ status: k }); }}>{label} · {count(k)}</button>
          ))}
        </div>
        <div className="toolbar-r">
          <input className="search" type="search" placeholder="Search work description" aria-label="Search work description" value={q}
            onChange={(e) => { setQ(e.target.value); sync({ q: e.target.value }); }} />
          <select aria-label="Section" value={section} onChange={(e) => { setSection(e.target.value); sync({ section: e.target.value }); }}>
            <option value="">All sections</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select aria-label="Responsible" value={assignee} onChange={(e) => { setAssignee(e.target.value); sync({ assignee: e.target.value }); }}>
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {persons.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {!shown.length ? (
        <div className="card empty"><Chk /><b>No tasks match</b><span>Change the filter or the search.</span></div>
      ) : (
        <>
          <div className="card d-only">
            <table className="dt">
              <thead><tr><th className="n">#</th><th className="tcell">Task</th><th>Section</th><th>Responsible</th><th className="n">Planned h</th><th>Status</th><th className="n">Progress</th></tr></thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className="trlink" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) return; router.push(`/tasks/${t.id}`); }}>
                    <td className="n num">{t.seq}</td>
                    <td className="tcell"><Link href={`/tasks/${t.id}`}>{t.values.work_description}</Link>{t.values.vendor ? <small>{t.values.vendor}</small> : null}{t.version > 1 ? <span className="chip accent vtag">v{t.version}</span> : null}</td>
                    <td>{t.sectionName}</td>
                    <td>{t.resp ?? <span className="un">Unassigned</span>}</td>
                    <td className="n num">{t.values.planned_hours ?? 0}</td>
                    <td><span className={`chip ${STATUS[t.status].chip}`}>{STATUS[t.status].label}</span></td>
                    <td className="n"><span className="pbar"><i className={`b-${STATUS[t.status].key}`} style={{ width: `${t.progress}%` }} /></span><span className="num pv">{t.progress}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="m-only">
            {groups.map((g) => (
              <div key={g.name} className="group">
                <div className="sec">{g.name} · {g.items.length}</div>
                <div className="card">{g.items.map((t) => <TaskRow key={t.id} task={t} resp={t.resp} right={<StatusChip task={t} />} />)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
