import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { fieldLabel, fmtValue, fmtWhen } from "@/lib/format";
import { navOf } from "@/lib/nav";
import { STATUS, type Task } from "@/lib/types";
import { Screen } from "@/components/Screen";
import { Cam, Chk, Mic, Pen } from "@/components/Icons";
import { TaskActions } from "@/components/TaskActions";
import { EditTask } from "@/components/EditTask";
import { MicButton } from "@/components/VoiceSheet";

export const dynamic = "force-dynamic";

type UpdateRow = {
  id: string; type: string; by_user: string | null; at: string; status_after: string | null; text: string | null;
  extracted: { changes?: [string, unknown, unknown][]; status?: string; progress?: number; manpower?: number } | null;
  confirmed: { status?: string; progress?: number; manpower?: number; remarks?: string } | null;
};
type Att = { id: string; task_update_id: string; kind: string; object_key: string };
type VersionRow = { id: string; version: number; changed_by: string | null; changed_at: string; source: string; note: string | null };
type Change = { task_version_id: string; field_key: string; old_value: unknown; new_value: unknown; raw_input: string | null };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { supabase } = ctx;
  const { data: row } = await supabase
    .from("task_current")
    .select("id, seq, section_id, status, progress, responsible_person_id, version, values, changed_by, changed_at, source")
    .eq("id", id).maybeSingle();
  if (!row) notFound();
  const task = row as Task;

  const [{ list, sections, persons, tasks }, updatesRes, attRes, versRes, chRes] = await Promise.all([
    loadBoard(ctx),
    supabase.from("task_update").select("id, type, by_user, at, status_after, text, extracted, confirmed").eq("task_id", id).order("at", { ascending: false }),
    supabase.from("attachment").select("id, task_update_id, kind, object_key").in("task_update_id",
      ((await supabase.from("task_update").select("id").eq("task_id", id)).data ?? []).map((u) => u.id)),
    supabase.from("task_version").select("id, version, changed_by, changed_at, source, note").eq("task_id", id).order("version", { ascending: false }),
    supabase.from("task_field_change").select("task_version_id, field_key, old_value, new_value, raw_input").eq("task_id", id),
  ]);
  const updates = (updatesRes.data ?? []) as UpdateRow[];
  const atts = (attRes.data ?? []) as Att[];
  const versions = (versRes.data ?? []) as VersionRow[];
  const changes = (chRes.data ?? []) as Change[];

  const userIds = [...new Set([...updates.map((u) => u.by_user), ...versions.map((v) => v.changed_by)].filter(Boolean))] as string[];
  const { data: profs } = userIds.length ? await supabase.from("profiles").select("id, display_name").in("id", userIds) : { data: [] };
  const who = new Map((profs ?? []).map((p) => [p.id, p.display_name as string]));

  const signed = new Map<string, string>();
  if (atts.length) {
    const { data: urls } = await supabase.storage.from("attachments").createSignedUrls(atts.map((a) => a.object_key), 3600);
    (urls ?? []).forEach((u, i) => u.signedUrl && signed.set(atts[i].id, u.signedUrl));
  }

  const section = sections.find((s) => s.id === task.section_id);
  const resp = persons.find((p) => p.id === task.responsible_person_id);
  const monitor = persons.find((p) => p.id === section?.head_person_id);
  const v = task.values;
  const latest = versions[0];

  return (
    <Screen
      title={section?.name ?? "Task"}
      sub={`Task ${task.seq}${monitor ? ` · Monitor: ${monitor.name}` : ""}`}
      back={section ? `/sections/${section.id}` : "/"}
      wide
      nav={navOf(ctx, list?.id)}
      actions={ctx.isManager ? <EditTask task={task} sections={sections} persons={persons} /> : null}
    >
      <div className="task">
      <div className="task-main">
      <div className="card pad jd">
        <div className="desc">{v.work_description}</div>
        <div className="meta">
          <div className="kv"><b>Planned</b><span className="num">{v.planned_hours ?? 0} h</span></div>
          <div className="kv"><b>Manpower</b><span className="num">{v.manpower ?? 0} people</span></div>
          <div className="kv"><b>Responsible</b><span>{resp ? resp.name : <span style={{ color: "var(--warn-ink)" }}>Unassigned</span>}</span></div>
          <div className="kv"><b>Vendor</b><span>{v.vendor ? v.vendor : "In‑house"}</span></div>
        </div>
        <div className="ver">
          <span className={`chip ${task.version > 1 ? "accent" : ""}`}>Version {task.version}</span>
          <span className="note">
            {task.version > 1 && latest
              ? `edited by ${who.get(latest.changed_by ?? "") ?? "someone"} · ${fmtWhen(latest.changed_at)}`
              : "as imported · old values are kept on every edit"}
          </span>
        </div>
      </div>

      <TaskActions task={{ id: task.id, seq: task.seq, status: task.status, progress: task.progress }} areaId={ctx.area.id} canUpdate={ctx.role !== "viewer"} />
      </div>
      <div className="task-side">

      <div className="sec">Updates · {updates.length}</div>
      <div className="card timeline">
        {updates.length ? updates.map((u) => {
          const ua = atts.filter((a) => a.task_update_id === u.id);
          const photos = ua.filter((a) => a.kind === "photo" && signed.get(a.id));
          const audio = ua.filter((a) => a.kind === "audio" && signed.get(a.id));
          const ex: [string, string][] =
            u.type === "voice" && u.confirmed
              ? [["Status", STATUS[(u.confirmed.status as keyof typeof STATUS) ?? "not_started"]?.label ?? "–"], ["Progress", `${u.confirmed.progress ?? 0}%`],
                 ...(u.confirmed.manpower != null ? [["Manpower", String(u.confirmed.manpower)] as [string, string]] : []),
                 ...(u.confirmed.remarks ? [["Remark", u.confirmed.remarks] as [string, string]] : [])]
              : (u.extracted?.changes ?? []).map(([k, o, n]) => [fieldLabel[k] ?? k, `${fmtValue(k, o)} → ${fmtValue(k, n)}`] as [string, string]);
          const cls = u.type === "voice" ? "voice" : u.type === "photo" ? "photo" : u.type === "edit" || u.type === "assignment" ? "edit" : "";
          return (
            <div className="upd" key={u.id}>
              <div className={`ic ${cls}`}>{u.type === "voice" ? <Mic /> : u.type === "photo" ? <Cam /> : cls === "edit" ? <Pen /> : <Chk />}</div>
              <div>
                <div className="hd"><b>{who.get(u.by_user ?? "") ?? "System"}</b><span>{fmtWhen(u.at)}</span></div>
                <div className="tx">{u.type === "voice" ? <q>“{u.text}”</q> : u.text}</div>
                {ex.length ? <div className="ex">{ex.map(([a, b], i) => <span className="chip" key={i}>{a}: {b}</span>)}</div> : null}
                {photos.length ? (
                  <div className="photos">
                    {photos.map((a) => (
                      <div className="ph" key={a.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={signed.get(a.id)} alt="Uploaded photo" /><span>{u.status_after === "completed" ? "After" : "Before"}</span></div>
                    ))}
                  </div>
                ) : null}
                {audio.map((a) => <audio key={a.id} controls preload="none" src={signed.get(a.id)} style={{ width: "100%", marginTop: 8 }} />)}
              </div>
            </div>
          );
        }) : (
          <div className="empty"><Mic /><b>No updates yet</b><span>Tap the mic to record the first one.</span></div>
        )}
      </div>

      <div className="sec">Field history · {versions.length} version{versions.length === 1 ? "" : "s"}</div>
      <div className="card hist">
        {versions.map((h) => {
          const ch = changes.filter((c) => c.task_version_id === h.id);
          return (
            <div className="hrow" key={h.id}>
              <span className="v">v{h.version}</span>
              <div>
                <div><b>{who.get(h.changed_by ?? "") ?? "System"}</b> <span className="w">· {fmtWhen(h.changed_at)}{h.version === 1 && h.note ? ` · ${h.note}` : ""}</span></div>
                {ch.length ? (
                  <div className="ch">
                    {ch.map((c, i) => (
                      <span key={i}><b>{fieldLabel[c.field_key] ?? c.field_key}:</b> <s>{fmtValue(c.field_key, c.old_value)}</s> → {fmtValue(c.field_key, c.new_value)}
                        {c.raw_input ? <span className="raw"> (read from “{c.raw_input}”)</span> : null}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      </div>
      </div>
      <MicButton taskId={task.id} tasks={tasks.map((t) => ({ id: t.id, seq: t.seq, title: String(t.values.work_description ?? "") }))}
        current={{ id: task.id, seq: task.seq, title: String(v.work_description ?? ""), status: task.status, progress: task.progress, manpower: v.manpower ?? null }}
        language={ctx.profile.language} areaId={ctx.area.id} canUpdate={ctx.role !== "viewer"} />
    </Screen>
  );
}
