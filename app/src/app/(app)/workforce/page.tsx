import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { navOf } from "@/lib/nav";
import { Screen } from "@/components/Screen";
import { WorkforceClient } from "@/components/WorkforceClient";

export const dynamic = "force-dynamic";

export default async function WorkforcePage() {
  const ctx = await requireCtx({ managerOnly: true });
  const { list, sections, persons, tasks } = await loadBoard(ctx);
  const load: Record<string, number> = {};
  tasks.forEach((t) => t.responsible_person_id && (load[t.responsible_person_id] = (load[t.responsible_person_id] ?? 0) + 1));
  return (
    <Screen title="Workforce" sub="People and vendor teams in this area" back="/" short wide nav={navOf(ctx, list?.id, tasks.filter((t) => !t.responsible_person_id).length)}>
      <WorkforceClient persons={persons} load={load} unassigned={tasks.filter((t) => !t.responsible_person_id).length} sections={sections.map((s) => s.name)} />
    </Screen>
  );
}
