/* Browser-side evidence upload: file -> Storage (area/<area>/task/<task>/<update>/<uuid>.<ext>) -> attachment row. */
import { createClient } from "./supabase/client";

async function sha256Hex(buf: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) return "unavailable";
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function uploadAttachment(opts: {
  areaId: string; taskId: string; updateId: string; kind: "photo" | "audio"; blob: Blob; ext: string; label?: string; durationMs?: number;
}) {
  const supabase = createClient();
  const key = `area/${opts.areaId}/task/${opts.taskId}/${opts.updateId}/${crypto.randomUUID()}.${opts.ext}`;
  const buf = await opts.blob.arrayBuffer();
  const up = await supabase.storage.from("attachments").upload(key, opts.blob, { contentType: opts.blob.type || undefined, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const ins = await supabase.from("attachment").insert({
    area_id: opts.areaId, task_update_id: opts.updateId, kind: opts.kind, object_key: key, sha256: await sha256Hex(buf),
    mime: opts.blob.type || null, bytes: opts.blob.size, label: opts.label ?? null, duration_ms: opts.durationMs ?? null,
  });
  if (ins.error) throw new Error(ins.error.message);
}

export async function postUpdate(taskId: string, body: Record<string, unknown>): Promise<{ updateId: string; translated?: boolean; pending?: boolean }> {
  const res = await fetch(`/api/tasks/${taskId}/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? "Could not save the update");
  return j;
}
