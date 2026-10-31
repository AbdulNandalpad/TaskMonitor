"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HUES, initials, stats } from "@/lib/format";
import type { Person, Task } from "@/lib/types";
import { TaskRow, StatusChip } from "./TaskRow";
import { Chk } from "./Icons";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";

const av = (name: string) => <span className="avatar sm" style={{ background: HUES[name.length % HUES.length], color: "#fff" }}>{initials(name)}</span>;

export function AssignClient({ tasks, persons, sections }: { tasks: Task[]; persons: Person[]; sections: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<string>("un");
  const [picking, setPicking] = useState<Task | null>(null);
  const all = stats(tasks);
  const load = (id: string) => tasks.filter((t) => t.responsible_person_id === id).length;
  const nameOf = new Map(persons.map((p) => [p.id, p.name]));
  const shown = filter === "un" ? tasks.filter((t) => !t.responsible_person_id) : filter === "all" ? tasks : tasks.filter((t) => t.responsible_person_id === filter);

  async function assign(t: Task, p: Person) {
    setPicking(null);
    if (t.responsible_person_id === p.id) return;
    const res = await fetch(`/api/tasks/${t.id}/edit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: t.values, section_id: t.section_id, responsible_person_id: p.id, source: "assignment" }),
    });
    const j = await res.json();
    if (!res.ok) return toast(j.error ?? "Could not assign");
    router.refresh();
    toast(`Assigned to ${p.name} · they are notified`);
  }

  return (
    <>
      <div className="tiles four">
        <div className="tile accent"><div className="v num">{all.n}</div><div className="l">Tasks</div></div>
        <div className="tile good"><div className="v num">{all.n - all.un}</div><div className="l">Assigned</div></div>
        <div className="tile warn"><div className="v num">{all.un}</div><div className="l">Unassigned</div></div>
        <div className="tile info"><div className="v num">{persons.length}</div><div className="l">People · teams</div></div>
      </div>
      <div className="filters">
        <button type="button" aria-pressed={filter === "un"} onClick={() => setFilter("un")}>Unassigned · {all.un}</button>
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All tasks</button>
        {persons.map((p) => <button key={p.id} type="button" aria-pressed={filter === p.id} onClick={() => setFilter(p.id)}>{p.name} · {load(p.id)}</button>)}
      </div>
      <div className="card">
        {shown.length ? shown.slice(0, 60).map((t) => {
          const r = t.responsible_person_id ? nameOf.get(t.responsible_person_id) ?? null : null;
          return (
            <div key={t.id} style={{ position: "relative" }}>
              <TaskRow task={t} resp={r} right={
                <>
                  {r ? <span className="who">{av(r)}{r.split(" ")[0]}</span> : <StatusChip task={t} />}
                  <button className={`btn sm${r ? "" : " primary"}`} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPicking(t); }}>{r ? "Change" : "Assign"}</button>
                </>
              } />
            </div>
          );
        }) : <div className="empty"><Chk /><b>Everything is assigned</b><span>All {all.n} tasks have a responsible person.</span></div>}
      </div>
      {picking && (
        <Sheet title="Assign task" onClose={() => setPicking(null)}>
          <div className="ctx"><b>{picking.values.work_description}</b> · {sections.find((s) => s.id === picking.section_id)?.name} · {picking.values.planned_hours ?? 0} h</div>
          <div className="plist">
            {persons.map((p) => (
              <button key={p.id} className="person" type="button" onClick={() => assign(picking, p)}>
                {av(p.name)}<span><b>{p.name}</b><small>{p.role_title}</small></span>
                <span className={`load num${load(p.id) > 12 ? " hi" : ""}`}>{load(p.id)} tasks</span>
              </button>
            ))}
          </div>
          <div className="note">The change is recorded as a new task version.</div>
        </Sheet>
      )}
    </>
  );
}
