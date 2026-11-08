import { NextResponse } from "next/server";
import { faApi } from "@/lib/fa/guard";
import { dbError } from "@/lib/fa/http";

/** Create or rename a converter, so its limits can be set before the first report arrives. Administrators only. */
export async function POST(req: Request) {
  const g = await faApi({ admin: true });
  if ("res" in g) return g.res;
  const b = await req.json().catch(() => null);
  if (!b || typeof b.code !== "string" || typeof b.name !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { data, error } = await g.ctx.supabase.rpc("fa_converter_save", { p_code: b.code, p_name: b.name, p_plant: String(b.plant ?? "") });
  if (error) return dbError(error);
  return NextResponse.json({ ok: true, id: data });
}
