import { AI, AiUnavailable } from "./config";

/** Speech to text through the OpenAI transcription endpoint. `prompt` biases the model toward plant vocabulary. */
export async function transcribe(opts: {
  audio: Blob;
  filename: string;
  /** ISO-639-1 hint (en, hi, kn). Omit to let the model detect (best for mixed Hindi and English). */
  language?: string;
  prompt?: string;
  signal?: AbortSignal;
}): Promise<{ text: string; model: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiUnavailable("OpenAI");
  const form = new FormData();
  form.append("file", opts.audio, opts.filename);
  form.append("model", AI.transcribeModel);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (opts.language) form.append("language", opts.language);
  if (opts.prompt) form.append("prompt", opts.prompt);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: opts.signal ?? AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  return { text: String(j.text ?? "").trim(), model: AI.transcribeModel };
}
