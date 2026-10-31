"use client";
import { useState } from "react";
import { stats } from "@/lib/format";
import type { Status, Task } from "@/lib/types";
import { TaskRow, StatusChip } from "./TaskRow";
import { Chk } from "./Icons";

type Row = Task & { resp: string | null };
type Filter = "all" | Status;

export function SectionTasks({ tasks }: { tasks: Row[] }) {
  const [f, setF] = useState<Filter>("all");
  const s = stats(tasks);
  const F: [Filter, string, number][] = [["all", "All", s.n], ["not_started", "Not started", s.open], ["in_progress", "In progress", s.prog], ["completed", "Completed", s.done]];
  const shown = tasks.filter((t) => f === "all" || t.status === f);
  return (
    <>
      <div className="filters">
        {F.map(([k, label, n]) => (
          <button key={k} type="button" aria-pressed={f === k} onClick={() => setF(k)}>{label} · {n}</button>
        ))}
      </div>
      <div className="card">
        {shown.length ? shown.map((t) => <TaskRow key={t.id} task={t} resp={t.resp} right={<StatusChip task={t} />} />) : (
          <div className="empty"><Chk /><b>Nothing {F.find((x) => x[0] === f)![1].toLowerCase()} here</b><span>Change the filter to see other tasks.</span></div>
        )}
      </div>
    </>
  );
}
