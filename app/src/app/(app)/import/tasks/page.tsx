import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { navOf } from "@/lib/nav";
import { Screen } from "@/components/Screen";
import { ImportTasks } from "@/components/ImportTasks";

export const dynamic = "force-dynamic";

export default async function ImportTasksPage() {
  const ctx = await requireCtx({ managerOnly: true });
  const { list, sections, tasks } = await loadBoard(ctx);
  const secName = new Map(sections.map((s) => [s.id, s.name]));
  const existing = tasks.map((t) => `${(secName.get(t.section_id ?? "") ?? "").trim().toLowerCase()}|${String(t.values.work_description ?? "").trim().toLowerCase()}`);
  return (
    <Screen title="Import tasks from Excel" sub={list?.name} back="/" short nav={navOf(ctx, list?.id)}>
      <ImportTasks existing={existing} />
    </Screen>
  );
}
