import { redirect } from "next/navigation";
import { AREA_CODE, loadMemberships } from "@/lib/auth";
import { isPlatformAdmin, myApps, openable } from "@/lib/apps";
import { createClient } from "@/lib/supabase/server";
import { AppChooser } from "@/components/AppChooser";

export const dynamic = "force-dynamic";

/** "All apps": the chooser again, for people who switch between apps. Same rules as /launch but it never skips the choice. */
export default async function Apps() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name, must_change_password").eq("id", auth.user.id).maybeSingle();
  if (!profile) redirect("/api/auth/logout?next=/login");
  if (profile.must_change_password) redirect("/password");
  const [memberships, apps] = await Promise.all([loadMemberships(supabase, auth.user.id), myApps(supabase)]);
  const open = openable(apps, memberships, AREA_CODE);
  if (!open.length) redirect("/launch");
  return <AppChooser user={profile.display_name} apps={open} admin={await isPlatformAdmin(supabase)} />;
}
