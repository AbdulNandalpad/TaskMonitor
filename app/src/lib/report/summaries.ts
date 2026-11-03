import type { SupabaseClient } from "@supabase/supabase-js";
import { AiUnavailable } from "../ai/config";
import { summariseTask } from "../ai/summary";
import { loadDetailed } from "./detailed";

const CONCURRENCY = 3;

/**
 * Writes the AI work summaries that are missing or whose evidence hash changed, at most `limit` per call, a few at a time.
 * A task whose evidence is unchanged is never sent to the model again. `only` restricts the work to given task ids (tests).
 * Prompts and outputs are not logged.
 */
export async function fillSummaries(
  supabase: SupabaseClient, areaId: string, listId: string, opts: { limit?: number; only?: string[] } = {},
) {
  const data = await loadDetailed(supabase, areaId, listId);
  if (!data) return null;
  // a task nobody has recorded anything for has nothing to summarise, so it is never sent to the model
  const scope = (opts.only ? data.blocks.filter((b) => opts.only!.includes(b.id)) : data.blocks).filter((b) => b.evidence.events.length > 0);
  const pending = scope.filter((b) => !b.summary || b.summaryStale);
  const todo = pending.slice(0, Math.max(1, opts.limit ?? 6));
  let generated = 0, failed = 0, unavailable = false;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(async (b) => {
      try {
        const out = await summariseTask(b.evidence);
        const { error } = await supabase.rpc("task_summary_save", { p_task: b.id, p_hash: b.hash, p_text: out.text, p_model: out.model });
        if (error) throw new Error(error.message);
        generated++;
      } catch (e) {
        if (e instanceof AiUnavailable) unavailable = true;
        failed++;
      }
    }));
  }
  return { total: scope.length, cached: scope.length - pending.length, generated, failed, pending: pending.length - generated, unavailable };
}
