import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AREA_CODE, AREA_COOKIE, loadMemberships, loginIdToEmail } from "@/lib/auth";
import { myApps, openable, TASK_MONITOR } from "@/lib/apps";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { login, password } = await req.json().catch(() => ({}));
  if (!login || !password) return NextResponse.json({ error: "User ID or password is incorrect." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(String(login)), password: String(password) });
  if (error || !data.user) return NextResponse.json({ error: "User ID or password is incorrect." }, { status: 401 });

  const [{ data: profile }, memberships, apps] = await Promise.all([
    supabase.from("profiles").select("display_name, must_change_password").eq("id", data.user.id).maybeSingle(),
    loadMemberships(supabase, data.user.id),
    myApps(supabase),
  ]);
  const name = profile?.display_name ?? String(login);
  (await cookies()).delete(AREA_COOKIE);

  // what this user can open here: apps they were given, and Task Monitor only when they belong to this deployment's area
  const open = openable(apps, memberships, AREA_CODE);
  if (!open.length) {
    // audit while still signed in (log_audit runs as the user), then sign out at once
    const scope = apps.some((a) => a.code === TASK_MONITOR);
    await supabase.rpc("log_audit", { p_action: scope ? "login_refused_scope" : "login_refused_no_app", p_area_code: AREA_CODE, p_detail: { login: String(login), name } });
    await supabase.auth.signOut();
    return NextResponse.json(scope ? { scope: true, name } : { noApp: true, name });
  }
  await supabase.rpc("log_audit", { p_action: "login_ok", p_area_code: AREA_CODE, p_detail: { login: String(login) } });
  let next: string;
  if (profile?.must_change_password) next = "/password";
  else if (open.length > 1) next = "/apps";
  else if (open[0].code === TASK_MONITOR) next = memberships.length > 1 ? "/areas" : "/";
  else next = open[0].home_path;
  return NextResponse.json({ ok: true, next });
}
