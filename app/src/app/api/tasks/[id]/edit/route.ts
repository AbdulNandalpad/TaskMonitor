import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Every edit is a new version with per-field change rows, written by task_edit() in the database. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || typeof b.values !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const source = ["app_edit", "assignment", "excel_import"].includes(b.source) ? b.source : "app_edit";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("task_edit", {
    p_task: id, p_values: b.values, p_section: b.section_id ?? null, p_responsible: b.responsible_person_id ?? null, p_source: source, p_raw: b.raw ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  if (!data) return NextResponse.json({ changed: 0 });
  const [{ count }, { data: ver }] = await Promise.all([
    supabase.from("task_field_change").select("id", { count: "exact", head: true }).eq("task_version_id", data),
    supabase.from("task_version").select("version").eq("id", data).single(),
  ]);
  return NextResponse.json({ changed: count ?? 0, version: ver?.version });
}
