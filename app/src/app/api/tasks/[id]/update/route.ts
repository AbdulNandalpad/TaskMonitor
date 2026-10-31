import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Status / progress / voice / photo / note updates. The database function checks the role and applies the change atomically. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || !["status", "progress", "voice", "photo", "note"].includes(b.type)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("task_record_update", {
    p_task: id, p_type: b.type, p_status: b.status ?? null, p_progress: b.progress ?? null, p_text: b.text ?? null,
    p_extracted: b.extracted ?? null, p_confirmed: b.confirmed ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ updateId: data });
}
