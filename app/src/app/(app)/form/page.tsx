import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { navOf } from "@/lib/nav";
import { FORM_EDIT_ROLES } from "@/lib/roles";
import { Screen } from "@/components/Screen";
import { FormClient, type FieldRow } from "@/components/FormClient";

export const dynamic = "force-dynamic";

export default async function FormPage() {
  const ctx = await requireCtx();
  const { list } = await loadBoard(ctx);
  if (!list?.form_id) return <Screen title="Form settings" back="/" nav={navOf(ctx)}><div className="card empty"><b>No form yet</b></div></Screen>;
  const { data: form } = await ctx.supabase.from("form").select("id, name, current_version_id").eq("id", list.form_id).single();
  const { data: ver } = await ctx.supabase.from("form_version").select("version").eq("id", form!.current_version_id).single();
  const { data: fields } = await ctx.supabase.from("form_field").select("key, label, type, required, options, position")
    .eq("form_version_id", form!.current_version_id).order("position");
  return (
    <Screen title="Form settings" sub="Fields every task in this list carries" back="/" short nav={navOf(ctx, list.id)}>
      <FormClient formId={form!.id} listName={list.name} version={ver?.version ?? 1} fields={(fields ?? []) as FieldRow[]} canEdit={FORM_EDIT_ROLES.includes(ctx.role)} />
    </Screen>
  );
}
