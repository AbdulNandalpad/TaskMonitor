"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, STATUS_ORDER, type Status } from "@/lib/types";
import { postUpdate, uploadAttachment } from "@/lib/upload";
import { AddRemark } from "./AddRemark";
import { useToast } from "./Toast";

type T = { id: string; seq: number; status: Status; progress: number };
const rank = (s: Status) => STATUS_ORDER.indexOf(s);

export function TaskActions({ task, areaId, canUpdate }: { task: T; areaId: string; canUpdate: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [prog, setProg] = useState(task.progress);
  const [busy, setBusy] = useState(false);
  // status moves forward only; completed is final
  const done = task.status === "completed";
  const minProgress = task.status === "in_progress" ? task.progress : 0;

  useEffect(() => setProg(task.progress), [task.progress, task.status]);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); router.refresh(); toast(ok); } catch (e) { toast((e as Error).message); setProg(task.progress); }
    setBusy(false);
  }
  const setStatus = (s: Status) => s !== task.status && run(async () => {
    await postUpdate(task.id, { type: "status", status: s, text: `Status set to ${STATUS[s].label}.` });
  }, "Status updated");
  const saveProgress = (n: number) => run(async () => {
    await postUpdate(task.id, { type: "progress", progress: n, text: `Progress set to ${n}%.` });
  }, "Progress saved");
  const addPhoto = (file: File | undefined) => file && run(async () => {
    const { updateId } = await postUpdate(task.id, { type: "photo", text: `Photo added · ${STATUS[task.status].label}` });
    await uploadAttachment({ areaId, taskId: task.id, updateId, kind: "photo", blob: file, ext: (file.name.split(".").pop() || "jpg").toLowerCase(), label: task.status === "completed" ? "after" : "before" });
  }, `Photo attached to task ${task.seq}`);

  return (
    <>
      <div className="sec">Status</div>
      <div className="card pad">
        <div className="steps">
          {STATUS_ORDER.map((s) => {
            const back = rank(s) < rank(task.status);
            return (
              <button key={s} type="button" data-s={STATUS[s].key} aria-pressed={task.status === s}
                disabled={!canUpdate || busy || back || done}
                title={back || (done && s !== task.status) ? "Cannot go back" : undefined}
                onClick={() => setStatus(s)}>
                <i />{STATUS[s].label}
              </button>
            );
          })}
        </div>
        <div className="prog">
          <input type="range" min={minProgress} max={100} step={5} value={prog} aria-label="Progress"
            disabled={!canUpdate || busy || done}
            onChange={(e) => setProg(Math.max(minProgress, +e.target.value))}
            onPointerUp={() => prog !== task.progress && saveProgress(prog)}
            onKeyUp={() => prog !== task.progress && saveProgress(prog)} />
          <span className="num">{prog}%</span>
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          {done ? "Completed is final: status and progress are locked." : "Status and progress only move forward."}
        </div>
      </div>
      {canUpdate && (
        <>
          <div className="sec">Add photo or remark</div>
          <div className="card pad">
            <div className="photos" style={{ marginTop: 0 }}>
              <label className="ph add">
                <input type="file" accept="image/*" capture="environment" aria-label="Add photo" disabled={busy}
                  onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                + Photo
              </label>
              <AddRemark taskId={task.id} variant="tile" />
            </div>
            <div className="note" style={{ marginTop: 8 }}>Stamped with task, step, time and who added it.</div>
          </div>
        </>
      )}
    </>
  );
}
