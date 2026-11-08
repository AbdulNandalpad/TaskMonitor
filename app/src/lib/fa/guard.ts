import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApp } from "../apps";
import { createClient } from "../supabase/server";

export const FA = "furnace_analysis";

export type FaCtx = { supabase: SupabaseClient; userId: string; name: string; canEdit: boolean; isAdmin: boolean; multiApp: boolean };

const flags = async (supabase: SupabaseClient) => {
  const [e, a] = await Promise.all([supabase.rpc("fa_can_edit"), supabase.rpc("fa_is_admin")]);
  return { canEdit: e.data === true, isAdmin: a.data === true };
};

/** Every Furnace Analysis page starts here: the app itself, then the extra role the page needs. Others go back to the dashboard. */
export async function requireFa(opts: { edit?: boolean; admin?: boolean } = {}): Promise<FaCtx> {
  const { supabase, userId, profile, apps } = await requireApp(FA);
  const f = await flags(supabase);
  if (opts.admin && !f.isAdmin) redirect("/furnace");
  if (opts.edit && !f.canEdit) redirect("/furnace");
  return { supabase, userId, name: profile.display_name, multiApp: apps.length > 1, ...f };
}

/** Same checks for API routes: a JSON error instead of a redirect. */
export async function faApi(opts: { edit?: boolean; admin?: boolean } = {}): Promise<{ ctx: FaCtx } | { res: NextResponse }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { res: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  const { data: has } = await supabase.rpc("has_app", { p_app: FA });
  if (has !== true) return { res: NextResponse.json({ error: "No access to Furnace Analysis" }, { status: 403 }) };
  const f = await flags(supabase);
  if ((opts.admin && !f.isAdmin) || (opts.edit && !f.canEdit)) return { res: NextResponse.json({ error: "Not allowed" }, { status: 403 }) };
  return { ctx: { supabase, userId: auth.user.id, name: "", multiApp: false, ...f } };
}
