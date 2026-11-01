/* Data for the detailed report (CR-7): one row per task with start, end, duration, evidence and photos.
   Shared by the report page, the summaries route and the Excel export so they can never disagree. */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Status } from "../types";

export type UpdateRow = {
  id: string; task_id: string; type: string; by_user: string | null; at: string;
  status_after: Status | null; progress_after: number | null; text: string | null; edit_count: number;
};
export type PhotoRow = { id: string; task_id: string; update_id: string; object_key: string; label: string | null; at: string; by: string };

export type Evidence = {
  plan: { section: string; description: string; plannedHours: number | null; manpower: number | null; vendor: string; responsible: string | null; completionPhotoRequired: boolean };
  status: Status; progress: number;
  events: { at: string; by: string; type: string; statusAfter: Status | null; progressAfter: number | null; text: string }[];
  photos: { at: string; by: string; label: string | null }[];
};

export type TaskBlock = {
  id: string; seq: number; description: string; sectionId: string | null; sectionName: string;
  status: Status; progress: number; plannedHours: number | null; responsible: string | null;
  start: string | null; end: string | null; durationMin: number | null;
  evidence: Evidence; hash: string; summary: string | null; summaryStale: boolean;
  photos: (PhotoRow & { url?: string })[]; noCompletionPhoto: boolean;
};

/** PostgREST caps a response at 1000 rows, so page through. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Start: first update that moved the task to in progress (or progress above 0). End: first update to completed. */
export function timeline(updates: Pick<UpdateRow, "at" | "status_after" | "progress_after">[]) {
  const asc = [...updates].sort((a, b) => a.at.localeCompare(b.at));
  const start = asc.find((u) => u.status_after === "in_progress" || (u.progress_after ?? 0) > 0)?.at ?? null;
  const end = asc.find((u) => u.status_after === "completed")?.at ?? null;
  const durationMin = start && end ? Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 60000)) : null;
  return { start, end, durationMin };
}

export const hashEvidence = (e: Evidence) => createHash("sha256").update(JSON.stringify(e)).digest("hex");

export function fmtDuration(min: number | null) {
  if (min === null) return "–";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export async function loadDetailed(supabase: SupabaseClient, areaId: string, listId: string, opts: { signUrls?: boolean } = {}) {
  const [{ data: list }, { data: sections }, { data: persons }] = await Promise.all([
    supabase.from("task_list").select("id, name, starts_at, ends_at, planned_hours").eq("id", listId).maybeSingle(),
    supabase.from("section").select("id, name, position, head_person_id").eq("task_list_id", listId).order("position"),
    supabase.from("person").select("id, name").eq("area_id", areaId),
  ]);
  if (!list) return null;
  const tasks = await fetchAll<{ id: string; seq: number; section_id: string | null; status: Status; progress: number; responsible_person_id: string | null; values: Record<string, unknown> }>(
    (a, b) => supabase.from("task_current").select("id, seq, section_id, status, progress, responsible_person_id, values").eq("task_list_id", listId).order("seq").range(a, b));
  const taskIds = new Set(tasks.map((t) => t.id));
  const updates = (await fetchAll<UpdateRow>((a, b) =>
    supabase.from("task_update").select("id, task_id, type, by_user, at, status_after, progress_after, text, edit_count").eq("area_id", areaId).order("at").range(a, b))).filter((u) => taskIds.has(u.task_id));
  const atts = await fetchAll<{ id: string; task_update_id: string; object_key: string; label: string | null; created_at: string }>(
    (a, b) => supabase.from("attachment").select("id, task_update_id, object_key, label, created_at").eq("area_id", areaId).eq("kind", "photo").range(a, b));
  const sums = await fetchAll<{ task_id: string; evidence_hash: string; text: string; model: string }>(
    (a, b) => supabase.from("task_summary").select("task_id, evidence_hash, text, model").eq("area_id", areaId).range(a, b));

  const userIds = [...new Set(updates.map((u) => u.by_user).filter(Boolean))] as string[];
  const { data: profs } = userIds.length ? await supabase.from("profiles").select("id, display_name").in("id", userIds) : { data: [] };
  const who = new Map((profs ?? []).map((p) => [p.id as string, p.display_name as string]));
  const personName = new Map((persons ?? []).map((p) => [p.id as string, p.name as string]));
  const secName = new Map((sections ?? []).map((s) => [s.id as string, s.name as string]));
  const upById = new Map(updates.map((u) => [u.id, u]));
  const sumBy = new Map(sums.map((s) => [s.task_id, s]));

  const photos: PhotoRow[] = atts.flatMap((a) => {
    const u = upById.get(a.task_update_id);
    return u ? [{ id: a.id, task_id: u.task_id, update_id: u.id, object_key: a.object_key, label: a.label, at: u.at, by: who.get(u.by_user ?? "") ?? "" }] : [];
  }).sort((x, y) => x.at.localeCompare(y.at));
  if (opts.signUrls && photos.length) {
    const { data: urls } = await supabase.storage.from("attachments").createSignedUrls(photos.map((p) => p.object_key), 3600);
    (urls ?? []).forEach((u, i) => { if (u.signedUrl) (photos[i] as PhotoRow & { url?: string }).url = u.signedUrl; });
  }

  const blocks: TaskBlock[] = tasks.map((t) => {
    const ups = updates.filter((u) => u.task_id === t.id);
    const ph = photos.filter((p) => p.task_id === t.id);
    const v = t.values as { work_description?: string; planned_hours?: number | null; manpower?: number | null; vendor?: string; photo_on_completion?: boolean };
    const tl = timeline(ups);
    const evidence: Evidence = {
      plan: {
        section: secName.get(t.section_id ?? "") ?? "", description: v.work_description ?? "", plannedHours: v.planned_hours ?? null,
        manpower: v.manpower ?? null, vendor: v.vendor ?? "", responsible: personName.get(t.responsible_person_id ?? "") ?? null,
        completionPhotoRequired: !!v.photo_on_completion,
      },
      status: t.status, progress: t.progress,
      events: ups.map((u) => ({ at: u.at, by: who.get(u.by_user ?? "") ?? "", type: u.type, statusAfter: u.status_after, progressAfter: u.progress_after, text: u.text ?? "" })),
      photos: ph.map((p) => ({ at: p.at, by: p.by, label: p.label })),
    };
    const hash = hashEvidence(evidence);
    const sm = sumBy.get(t.id);
    return {
      id: t.id, seq: t.seq, description: v.work_description ?? "", sectionId: t.section_id, sectionName: secName.get(t.section_id ?? "") ?? "",
      status: t.status, progress: t.progress, plannedHours: v.planned_hours ?? null, responsible: personName.get(t.responsible_person_id ?? "") ?? null,
      ...tl, evidence, hash, summary: sm?.text ?? null, summaryStale: !!sm && sm.evidence_hash !== hash,
      photos: ph, noCompletionPhoto: !!v.photo_on_completion && !ph.length,
    };
  });
  return { list, sections: sections ?? [], blocks, personName };
}
