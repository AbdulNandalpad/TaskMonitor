import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasAnthropic } from "@/lib/ai/config";
import { loadDetailed } from "@/lib/report/detailed";
import { fillSummaries } from "@/lib/report/summaries";

export const maxDuration = 60;

/**
 * Fills the AI work summaries the detailed report needs (managers and area admins). Evidence is hashed per task and the model
 * is called only for tasks whose hash changed or that have no summary. Each call handles up to `limit` tasks so the browser
 * can show progress; call again until `pending` is 0. Prompts and outputs are not logged.
 */
export async function POST(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: list } = await supabase.from("task_list").select("id, area_id").eq("id", listId).maybeSingle();
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: m } = await supabase.from("membership").select("role").eq("user_id", auth.user.id).eq("area_id", list.area_id).maybeSingle();
  if (!m || !["manager", "area_admin"].includes(m.role)) return NextResponse.json({ error: "Managers only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(12, Number(body?.limit) || 6));
  if (!hasAnthropic()) {
    const data = await loadDetailed(supabase, list.area_id, listId);
    const pending = data ? data.blocks.filter((b) => !b.summary || b.summaryStale).length : 0;
    // nothing to write when everything is cached, even without a key
    if (!pending) return NextResponse.json({ total: data?.blocks.length ?? 0, cached: data?.blocks.length ?? 0, generated: 0, failed: 0, pending: 0 });
    return NextResponse.json({ error: "AI summaries are not configured", total: data?.blocks.length ?? 0, pending }, { status: 503 });
  }
  const out = await fillSummaries(supabase, list.area_id, listId, { limit });
  if (!out) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(out);
}
