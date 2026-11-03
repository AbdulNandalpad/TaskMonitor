import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { fmtStamp, fmtWhen, stats } from "@/lib/format";
import { fmtDuration, loadDetailed, type TaskBlock } from "@/lib/report/detailed";
import { STATUS } from "@/lib/types";
import { PrintButton } from "@/components/PrintButton";
import { Back } from "@/components/Icons";
import { LogoMark } from "@/components/Logo";

export const dynamic = "force-dynamic";

const pill = (b: TaskBlock) => <span className={`pill ${STATUS[b.status].key}`}>{STATUS[b.status].label}{b.status === "in_progress" ? ` · ${b.progress}%` : ""}</span>;
const dateOnly = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "–");

/** Detailed report (CR-7): one block per task, grouped by section, with timeline, AI summary and photo evidence. */
export default async function DetailedReport({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const ctx = await requireCtx({ managerOnly: true });
  const data = await loadDetailed(ctx.supabase, ctx.area.id, listId, { signUrls: true });
  if (!data) notFound();
  const { list, sections, blocks } = data;
  const area = ctx.area;
  const stamp = fmtStamp();
  const all = stats(blocks.map((b) => ({ status: b.status, progress: b.progress, responsible_person_id: b.responsible })));
  const withUpdates = blocks.filter((b) => b.evidence.events.length > 0);
  const withSummary = withUpdates.filter((b) => b.summary).length;
  const pages = sections.filter((s) => blocks.some((b) => b.sectionId === s.id)).length + 2;
  const file = `${area.code.toUpperCase()}-Detailed-Report`;

  const Head = ({ n }: { n: number }) => (
    <div className="ph-hd">
      <div><h1>{area.name} · Detailed Task Report</h1><div className="sub">{list.name} · Generated {stamp}</div></div>
      <div className="org"><b>Area · {area.name}</b><span className="org-brand"><LogoMark size={16} />Task Monitor · Page {n} of {pages}</span></div>
    </div>
  );

  let n = 1;
  return (
    <div className="reportwrap">
      <div className="ovbar no-print">
        <Link className="btn" href="/"><Back /><span className="d-only">Back to app</span></Link>
        <div className="ttl"><b>{file}.pdf</b><span>{blocks.length} tasks · generated {stamp}</span></div>
        <a className="btn" href={`/api/report/${listId}/export`}>Download Excel</a>
        <PrintButton />
      </div>
      <div className="ovbody">
        <div className="page">
          <Head n={n++} />
          <h2>Overview</h2>
          <div className="sum">
            <div><div className="v">{all.pct}%</div><div className="l">Overall compliance</div></div>
            <div><div className="v">{all.done} / {all.n}</div><div className="l">Completed</div></div>
            <div><div className="v">{all.prog}</div><div className="l">In progress</div></div>
            <div><div className="v">{all.open}</div><div className="l">Not started</div></div>
          </div>
          <table>
            <tbody>
              <tr><td><b>Task list</b></td><td>{list.name}</td></tr>
              <tr><td><b>Dates</b></td><td>{dateOnly(data.totals.from)} to {dateOnly(data.totals.to)}</td></tr>
              <tr><td><b>Planned hours</b></td><td>{data.totals.plannedHours} h</td></tr>
              <tr><td><b>Sections</b></td><td>{sections.length}</td></tr>
              <tr><td><b>Work summaries</b></td><td>{withSummary} of {withUpdates.length} tasks with updates{withSummary < withUpdates.length ? " (the rest have no AI summary yet)" : ""}</td></tr>
            </tbody>
          </table>
          <h2>Contents</h2>
          <table>
            <thead><tr><th>Section</th><th className="n">Tasks</th><th className="n">Completed</th><th className="n">In progress</th><th className="n">Not started</th></tr></thead>
            <tbody>{sections.map((s) => {
              const st = stats(blocks.filter((b) => b.sectionId === s.id).map((b) => ({ status: b.status, progress: b.progress, responsible_person_id: null })));
              return <tr key={s.id}><td>{s.name}</td><td className="n">{st.n}</td><td className="n">{st.done}</td><td className="n">{st.prog}</td><td className="n">{st.open}</td></tr>;
            })}</tbody>
          </table>
          <div className="foot"><span>Start is the first update that moved a task forward; end is the first update to completed</span><span>Confidential</span></div>
        </div>

        {sections.map((s) => {
          const items = blocks.filter((b) => b.sectionId === s.id);
          if (!items.length) return null;
          const head = data.personName.get(s.head_person_id ?? "");
          return (
            <div className="page" key={s.id}>
              <Head n={n++} />
              <h2>{s.name}{head ? ` · ${head}` : ""} <span className="muted-count">{items.length} tasks</span></h2>
              {items.map((b) => (
                <div className="tblock" key={b.id}>
                  <div className="tb-hd"><span className="num tb-seq">{b.seq}</span><b>{b.description}</b>{pill(b)}</div>
                  <div className="tb-meta">
                    <span><i>Start</i>{b.start ? fmtWhen(b.start) : "–"}</span>
                    <span><i>End</i>{b.end ? fmtWhen(b.end) : "–"}</span>
                    <span><i>Duration</i>{fmtDuration(b.durationMin)}{b.plannedHours ? ` vs ${b.plannedHours} h planned` : ""}</span>
                    <span><i>Responsible</i>{b.responsible ?? "Unassigned"}</span>
                  </div>
                  <p className={b.summary ? "tb-sum" : "tb-sum none"}>{b.summary ?? (b.evidence.events.length ? "No AI summary has been generated for this task yet." : "No updates recorded yet.")}{b.summary && b.summaryStale ? " (the evidence changed after this summary was written)" : ""}</p>
                  {b.remarks.length ? (
                    <div className="tb-remarks">
                      <i>Remarks</i>
                      <ul>
                        {b.remarks.map((r, k) => (
                          <li key={k}>
                            {r.text} <span className="tb-by">· {r.by ? `${r.by} · ` : ""}{fmtWhen(r.at)}</span>
                            {r.original && r.original !== r.text ? <span className="tb-orig">Original{r.language && r.language !== "en" ? ` (${r.language === "kn" ? "Kannada" : r.language === "hi" ? "Hindi" : r.language})` : ""}: {r.original}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {b.photos.length ? (
                    <div className="pgrid tb-photos">
                      {b.photos.map((p) => (
                        <figure key={p.id}>
                          {p.url ? <a href={p.url} target="_blank" rel="noreferrer"><div className="ph">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.url} alt="" /></div></a> : <div className="ph" />}
                          <figcaption><b>{p.label ? p.label[0].toUpperCase() + p.label.slice(1) : "Photo"}</b>{fmtWhen(p.at)}{p.by ? ` · ${p.by}` : ""}</figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : null}
                  {b.noCompletionPhoto ? <div className="tb-flag">No completion photo</div> : null}
                </div>
              ))}
              <div className="foot"><span>{s.name}</span><span>Confidential</span></div>
            </div>
          );
        })}

        <div className="page">
          <Head n={n++} />
          <h2>Sign‑off</h2>
          <div className="sig"><div><b>Shutdown coordinator</b>Name, date</div><div><b>Head, {area.name}</b>Name, date</div><div><b>Plant management</b>Name, date</div></div>
          <div className="foot"><span>Summaries are written by AI from the recorded evidence only</span><span>Confidential</span></div>
        </div>
      </div>
    </div>
  );
}
