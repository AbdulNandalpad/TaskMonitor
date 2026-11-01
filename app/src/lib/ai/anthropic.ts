import { AI, AiUnavailable } from "./config";

type Tool = { name: string; description: string; input_schema: Record<string, unknown> };

/**
 * Calls Claude and forces a single tool call, so the answer is structured JSON that matches `tool.input_schema`.
 * Plain fetch on purpose: no SDK dependency, easy to read and to mock.
 */
export async function callClaudeTool<T>(opts: {
  system: string;
  user: string;
  tool: Tool;
  model?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<{ input: T; usage: { input_tokens: number; output_tokens: number }; model: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiUnavailable("Anthropic");
  const model = opts.model ?? AI.claudeModel;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 700,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
    }),
    signal: opts.signal ?? AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    // status and error type say what is wrong (bad key, unknown model, no credit, rate limit) without exposing anything secret
    const j = await res.json().catch(() => ({}));
    throw new Error(`Anthropic ${res.status} ${j?.error?.type ?? "error"}: ${String(j?.error?.message ?? "").slice(0, 140)}`);
  }
  const j = await res.json();
  const block = (j.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  if (!block) throw new Error("Anthropic returned no tool call");
  return { input: block.input as T, usage: j.usage ?? { input_tokens: 0, output_tokens: 0 }, model };
}
