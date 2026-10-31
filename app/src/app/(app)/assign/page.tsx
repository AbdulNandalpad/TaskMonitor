import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { navOf } from "@/lib/nav";
import { Screen } from "@/components/Screen";
import { AssignClient } from "@/components/AssignClient";

export const dynamic = "force-dynamic";

export default async function AssignPage() {
  const ctx = await requireCtx({ managerOnly: true });
  const { list, sections, persons, tasks } = await loadBoard(ctx);
  return (
    <Screen title="Assign tasks" sub={list?.name} back="/" short wide nav={navOf(ctx, list?.id, tasks.filter((t) => !t.responsible_person_id).length)}>
      <AssignClient tasks={tasks} persons={persons} sections={sections.map((s) => ({ id: s.id, name: s.name }))} />
    </Screen>
  );
}
