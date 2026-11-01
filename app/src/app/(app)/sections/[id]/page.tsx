import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { stats } from "@/lib/format";
import { navOf } from "@/lib/nav";
import { Screen } from "@/components/Screen";
import { SectionTasks } from "@/components/SectionTasks";
import { MicButton } from "@/components/VoiceSheet";
import { EditSection } from "@/components/EditNames";

export const dynamic = "force-dynamic";

export default async function SectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { list: board, sections, persons, tasks } = await loadBoard(ctx);
  const section = sections.find((s) => s.id === id);
  if (!section) notFound();
  const list = tasks.filter((t) => t.section_id === id);
  const s = stats(list);
  const head = persons.find((p) => p.id === section.head_person_id);
  const nameOf = new Map(persons.map((p) => [p.id, p.name]));
  return (
    <Screen title={section.name} sub={`${s.n} tasks · ${s.pct}% complete${head ? ` · ${head.name}` : ""}`} back="/" actions={ctx.isManager ? <EditSection section={section} persons={persons} /> : null} nav={navOf(ctx, board?.id, tasks.filter((t) => !t.responsible_person_id).length)}>
      <SectionTasks
        tasks={list.map((t) => ({
          id: t.id, status: t.status, progress: t.progress, version: t.version, values: t.values,
          resp: t.responsible_person_id ? nameOf.get(t.responsible_person_id) ?? null : null, responsible_person_id: t.responsible_person_id,
          seq: t.seq, section_id: t.section_id, changed_by: t.changed_by, changed_at: t.changed_at, source: t.source,
        }))}
      />
      <MicButton tasks={tasks.map((t) => ({ id: t.id, seq: t.seq, title: String(t.values.work_description ?? "") }))} language={ctx.profile.language} />
    </Screen>
  );
}
