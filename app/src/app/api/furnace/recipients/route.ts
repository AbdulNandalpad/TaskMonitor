import { NextResponse } from "next/server";
import { faApi } from "@/lib/fa/guard";
import { dbError } from "@/lib/fa/http";

/** Who receives the findings emails. Administrators only. */
export async function POST(req: Request) {
  const g = await faApi({ admin: true });
  if ("res" in g) return g.res;
  const b = await req.json().catch(() => null);
  if (!b || typeof b.email !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { data, error } = await g.ctx.supabase.rpc("fa_recipient_save", {
    p_id: typeof b.id === "string" ? b.id : null, p_converter: typeof b.converter_id === "string" && b.converter_id ? b.converter_id : null,
    p_name: String(b.name ?? "").slice(0, 120), p_email: b.email, p_min: b.min_severity === "critical" ? "critical" : "warning", p_active: b.active !== false,
  });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true, id: data });
}

export async function DELETE(req: Request) {
  const g = await faApi({ admin: true });
  if ("res" in g) return g.res;
  const b = await req.json().catch(() => null);
  if (!b || typeof b.id !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { error } = await g.ctx.supabase.rpc("fa_recipient_delete", { p_id: b.id });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
