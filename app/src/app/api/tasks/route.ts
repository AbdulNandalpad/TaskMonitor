import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Create a task (version 1) through task_create(). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || !b.list_id || !b.section_id || !String(b.values?.work_description ?? "").trim())
    return NextResponse.json({ error: "Work description is required" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("task_create", {
    p_list: b.list_id, p_section: b.section_id, p_values: b.values, p_responsible: b.responsible_person_id ?? null, p_source: "app",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  const { data: t } = await supabase.from("task").select("id, seq").eq("id", data).single();
  return NextResponse.json({ id: data, seq: t?.seq });
}
