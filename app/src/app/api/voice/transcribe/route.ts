import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AiUnavailable } from "@/lib/ai/config";
import { transcribe } from "@/lib/ai/openai";
import { transcriptionPrompt } from "@/lib/ai/voice";

export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024; // stays under the serverless request limit

/** Audio in, transcript out. 503 means "no key configured": the client falls back to the browser transcript. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob) || file.size < 1000) return NextResponse.json({ error: "No audio received" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Recording is too long" }, { status: 413 });

  const lang = String(form?.get("lang") ?? "");
  const hint = ({ "en-IN": "en", "hi-IN": "hi", "kn-IN": "kn" } as Record<string, string>)[lang];
  const taskId = String(form?.get("taskId") ?? "");
  let title: string | undefined;
  if (taskId) {
    const { data } = await supabase.from("task_current").select("values").eq("id", taskId).maybeSingle();
    title = (data?.values as { work_description?: string } | undefined)?.work_description;
  }
  const type = file.type || "audio/webm";
  const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : type.includes("mpeg") ? "mp3" : "webm";
  const t0 = Date.now();
  try {
    const out = await transcribe({ audio: file, filename: `update.${ext}`, language: hint, prompt: transcriptionPrompt(title) });
    return NextResponse.json({ text: out.text, model: out.model, ms: Date.now() - t0 });
  } catch (e) {
    if (e instanceof AiUnavailable) return NextResponse.json({ error: e.message }, { status: 503 });
    console.error("transcribe failed", (e as Error).message);
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
}
