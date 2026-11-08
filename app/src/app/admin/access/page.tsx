import { redirect } from "next/navigation";
import Link from "next/link";
import { isPlatformAdmin } from "@/lib/apps";
import { createClient } from "@/lib/supabase/server";
import { AccessClient } from "./AccessClient";

export const dynamic = "force-dynamic";

/** Who can open which app. Platform administrators only. */
export default async function AccessPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  if (!(await isPlatformAdmin(supabase))) redirect("/launch");
  const [{ data: apps }, { data: users }] = await Promise.all([
    supabase.from("app").select("code, name, enabled").order("position"),
    supabase.rpc("platform_users"),
  ]);
  return (
    <main className="launch">
      <header className="launch-hd"><span className="launch-brand"><b>Access</b></span><Link className="btn" href="/launch">Back</Link></header>
      <section className="launch-body">
        <h1>Who can open which app</h1>
        <p className="note">Nobody gets an app unless it is switched on for them here. A switched-off app (marked) is not shown to anyone yet.</p>
        <AccessClient apps={apps ?? []} users={(users ?? []) as { login: string; display_name: string; active: boolean; apps: string[] }[]} />
      </section>
    </main>
  );
}
