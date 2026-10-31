import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Saving the form builder writes a new form_version with the full field set (form_save()). */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.form_id || !Array.isArray(b.fields) || !b.fields.length) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("form_save", { p_form: b.form_id, p_fields: b.fields, p_note: b.note ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  const { data: v } = await supabase.from("form_version").select("version").eq("id", data).single();
  return NextResponse.json({ version: v?.version });
}
