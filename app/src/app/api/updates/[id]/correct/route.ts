import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureEnglish } from "@/lib/ai/translate";

/** Correct a recorded remark (note or voice entry). The original text is kept by task_update_correct(). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  const text = String(b?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Type a remark first." }, { status: 400 });
  const supabase = await createClient();
  // the corrected remark is also saved in English (the original text of the entry stays in text_original)
  const en = await ensureEnglish(text, { always: true });
  const { error } = await supabase.rpc("task_update_correct", { p_update: id, p_text: en.text });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true, translated: !!en.original, pending: en.pending });
}
