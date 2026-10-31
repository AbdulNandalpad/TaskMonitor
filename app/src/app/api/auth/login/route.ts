import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AREA_CODE, AREA_COOKIE, loadMemberships, loginIdToEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { login, password } = await req.json().catch(() => ({}));
  if (!login || !password) return NextResponse.json({ error: "User ID or password is incorrect." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(String(login)), password: String(password) });
  if (error || !data.user) return NextResponse.json({ error: "User ID or password is incorrect." }, { status: 401 });

  const [{ data: profile }, memberships] = await Promise.all([
    supabase.from("profiles").select("display_name, must_change_password").eq("id", data.user.id).maybeSingle(),
    loadMemberships(supabase, data.user.id),
  ]);
  const name = profile?.display_name ?? String(login);
  (await cookies()).delete(AREA_COOKIE);

  if (!memberships.some((m) => m.area.code === AREA_CODE)) {
    // audit while still signed in (log_audit runs as the user), then sign out at once
    await supabase.rpc("log_audit", { p_action: "login_refused_scope", p_area_code: AREA_CODE, p_detail: { login: String(login), name } });
    await supabase.auth.signOut();
    return NextResponse.json({ scope: true, name });
  }
  await supabase.rpc("log_audit", { p_action: "login_ok", p_area_code: AREA_CODE, p_detail: { login: String(login) } });
  const next = profile?.must_change_password ? "/password" : memberships.length > 1 ? "/areas" : "/";
  return NextResponse.json({ ok: true, next });
}
