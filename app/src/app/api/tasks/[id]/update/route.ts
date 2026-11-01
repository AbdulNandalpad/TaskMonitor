import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Status / progress / voice / photo / note updates. The database function checks the role and the forward-only rule
 * (status and progress never go back) and applies the change atomically.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || !["status", "progress", "voice", "photo", "note"].includes(b.type)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  // a typed remark must have text
  if (b.type === "note" && !String(b.text ?? "").trim()) return NextResponse.json({ error: "Type a remark first." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("task_record_update", {
    p_task: id, p_type: b.type, p_status: b.status ?? null, p_progress: b.progress ?? null,
    p_text: b.type === "note" ? String(b.text).trim() : b.text ?? null,
    p_extracted: b.extracted ?? null, p_confirmed: b.confirmed ?? null,
  });
  if (error) {
    // 22023 = forward-only rule: the request conflicts with where the task already is
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ updateId: data });
}
