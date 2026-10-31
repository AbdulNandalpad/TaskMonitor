"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, STATUS_ORDER, type Status } from "@/lib/types";
import { postUpdate, uploadAttachment } from "@/lib/upload";
import { useToast } from "./Toast";

type T = { id: string; seq: number; status: Status; progress: number };

export function TaskActions({ task, areaId, canUpdate }: { task: T; areaId: string; canUpdate: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [prog, setProg] = useState(task.progress);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try { await fn(); router.refresh(); toast(ok); } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }
  const setStatus = (s: Status) => run(async () => {
    await postUpdate(task.id, { type: "status", status: s, text: `Status set to ${STATUS[s].label}.` });
    setProg(s === "completed" ? 100 : s === "not_started" ? 0 : task.progress === 0 || task.progress === 100 ? 10 : task.progress);
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
          {STATUS_ORDER.map((s) => (
            <button key={s} type="button" data-s={STATUS[s].key} aria-pressed={task.status === s} disabled={!canUpdate || busy} onClick={() => setStatus(s)}>
              <i />{STATUS[s].label}
            </button>
          ))}
        </div>
        <div className="prog">
          <input type="range" min={0} max={100} step={5} value={prog} aria-label="Progress" disabled={!canUpdate || busy}
            onChange={(e) => setProg(+e.target.value)} onPointerUp={() => prog !== task.progress && saveProgress(prog)}
            onKeyUp={() => prog !== task.progress && saveProgress(prog)} />
          <span className="num">{prog}%</span>
        </div>
      </div>
      {canUpdate && (
        <>
          <div className="sec">Add photo</div>
          <div className="card pad">
            <div className="photos" style={{ marginTop: 0 }}>
              <label className="ph add">
                <input type="file" accept="image/*" capture="environment" aria-label="Add photo" disabled={busy}
                  onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                + Photo
              </label>
            </div>
            <div className="note" style={{ marginTop: 8 }}>Stamped with task, step, time and who took it.</div>
          </div>
        </>
      )}
    </>
  );
}
