import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { navOf } from "@/lib/nav";
import { Screen } from "@/components/Screen";
import { NewTaskForm } from "@/components/NewTaskForm";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const ctx = await requireCtx({ managerOnly: true });
  const { list, sections, persons } = await loadBoard(ctx);
  const { data: fv } = list?.form_id
    ? await ctx.supabase.from("form").select("name, form_version:current_version_id(version)").eq("id", list.form_id).maybeSingle()
    : { data: null };
  const ver = (fv as unknown as { name: string; form_version: { version: number } | null } | null);
  return (
    <Screen title="Create task" sub={`${ver?.name ?? "Shutdown jobs"} form${ver?.form_version ? ` · v${ver.form_version.version}` : ""}`} back="/" short nav={navOf(ctx, list?.id)}>
      {list ? <NewTaskForm listId={list.id} sections={sections} persons={persons} /> : <div className="card empty"><b>No task list yet</b></div>}
    </Screen>
  );
}
