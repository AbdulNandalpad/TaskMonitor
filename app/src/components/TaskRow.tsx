import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS, type Task } from "@/lib/types";

/** Task row used by the section list, the assign list and the dashboard. `right` is the right-hand column. */
export function TaskRow({ task, resp, right, href }: { task: Task; resp?: string | null; right: ReactNode; href?: string }) {
  const v = task.values;
  return (
    <Link className="job" href={href ?? `/tasks/${task.id}`}>
      <span className={`stripe ${task.status === "completed" ? "done" : task.status === "in_progress" ? "prog" : ""}`} />
      <span>
        <span className="d">{v.work_description}</span>
        <span className="m">
          <span><span className="num">{v.planned_hours ?? 0}</span> h planned</span>
          {resp ? <span>{resp}</span> : <span className="un">Unassigned</span>}
          {v.vendor ? <span>{v.vendor}</span> : null}
          {task.version > 1 ? <span className="chip accent" style={{ height: 18, fontSize: 10.5 }}>v{task.version}</span> : null}
        </span>
      </span>
      <span className="r">{right}</span>
    </Link>
  );
}

export function StatusChip({ task }: { task: Pick<Task, "status" | "progress"> }) {
  const s = STATUS[task.status];
  return (
    <>
      <span className={`chip ${s.chip}`}>{s.label}</span>
      {task.status === "in_progress" ? <span className="pct num">{task.progress}%</span> : null}
    </>
  );
}
