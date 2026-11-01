"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, type Status, type Task } from "@/lib/types";
import { TaskRow, StatusChip } from "./TaskRow";
import { Chev, Chk } from "./Icons";

export type ListRow = Task & { sectionName: string; resp: string | null };
type Filter = "all" | Status;
type Init = { status: string; section: string; assignee: string; q: string };
type Sec = { id: string; name: string; head: string | null };

const isStatus = (s: string): s is Status => ["not_started", "in_progress", "completed"].includes(s);

const MiniBar = ({ done, prog, open }: { done: number; prog: number; open: number }) => {
  const n = done + prog + open || 1;
  return (
    <span className="gh-bar" aria-hidden="true">
      <i style={{ width: `${(done / n) * 100}%`, background: "var(--good)" }} />
      <i style={{ width: `${(prog / n) * 100}%`, background: "var(--warn)" }} />
      <i style={{ width: `${(open / n) * 100}%`, background: "var(--bad)" }} />
    </span>
  );
};

/**
 * Task list grouped by section (CR-9). Filters (status chips, search, section, responsible) apply first, then the rows are
 * grouped in section order; sections with no matching task are hidden. Headers collapse, remembered per user in the browser.
 * Table on desktop (no Section column, the header carries it), task rows with sticky headers on a phone.
 */
export function TaskListClient({ rows, sections, persons, initial, userId }: {
  rows: ListRow[]; sections: Sec[]; persons: { id: string; name: string }[]; initial: Init; userId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Filter>(isStatus(initial.status) ? initial.status : "all");
  const [section, setSection] = useState(initial.section);
  const [assignee, setAssignee] = useState(initial.assignee);
  const [q, setQ] = useState(initial.q);

  // collapsed sections, remembered per user in this browser
  const storeKey = `tm_tasks_collapsed_${userId}`;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { setCollapsed(new Set(JSON.parse(localStorage.getItem(storeKey) ?? "[]"))); } catch { /* storage unavailable */ }
  }, [storeKey]);
  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(storeKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

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

  // groups in section order; header totals describe the whole section, the rows below follow the filters
  const groups = sections.map((s) => {
    const all = rows.filter((t) => t.section_id === s.id);
    return {
      s, items: shown.filter((t) => t.section_id === s.id), total: all.length,
      done: all.filter((t) => t.status === "completed").length, prog: all.filter((t) => t.status === "in_progress").length, open: all.filter((t) => t.status === "not_started").length,
    };
  }).filter((g) => g.items.length);
  const filtered = status !== "all" || !!q.trim() || !!assignee;

  const headLine = (g: (typeof groups)[number]) => (
    <>
      <Chev />
      <span className="gh-name">{g.s.name}</span>
      {g.s.head ? <span className="gh-head">{g.s.head}</span> : null}
      <span className="gh-count num">{g.done} of {g.total} done{filtered ? ` · ${g.items.length} shown` : ""}</span>
      <MiniBar done={g.done} prog={g.prog} open={g.open} />
    </>
  );

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
            <table className="dt grouped">
              <thead><tr><th className="n">#</th><th className="tcell">Task</th><th>Responsible</th><th className="n">Planned h</th><th>Status</th><th className="n">Progress</th></tr></thead>
              {groups.map((g) => {
                const open = !collapsed.has(g.s.id);
                return (
                  <tbody key={g.s.id} data-group={g.s.id}>
                    <tr className="ghead">
                      <td colSpan={6}>
                        <button type="button" className="gh-btn" aria-expanded={open} aria-label={`${g.s.name}, ${g.done} of ${g.total} done`} onClick={() => toggle(g.s.id)}>{headLine(g)}</button>
                      </td>
                    </tr>
                    {open && g.items.map((t) => (
                      <tr key={t.id} className="trlink" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) return; router.push(`/tasks/${t.id}`); }}>
                        <td className="n num">{t.seq}</td>
                        <td className="tcell"><Link href={`/tasks/${t.id}`}>{t.values.work_description}</Link>{t.values.vendor ? <small>{t.values.vendor}</small> : null}{t.version > 1 ? <span className="chip accent vtag">v{t.version}</span> : null}</td>
                        <td>{t.resp ?? <span className="un">Unassigned</span>}</td>
                        <td className="n num">{t.values.planned_hours ?? 0}</td>
                        <td><span className={`chip ${STATUS[t.status].chip}`}>{STATUS[t.status].label}</span></td>
                        <td className="n"><span className="pbar"><i className={`b-${STATUS[t.status].key}`} style={{ width: `${t.progress}%` }} /></span><span className="num pv">{t.progress}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
          <div className="m-only">
            {groups.map((g) => {
              const open = !collapsed.has(g.s.id);
              return (
                <div key={g.s.id} className="group" data-group={g.s.id}>
                  <button type="button" className="gh-btn gh-m" aria-expanded={open} aria-label={`${g.s.name}, ${g.done} of ${g.total} done`} onClick={() => toggle(g.s.id)}>{headLine(g)}</button>
                  {open ? <div className="card">{g.items.map((t) => <TaskRow key={t.id} task={t} resp={t.resp} right={<StatusChip task={t} />} />)}</div> : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
