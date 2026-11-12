import { NextResponse } from "next/server";
import { faApi } from "@/lib/fa/guard";
import { dbError } from "@/lib/fa/http";

/** Saves the limits of a converter as a new version (administrators). The previous version is kept for the scans that used it. */
export async function POST(req: Request) {
  const g = await faApi({ admin: true });
  if ("res" in g) return g.res;
  const b = await req.json().catch(() => null);
  if (!b || typeof b.converter_id !== "string" || !Array.isArray(b.rows) || b.rows.length > 500) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const rows = b.rows.map((r: Record<string, unknown>) => ({
    zone: String(r.zone ?? "*").slice(0, 80), metric: r.metric === "avg" ? "avg" : "min",
    warn_below: r.warn_below ?? null, critical_below: r.critical_below ?? null,
    rec_warning: r.rec_warning == null ? null : String(r.rec_warning).slice(0, 500), rec_critical: r.rec_critical == null ? null : String(r.rec_critical).slice(0, 500),
  }));
  for (const r of rows) {
    const w = r.warn_below == null || r.warn_below === "" ? null : Number(r.warn_below), c = r.critical_below == null || r.critical_below === "" ? null : Number(r.critical_below);
    if ((w != null && !Number.isFinite(w)) || (c != null && !Number.isFinite(c))) return NextResponse.json({ error: "Limits must be numbers" }, { status: 400 });
    if (w != null && c != null && c > w) return NextResponse.json({ error: `${r.zone}: the critical level must not be above the warning level` }, { status: 400 });
  }
  const { data, error } = await g.ctx.supabase.rpc("fa_limits_save", { p_converter: b.converter_id, p_note: typeof b.note === "string" ? b.note.slice(0, 300) : null, p_rows: rows });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true, id: data });
}
