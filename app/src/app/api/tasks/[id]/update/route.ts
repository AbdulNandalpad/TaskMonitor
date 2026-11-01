import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureEnglish } from "@/lib/ai/translate";

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

  // Remarks are always saved in English so reports are consistent; the original is kept in extracted.
  let text: string | null = b.text ?? null;
  let extracted = b.extracted ?? null;
  let confirmed = b.confirmed ?? null;
  let translated = false, pending = false;
  if (b.type === "note") {
    const r = await ensureEnglish(String(b.text), { always: true });
    text = r.text; pending = r.pending; translated = !!r.original;
    extracted = { ...(extracted ?? {}), ...(r.language ? { language: r.language } : {}), ...(r.original ? { original_text: r.original } : {}), ...(r.pending ? { translation_pending: true } : {}) };
  } else if (b.type === "voice") {
    // the voice sheet already shows English; if the user typed Hindi or Kannada into the fields, translate those too
    const t = await ensureEnglish(String(b.text ?? ""));
    const rm = await ensureEnglish(String(confirmed?.remarks ?? ""));
    text = t.text; translated = !!t.original || !!rm.original; pending = t.pending || rm.pending;
    if (confirmed) confirmed = { ...confirmed, remarks: rm.text };
    if (t.original || rm.original || pending) extracted = { ...(extracted ?? {}), ...(t.original ? { original_text: t.original } : {}), ...(pending ? { translation_pending: true } : {}) };
  }
  const { data, error } = await supabase.rpc("task_record_update", {
    p_task: id, p_type: b.type, p_status: b.status ?? null, p_progress: b.progress ?? null,
    p_text: text, p_extracted: extracted, p_confirmed: confirmed,
  });
  if (error) {
    // 22023 = forward-only rule: the request conflicts with where the task already is
    const status = error.code === "42501" ? 403 : error.code === "22023" ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ updateId: data, translated, pending });
}
