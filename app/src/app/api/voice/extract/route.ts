import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiUnavailable } from "@/lib/ai/config";
import { extractUpdate } from "@/lib/ai/voice";

export const maxDuration = 60;

/** Transcript + task in, structured update out (Claude). 503 means no key: the client uses the local rules reader. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const transcript = String(b?.transcript ?? "").trim();
  if (!b?.taskId || !transcript) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (transcript.length > 4000) return NextResponse.json({ error: "Transcript too long" }, { status: 413 });

  // RLS: the task is only visible to members of its area
  const { data: t } = await supabase.from("task_current").select("status, progress, values, section_id").eq("id", b.taskId).maybeSingle();
  if (!t) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const v = t.values as { work_description?: string; manpower?: number | null };
  try {
    const out = await extractUpdate({
      transcript, language: typeof b.language === "string" ? b.language : undefined,
      task: { title: v.work_description ?? "", status: t.status, progress: t.progress, manpower: v.manpower ?? null },
    });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof AiUnavailable) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("extract failed", (e as Error).message);
    return NextResponse.json({ error: "Extraction failed" }, { status: 502 });
  }
}
