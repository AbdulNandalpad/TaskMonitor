import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { navOf } from "@/lib/nav";
import { Screen } from "@/components/Screen";
import { TaskListClient, type ListRow } from "@/components/TaskListClient";

export const dynamic = "force-dynamic";

/** Read-only list of every task in the area. Filters come from the query string so the dashboard tiles can link here. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<{ status?: string; section?: string; assignee?: string; q?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const { list, sections, persons, tasks } = await loadBoard(ctx);
  const secIndex = new Map(sections.map((s, i) => [s.id, i]));
  const secName = new Map(sections.map((s) => [s.id, s.name]));
  const pName = new Map(persons.map((p) => [p.id, p.name]));
  const rows: ListRow[] = tasks
    .map((t) => ({
      id: t.id, seq: t.seq, section_id: t.section_id, status: t.status, progress: t.progress, version: t.version, values: t.values,
      responsible_person_id: t.responsible_person_id, changed_by: t.changed_by, changed_at: t.changed_at, source: t.source,
      sectionName: secName.get(t.section_id ?? "") ?? "", resp: t.responsible_person_id ? pName.get(t.responsible_person_id) ?? null : null,
    }))
    .sort((a, b) => (secIndex.get(a.section_id ?? "") ?? 99) - (secIndex.get(b.section_id ?? "") ?? 99) || a.seq - b.seq);
  return (
    <Screen title="All tasks" sub={list ? `${list.name} · ${tasks.length} tasks` : undefined} back="/" wide short nav={navOf(ctx, list?.id, tasks.filter((t) => !t.responsible_person_id).length)}>
      <TaskListClient
        rows={rows}
        sections={sections.map((s) => ({ id: s.id, name: s.name, head: persons.find((p) => p.id === s.head_person_id)?.name ?? null }))}
        userId={ctx.userId}
        persons={persons.map((p) => ({ id: p.id, name: p.name }))}
        initial={{ status: sp.status ?? "all", section: sp.section ?? "", assignee: sp.assignee ?? "", q: sp.q ?? "" }}
      />
    </Screen>
  );
}
