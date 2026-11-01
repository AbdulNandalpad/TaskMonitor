/* Offline check of the AI module with a stubbed fetch (no keys needed): npx tsx scripts/ai-mock-test.ts */
process.env.ANTHROPIC_API_KEY = "test"; process.env.OPENAI_API_KEY = "test";
import { extractUpdate } from "../src/lib/ai/voice";
import { transcribe } from "../src/lib/ai/openai";
const calls: { url: string; body: unknown }[] = [];
(globalThis as any).fetch = async (url: string, init: any) => {
  calls.push({ url, body: init.body });
  if (url.includes("anthropic")) return new Response(JSON.stringify({ usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "tool_use", name: "record_update", input: { status: "completed", progress: 40, manpower: 6, remarks: "trial ok", needs_attention: false, confidence: { status: 0.95, progress: 0.9, manpower: 0.9, remarks: 0.8 } } }] }), { status: 200 });
  return new Response(JSON.stringify({ text: " completed, six people " }), { status: 200 });
};
(async () => {
  const e = await extractUpdate({ transcript: "completed, six people", task: { title: "Stave hose changing", status: "in_progress", progress: 60, manpower: 10 } });
  const t = await transcribe({ audio: new Blob([new Uint8Array(2000)]), filename: "update.webm", language: "hi", prompt: "x" });
  const body = JSON.parse(calls[0].body as string);
  const ok = e.status === "completed" && e.progress === 100 && e.manpower === 6 && t.text === "completed, six people"
    && body.tool_choice.name === "record_update" && body.model === "claude-sonnet-5-5" && (calls[1].body as FormData).get("language") === "hi";
  console.log(ok ? "PASS ai module (mocked)" : "FAIL", JSON.stringify(e));
  process.exit(ok ? 0 : 1);
})();
