import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import type { MappedTask } from "@/lib/excel";
import type { TaskValues } from "@/lib/types";

export const maxDuration = 60;

/**
 * Task import. Rows were mapped and parsed in the browser. An existing task is matched on section + description and
 * edited as a new version with source "excel_import"; everything else is created through task_create().
 */
export async function POST(req: Request) {
  const ctx = await requireCtx({ managerOnly: true });
  const b = await req.json().catch(() => null);
  const rows: MappedTask[] = Array.isArray(b?.tasks) ? b.tasks : [];
  if (!rows.length) return NextResponse.json({ error: "No tasks to import" }, { status: 400 });
  const { supabase, area } = ctx;
  const { list, sections, persons, tasks } = await loadBoard(ctx);
  if (!list) return NextResponse.json({ error: "This area has no task list yet" }, { status: 400 });

  const secId = new Map(sections.map((s) => [s.name.trim().toLowerCase(), s.id]));
  const personId = new Map(persons.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const existing = new Map(tasks.map((t) => [`${t.section_id}|${String(t.values.work_description ?? "").trim().toLowerCase()}`, t]));
  let position = Math.max(0, ...sections.map((s) => s.position));
  const unmatched = new Set<string>();
  let created = 0, updated = 0, unchanged = 0, sectionsCreated = 0, statusKept = 0, skipped = Number(b.skipped ?? 0);
  const fail = (msg: string) => NextResponse.json({ error: msg, created, updated }, { status: 400 });

  for (const r of rows) {
    const sectionName = r.section.trim();
    let sid = secId.get(sectionName.toLowerCase());
    if (!sid) {
      if (!sectionName) { skipped++; continue; }
      const { data, error } = await supabase.from("section").insert({ area_id: area.id, task_list_id: list.id, name: sectionName, position: ++position }).select("id").single();
      if (error) return fail(error.message);
      sid = data.id as string;
      secId.set(sectionName.toLowerCase(), sid);
      sectionsCreated++;
    }
    let resp: string | null | undefined = r.responsible ? personId.get(r.responsible.trim().toLowerCase()) : undefined;
    if (r.responsible && !resp) { unmatched.add(r.responsible); resp = undefined; }

    const match = existing.get(`${sid}|${r.work_description.trim().toLowerCase()}`);
    let taskId: string;
    let curStatus = "not_started", curProgress = 0;
    if (match) {
      const values: TaskValues = { ...match.values };
      if (r.planned_hours !== null) values.planned_hours = r.planned_hours;
      if (r.manpower !== null) values.manpower = r.manpower;
      if (r.vendor) values.vendor = r.vendor;
      if (r.remarks) values.remarks = r.remarks;
      const raw = r.planned_hours_raw && !/^\d+(\.\d+)?$/.test(r.planned_hours_raw.trim()) ? { planned_hours: r.planned_hours_raw } : null;
      const { data, error } = await supabase.rpc("task_edit", {
        p_task: match.id, p_values: values, p_section: sid, p_responsible: resp ?? match.responsible_person_id, p_source: "excel_import", p_raw: raw,
      });
      if (error) return fail(error.message);
      data ? updated++ : unchanged++;
      taskId = match.id; curStatus = match.status; curProgress = match.progress;
    } else {
      const values: TaskValues = {
        work_description: r.work_description, planned_hours: r.planned_hours ?? 0, manpower: r.manpower ?? 0, vendor: r.vendor, photo_on_completion: true,
      };
      if (r.remarks) values.remarks = r.remarks;
      const { data, error } = await supabase.rpc("task_create", {
        p_list: list.id, p_section: sid, p_values: values, p_responsible: resp ?? null, p_source: "excel_import", p_note: "Imported from Excel",
      });
      if (error) return fail(error.message);
      created++;
      taskId = data as string;
      existing.set(`${sid}|${r.work_description.trim().toLowerCase()}`, { id: taskId, values, status: "not_started", progress: 0, responsible_person_id: resp ?? null } as never);
    }
    // status only moves forward: a sheet that says "not started" for a task already under way leaves the task as it is
    const rank = (s: string) => (s === "not_started" ? 0 : s === "in_progress" ? 1 : 2);
    let wantStatus = r.status, wantProgress = r.progress;
    if (wantStatus && rank(wantStatus) < rank(curStatus)) { wantStatus = null; wantProgress = null; statusKept++; }
    else if (wantProgress !== null && wantProgress < curProgress) { wantProgress = null; statusKept++; }
    if ((wantStatus && wantStatus !== curStatus) || (wantProgress !== null && wantProgress !== curProgress)) {
      const { error } = await supabase.rpc("task_record_update", {
        p_task: taskId, p_type: "status", p_status: wantStatus, p_progress: wantProgress, p_text: "Status from Excel import",
      });
      if (error) return fail(error.message);
    }
  }

  await supabase.from("import_job").insert({
    area_id: area.id, kind: "tasks", sheet: b.sheet ?? null, mapping: b.mapping ?? null, status: "done",
    rows_total: rows.length + Number(b.skipped ?? 0), rows_created: created, rows_updated: updated, rows_skipped: skipped,
    by_user: ctx.userId, finished_at: new Date().toISOString(),
    report: { filename: b.filename ?? null, unmatched_responsible: [...unmatched], sections_created: sectionsCreated, unchanged, status_kept_forward_only: statusKept },
  });
  await supabase.rpc("log_audit", { p_action: "import", p_area_code: area.code, p_detail: { kind: "tasks", created, updated, skipped } });
  return NextResponse.json({ created, updated, unchanged, skipped, sectionsCreated, statusKept, unmatched: [...unmatched] });
}
