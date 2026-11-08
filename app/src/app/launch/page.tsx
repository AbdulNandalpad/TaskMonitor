import { redirect } from "next/navigation";
import { AREA_CODE, loadMemberships } from "@/lib/auth";
import { isPlatformAdmin, myApps, openable } from "@/lib/apps";
import { createClient } from "@/lib/supabase/server";
import { AppChooser } from "@/components/AppChooser";

export const dynamic = "force-dynamic";

/**
 * Where every sign-in lands. No app: back to the sign-in screen with the reason. One app: straight into it. Several: the chooser.
 */
export default async function Launch() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name, must_change_password").eq("id", auth.user.id).maybeSingle();
  if (!profile) redirect("/api/auth/logout?next=/login");
  if (profile.must_change_password) redirect("/password");
  const [memberships, apps] = await Promise.all([loadMemberships(supabase, auth.user.id), myApps(supabase)]);
  const open = openable(apps, memberships, AREA_CODE);
  if (!open.length) redirect(`/api/auth/logout?reason=${apps.length ? "scope" : "noapp"}&name=${encodeURIComponent(profile.display_name)}`);
  if (open.length === 1) redirect(open[0].home_path);
  return <AppChooser user={profile.display_name} apps={open} admin={await isPlatformAdmin(supabase)} />;
}
