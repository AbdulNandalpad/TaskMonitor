import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";
import { isManagerRole, type Role } from "./roles";

export const AREA_CODE = process.env.NEXT_PUBLIC_AREA_CODE ?? "bf1";
export const AREA_COOKIE = "tm_area";

/** The user never sees this address; Supabase Auth just needs one. */
export const loginIdToEmail = (login: string) => `${login.trim().toLowerCase()}@users.taskmonitor.local`;

export type AreaRef = { id: string; code: string; name: string };
export type Profile = { id: string; login: string; display_name: string; language: string; must_change_password: boolean };
export type Ctx = {
  supabase: SupabaseClient;
  userId: string;
  profile: Profile;
  memberships: { role: Role; area: AreaRef }[];
  area: AreaRef;
  role: Role;
  isManager: boolean;
};

export async function loadMemberships(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("membership").select("role, area:area_id(id, code, name)").eq("user_id", userId);
  return ((data ?? []) as unknown as { role: Role; area: AreaRef }[]).filter((m) => m.area);
}

/**
 * Every signed-in page starts here. Redirects to /login when there is no session, to the scope refusal when the user
 * has no membership in this deployment's area, to /password on first login, and to /areas when several areas need a choice.
 */
export async function requireCtx(opts: { allowNoArea?: boolean; managerOnly?: boolean } = {}): Promise<Ctx> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("id, login, display_name, language, must_change_password").eq("id", auth.user.id).maybeSingle();
  if (!profile) redirect("/api/auth/logout?next=/login");
  const memberships = await loadMemberships(supabase, auth.user.id);
  if (!memberships.some((m) => m.area.code === AREA_CODE)) {
    redirect(`/api/auth/logout?reason=scope&name=${encodeURIComponent(profile.display_name)}`);
  }
  if (profile.must_change_password) redirect("/password");

  const chosen = (await cookies()).get(AREA_COOKIE)?.value;
  let active = memberships.find((m) => m.area.id === chosen);
  if (!active) {
    if (memberships.length === 1) active = memberships[0];
    else if (opts.allowNoArea) active = memberships.find((m) => m.area.code === AREA_CODE) ?? memberships[0];
    else redirect("/areas");
  }
  const ctx: Ctx = {
    supabase, userId: auth.user.id, profile, memberships,
    area: active!.area, role: active!.role, isManager: isManagerRole(active!.role),
  };
  if (opts.managerOnly && !ctx.isManager) redirect("/");
  return ctx;
}
