import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";

/** One app in the platform (Task Monitor, Furnace Analysis, ...). Access is per app and denied unless granted (migration 0007). */
export type AppInfo = { code: string; name: string; description: string | null; home_path: string; position: number };

export const TASK_MONITOR = "task_monitor";

/**
 * Apps the signed-in user has been given and that are switched on. The database decides; nothing here widens it.
 * If migration 0007 has not been applied yet, the user is treated as having Task Monitor only (the single-app product).
 */
export async function myApps(supabase: SupabaseClient): Promise<AppInfo[]> {
  const { data, error } = await supabase.rpc("my_apps");
  // Before migration 0007 is applied the function does not exist: behave as the single-app product it was (Task Monitor only)
  if (error && /my_apps/.test(error.message) && ["PGRST202", "42883"].includes(error.code)) return [LEGACY_TASK_MONITOR];
  return (data ?? []) as AppInfo[];
}

const LEGACY_TASK_MONITOR: AppInfo = { code: TASK_MONITOR, name: "Task Monitor", description: null, home_path: "/", position: 1 };

/**
 * What the user can actually open from this deployment. Task Monitor is bound to one area per deployment, so a user whose
 * Task Monitor access has no membership in that area does not get the Task Monitor tile.
 */
export function openable(apps: AppInfo[], memberships: { area: { code: string } }[], areaCode: string): AppInfo[] {
  const inArea = memberships.some((m) => m.area.code === areaCode);
  return apps.filter((a) => a.code !== TASK_MONITOR || inArea);
}

export async function isPlatformAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin");
  return !error && data === true;
}

/**
 * Guard for pages of an app other than Task Monitor: needs a session, a finished first-login password change and the app
 * itself. Anyone else is sent to the launcher, which sends them on or signs them out.
 */
export async function requireApp(code: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id, login, display_name, must_change_password").eq("id", auth.user.id).maybeSingle();
  if (!profile) redirect("/api/auth/logout?next=/login");
  if (profile.must_change_password) redirect("/password");
  const apps = await myApps(supabase);
  const app = apps.find((a) => a.code === code);
  if (!app) redirect("/launch");
  return { supabase, userId: auth.user.id, profile, app, apps };
}
