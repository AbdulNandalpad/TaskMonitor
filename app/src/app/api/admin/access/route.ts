import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Give or take away an app for a user. Only platform administrators; the database function checks it again. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.login !== "string" || typeof b.app !== "string" || typeof b.on !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { error } = await supabase.rpc("app_access_set", { p_login: b.login, p_app: b.app, p_on: b.on });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  return NextResponse.json({ ok: true });
}
