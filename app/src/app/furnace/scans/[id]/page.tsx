import Link from "next/link";
import { notFound } from "next/navigation";
import { Donut, ZoneRange, ZoneRangeLegend } from "@/components/fa/Charts";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, fmtDateTime, loadScan, previousScan } from "@/lib/fa/data";
import { counts, delta, evaluate, type Status } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";
import { sectionOrder } from "@/lib/fa/zones";

export const dynamic = "force-dynamic";

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

/** One scan: every zone with its status against the converter's current limits, the change since the previous scan, and what to do. */
export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireFa();
  const { supabase } = ctx;
  const data = await loadScan(supabase, id);
  if (!data) notFound();
  const { scan, readings } = data;
  // judged with the converter's current limits; the version it was first saved with is shown as a note
  const [{ data: conv }, prev, lim, saved] = await Promise.all([
    supabase.from("fa_converter").select("name").eq("id", scan.converter_id).maybeSingle(),
    previousScan(supabase, scan),
    activeLimits(supabase, scan.converter_id),
    scan.limit_version_id ? supabase.from("fa_limit_version").select("version").eq("id", scan.limit_version_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const limits = lim.rows;
  const prevBy = new Map((prev?.readings ?? []).map((r) => [r.zone, r]));
  const rows = readings.map((r) => ({ r, ev: evaluate(r, limits), d: delta(prevBy.get(r.zone), r) }))
    .sort((a, b) => sectionOrder(a.r.section) - sectionOrder(b.r.section) || a.r.zone.localeCompare(b.r.zone, undefined, { numeric: true }));
  const k = counts(rows.map((x) => x.ev.status));
  const sections = [...new Set(rows.map((x) => x.r.section))];
  const lowest = rows.reduce((m, x) => (x.r.min_mm < m.r.min_mm ? x : m), rows[0]);
  const meanOf = (xs: { avg_mm: number }[]) => (xs.length ? Math.round(xs.reduce((t, r) => t + r.avg_mm, 0) / xs.length) : 0);
  const meanAvg = meanOf(readings);
  const prevMean = prev && prev.readings.length ? meanOf(prev.readings) : null;

  return (
    <FaShell ctx={ctx} title={`Heat ${scan.heat} · measurement ${scan.meas_no}`} sub={`${conv?.name ?? "Converter"} · ${fmtDateTime(scan.scanned_at)}`}
      actions={<><Link className="fa-btn" href="/furnace">Back</Link>{prev && <Link className="fa-btn" href={`/furnace/compare?c=${scan.converter_id}&a=${prev.scan.id}&b=${scan.id}`}>Compare with heat {prev.scan.heat}</Link>}<a className="fa-btn primary" href={`/api/furnace/scans/${scan.id}/pdf`}>Open vendor PDF</a></>}>
      <div className="fa-card">
        <div className="fa-twocol">
          <Donut counts={k} title={`Status of the ${rows.length} zones`} />
          <div className="fa-kpis" style={{ margin: 0, alignContent: "center" }}>
            <div className="fa-kpi"><div className="l">Lowest minimum</div><div className="v">{lowest.r.min_mm} mm</div><div className="s">{lowest.r.zone}</div></div>
            <div className="fa-kpi"><div className="l">Mean of averages</div><div className="v">{meanAvg} mm</div><div className={`s ${prevMean == null ? "" : meanAvg - prevMean < 0 ? "fa-down" : meanAvg - prevMean > 0 ? "fa-up" : ""}`}>{prevMean == null ? "first scan" : `${meanAvg - prevMean > 0 ? "+" : ""}${meanAvg - prevMean} mm since heat ${prev!.scan.heat}`}</div></div>
          </div>
        </div>
        <h3 className="fa-section">Every zone against its limits</h3>
        <ZoneRangeLegend />
        <ZoneRange items={rows.map((x) => ({ zone: x.r.zone, section: x.r.section, min: x.r.min_mm, avg: x.r.avg_mm, status: x.ev.status, warn: x.ev.min.limit?.warn_below ?? null, crit: x.ev.min.limit?.critical_below ?? null }))} />
      </div>
      <p className="fa-note">
        {lim.version ? <>Judged with the current limits, version {lim.version.version}{lim.version.note ? ` (${lim.version.note})` : ""}. </> : <>No limits are set for this converter, so zones have no status. </>}
        {saved.data ? <>When saved it was judged with version {(saved.data as { version: number }).version}. </> : <>It was saved before any limits existed. </>}
        {prev ? <>Changes are against heat {prev.scan.heat} (measurement {prev.scan.meas_no}). </> : <>This is the first scan, so there is nothing to compare with. </>}
        {scan.steel_level_m != null && <>Steel level {scan.steel_level_m} m{scan.steel_tonnes != null ? ` @ ${scan.steel_tonnes} t` : ""}. </>}
        {scan.bath_level_m != null && <>Bath level {scan.bath_level_m} m.</>}
      </p>
      <div className="fa-card">
        <div className="fa-tablewrap"><table className="fa-tbl">
          <thead><tr><th>Zone</th><th className="n">Average</th><th className="n">Minimum</th><th>Status</th><th className="n">Δ avg</th><th className="n">Δ min</th><th>Limits (min)</th><th>Recommendation</th></tr></thead>
          <tbody>{sections.map((sec) => (
            <SectionRows key={sec} sec={sec} rows={rows.filter((x) => x.r.section === sec)} />
          ))}</tbody>
        </table></div>
        <p className="fa-note" style={{ marginBottom: 0 }}>Δ is the change since the previous scan (negative = thinner). “Repair?” marks a minimum that went up by 30 mm or more, which wear cannot do: check for gunning or a scan difference.</p>
      </div>
    </FaShell>
  );
}

function SectionRows({ sec, rows }: { sec: string; rows: { r: { zone: string; avg_mm: number; min_mm: number; angle: string | null; depth: string | null }; ev: ReturnType<typeof evaluate>; d: ReturnType<typeof delta> }[] }) {
  return (
    <>
      <tr className="fa-sec"><td colSpan={8}>{sec}</td></tr>
      {rows.map(({ r, ev, d }) => {
        const lm = ev.min.limit;
        const st: Status = ev.status;
        return (
          <tr key={r.zone} className={st}>
            <td><b>{r.zone}</b><small>{[r.angle, r.depth].filter(Boolean).join(" · ")}</small></td>
            <td className="n">{r.avg_mm} mm</td><td className="n">{r.min_mm} mm</td>
            <td><StatusBadge status={st} /></td>
            <td className={`n ${d && d.avg < 0 ? "fa-down" : d && d.avg > 0 ? "fa-up" : ""}`}>{d ? sign(d.avg) : "–"}</td>
            <td className={`n ${d && d.min < 0 ? "fa-down" : d && d.min > 0 ? "fa-up" : ""}`}>{d ? sign(d.min) : "–"}{d?.rose && <span className="fa-flag">Repair?</span>}</td>
            <td><small>{lm ? `${lm.warn_below ?? "–"} / ${lm.critical_below ?? "–"} mm` : "–"}</small></td>
            <td>{ev.recommendations.map((t, i) => <div key={i}>{t}</div>)}</td>
          </tr>
        );
      })}
    </>
  );
}
