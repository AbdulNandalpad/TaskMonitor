import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { fmtStamp, fmtWhen, stats } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { Back } from "@/components/Icons";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

const Mini = ({ s }: { s: { n: number; done: number; prog: number; open: number } }) => {
  const n = s.n || 1;
  return (
    <div className="mini">
      <i style={{ width: `${(s.done / n) * 100}%`, background: "#16a34a" }} />
      <i style={{ width: `${(s.prog / n) * 100}%`, background: "#f59e0b" }} />
      <i style={{ width: `${(s.open / n) * 100}%`, background: "#ef4444" }} />
    </div>
  );
};

export default async function ReportPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const ctx = await requireCtx({ managerOnly: true });
  const { list, sections, persons, tasks } = await loadBoard(ctx);
  if (!list || list.id !== listId) notFound();
  const { supabase, area } = ctx;
  const secName = new Map(sections.map((s) => [s.id, s.name]));
  const pName = new Map(persons.map((p) => [p.id, p.name]));
  const all = stats(tasks);
  const stamp = fmtStamp();

  const { data: updates } = await supabase.from("task_update")
    .select("id, task_id, type, by_user, at, text, text_original, edit_count, edited_at").in("task_id", tasks.map((t) => t.id)).order("at", { ascending: false }).limit(5000);
  const ups = updates ?? [];
  const lastRemark = new Map<string, string>();
  ups.forEach((u) => { if (u.text && ["voice", "note"].includes(u.type) && !lastRemark.has(u.task_id)) lastRemark.set(u.task_id, u.text); });
  const photoUpdates = ups.length
    ? (await supabase.from("attachment").select("id, task_update_id, object_key, created_at").eq("kind", "photo").in("task_update_id", ups.map((u) => u.id)).order("created_at", { ascending: false }).limit(8)).data ?? []
    : [];
  const { data: urls } = photoUpdates.length ? await supabase.storage.from("attachments").createSignedUrls(photoUpdates.map((p) => p.object_key), 3600) : { data: [] };
  const upById = new Map(ups.map((u) => [u.id, u]));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const userIds = [...new Set(ups.map((u) => u.by_user).filter(Boolean))] as string[];
  const { data: profs } = userIds.length ? await supabase.from("profiles").select("id, display_name").in("id", userIds) : { data: [] };
  const who = new Map((profs ?? []).map((p) => [p.id, p.display_name as string]));
  // corrected remarks: the report shows the corrected text (lastRemark above), the appendix lists both versions
  const edited = ups.filter((u) => (u.edit_count ?? 0) > 0 && u.text_original != null).slice(0, 12);
  const nPhotoUpdates = ups.filter((u) => u.type === "photo").length;

  const file = `${area.code.toUpperCase()}-Shutdown-Report`;
  const Head = ({ n }: { n: number }) => (
    <div className="ph-hd">
      <div><h1>{area.name} Shutdown · Task List Report</h1><div className="sub">{list.name} · Generated {stamp}</div></div>
      <div className="org"><b>Area · {area.name}</b><span className="org-brand"><LogoMark size={16} />Task Monitor · Page {n} of 3</span></div>
    </div>
  );
  const open = tasks.filter((t) => t.status === "not_started");
  const prog = tasks.filter((t) => t.status === "in_progress");

  return (
    <div className="reportwrap">
      <div className="ovbar no-print">
        <Link className="btn" href="/"><Back /><span className="d-only">Back to app</span></Link>
        <div className="ttl"><b>{file}.pdf</b><span>3 pages · generated {stamp}</span></div>
        <PrintButton />
      </div>
      <div className="ovbody">
        <div className="page">
          <Head n={1} />
          <h2>Summary</h2>
          <div className="sum">
            <div><div className="v">{all.pct}%</div><div className="l">Overall compliance</div></div>
            <div><div className="v">{all.done} / {all.n}</div><div className="l">Completed</div></div>
            <div><div className="v">{all.prog}</div><div className="l">In progress</div></div>
            <div><div className="v">{all.open}</div><div className="l">Not started</div></div>
          </div>
          <h2>Compliance by section</h2>
          <div className="tbl"><table>
            <thead><tr><th>Section</th><th>Monitor</th><th className="n">Tasks</th><th className="n">Done</th><th className="n">In progress</th><th className="n">Not started</th><th className="n">Compliance</th><th></th></tr></thead>
            <tbody>
              {sections.map((s) => {
                const st = stats(tasks.filter((t) => t.section_id === s.id));
                return <tr key={s.id}><td>{s.name}</td><td>{pName.get(s.head_person_id ?? "") ?? "–"}</td><td className="n">{st.n}</td><td className="n">{st.done}</td><td className="n">{st.prog || "–"}</td><td className="n">{st.open || "–"}</td><td className="n"><b>{st.pct}%</b></td><td><Mini s={st} /></td></tr>;
              })}
              <tr><td><b>Whole list</b></td><td></td><td className="n"><b>{all.n}</b></td><td className="n"><b>{all.done}</b></td><td className="n"><b>{all.prog}</b></td><td className="n"><b>{all.open}</b></td><td className="n"><b>{all.pct}%</b></td><td><Mini s={all} /></td></tr>
            </tbody>
          </table></div>
          <div className="foot"><span>Compiled from {ups.length} field updates entered in Task Monitor · {nPhotoUpdates} photo records</span><span>Confidential</span></div>
        </div>

        <div className="page">
          <Head n={2} />
          <h2>Not started · needs a decision</h2>
          <div className="tbl"><table>
            <thead><tr><th>#</th><th>Section</th><th>Task</th><th className="n">Planned</th><th>Responsible</th><th>Status</th></tr></thead>
            <tbody>{open.map((t) => (
              <tr key={t.id}><td className="n">{t.seq}</td><td>{secName.get(t.section_id ?? "")}</td><td>{t.values.work_description}</td><td className="n">{t.values.planned_hours ?? 0} h</td>
                <td>{t.responsible_person_id ? pName.get(t.responsible_person_id) : <b>Unassigned</b>}</td><td><span className="pill open">Not started</span></td></tr>
            ))}</tbody>
          </table></div>
          <h2>In progress at report time</h2>
          <div className="tbl"><table>
            <thead><tr><th>#</th><th>Section</th><th>Task</th><th className="n">Planned</th><th className="n">Progress</th><th>Last remark</th></tr></thead>
            <tbody>{prog.map((t) => (
              <tr key={t.id}><td className="n">{t.seq}</td><td>{secName.get(t.section_id ?? "")}</td><td>{t.values.work_description}</td><td className="n">{t.values.planned_hours ?? 0} h</td><td className="n">{t.progress}%</td><td>{lastRemark.get(t.id) ?? "–"}</td></tr>
            ))}</tbody>
          </table></div>
          <div className="foot"><span>Status and remarks as spoken by the responsible person and confirmed on device</span><span>Confidential</span></div>
        </div>

        <div className="page">
          <Head n={3} />
          <h2>Photo evidence (selection)</h2>
          {photoUpdates.length ? (
            <div className="pgrid">
              {photoUpdates.map((p, i) => {
                const u = upById.get(p.task_update_id);
                const t = u ? byId.get(u.task_id) : undefined;
                const url = urls?.[i]?.signedUrl;
                const d = String(t?.values.work_description ?? "");
                return (
                  <figure key={p.id}>
                    <div className="ph">{/* eslint-disable-next-line @next/next/no-img-element */}{url && <img src={url} alt="" />}</div>
                    <figcaption><b>Task {t?.seq} · {secName.get(t?.section_id ?? "")}</b>{d.slice(0, 48)}{d.length > 48 ? "…" : ""}<br />{u ? fmtWhen(u.at) : ""} · {who.get(u?.by_user ?? "") ?? ""}</figcaption>
                  </figure>
                );
              })}
            </div>
          ) : <div className="note">No photos have been attached yet.</div>}
          {edited.length ? (
            <>
              <h2>Appendix · corrected remarks</h2>
              <div className="tbl"><table>
                <thead><tr><th>Task</th><th>Entered by</th><th>Corrected text (shown in this report)</th><th>Original text</th></tr></thead>
                <tbody>{edited.map((u) => (
                  <tr key={u.id}><td className="n">{byId.get(u.task_id)?.seq}</td><td>{who.get(u.by_user ?? "") ?? ""}</td><td>{u.text}</td><td>{u.text_original}</td></tr>
                ))}</tbody>
              </table></div>
            </>
          ) : null}
          <h2>Sign‑off</h2>
          <div className="sig"><div><b>Shutdown coordinator</b>Name, date</div><div><b>Head, {area.name}</b>Name, date</div><div><b>Plant management</b>Name, date</div></div>
          <div className="foot"><span>Full photo set for all tasks is in the appendix export</span><span>Confidential</span></div>
        </div>
      </div>
    </div>
  );
}
