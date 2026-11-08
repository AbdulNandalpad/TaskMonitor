import { NextResponse } from "next/server";
import { faApi } from "@/lib/fa/guard";
import { dbError } from "@/lib/fa/http";

/** Gives a person a Furnace Analysis role (analyst, viewer, admin) or removes it. The person must already have the app (access screen). */
export async function POST(req: Request) {
  const g = await faApi({ admin: true });
  if ("res" in g) return g.res;
  const b = await req.json().catch(() => null);
  if (!b || typeof b.login !== "string" || !["admin", "analyst", "viewer", "none"].includes(b.role)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { error } = await g.ctx.supabase.rpc("fa_role_set", { p_login: b.login, p_role: b.role });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true });
}
