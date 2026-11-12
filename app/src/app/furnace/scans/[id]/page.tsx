import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBar, ZoneRange, ZoneRangeLegend } from "@/components/fa/Charts";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, fmtDateTime, loadScan, previousScan } from "@/lib/fa/data";
import { counts, delta, evaluate, type Status } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";
import { sectionOrder } from "@/lib/fa/zones";

export const dynamic = "force-dynamic";

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
const clean = (v: string | null) => (v ?? "").replace(/[\[\]]/g, "").replace(/\s*m\s*$/, "").trim();

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
      actions={<>{prev && <Link className="fa-btn" href={`/furnace/compare?c=${scan.converter_id}&a=${prev.scan.id}&b=${scan.id}`}>Compare with heat {prev.scan.heat}</Link>}<a className="fa-btn" href={`/api/furnace/scans/${scan.id}/pdf`} target="_blank" rel="noreferrer">Open vendor PDF</a></>}>
      <div className="fa-card">
        <StatusBar counts={k} />
        <div className="fa-kpis" style={{ marginBottom: 0 }}>
          <div className="fa-kpi"><div className="l">Lowest minimum</div><div className="v">{lowest.r.min_mm} mm</div><div className="s">{lowest.r.zone}</div></div>
          <div className="fa-kpi"><div className="l">Mean of averages</div><div className="v">{meanAvg} mm</div><div className={`s ${prevMean == null ? "" : meanAvg - prevMean < 0 ? "fa-down" : meanAvg - prevMean > 0 ? "fa-up" : ""}`}>{prevMean == null ? "first scan" : `${meanAvg - prevMean > 0 ? "+" : ""}${meanAvg - prevMean} mm since heat ${prev!.scan.heat}`}</div></div>
          <div className="fa-kpi"><div className="l">Zones needing attention</div><div className="v">{k.critical + k.warning} of {rows.length}</div><div className="s">{k.critical} critical, {k.warning} warning</div></div>
        </div>
        <dl className="fa-facts" style={{ marginBottom: 0 }}>
          <div><dt>Limits applied</dt><dd>{lim.version ? `Version ${lim.version.version}${lim.version.note ? `, ${lim.version.note}` : ""}` : "None set"}</dd></div>
          <div><dt>Saved with</dt><dd>{saved.data ? `Version ${(saved.data as { version: number }).version}` : "No limits yet"}</dd></div>
          <div><dt>Changes against</dt><dd>{prev ? `Heat ${prev.scan.heat} (measurement ${prev.scan.meas_no})` : "First scan"}</dd></div>
          {scan.steel_level_m != null && <div><dt>Steel level</dt><dd>{scan.steel_level_m} m{scan.steel_tonnes != null ? ` @ ${scan.steel_tonnes} t` : ""}</dd></div>}
          {scan.bath_level_m != null && <div><dt>Bath level</dt><dd>{scan.bath_level_m} m</dd></div>}
        </dl>
      </div>
      <div className="fa-card">
        <h3>Every zone against its limits</h3>
        <ZoneRangeLegend />
        <ZoneRange items={rows.map((x) => ({ zone: x.r.zone, section: x.r.section, min: x.r.min_mm, avg: x.r.avg_mm, status: x.ev.status, warn: x.ev.min.limit?.warn_below ?? null, crit: x.ev.min.limit?.critical_below ?? null }))} />
      </div>
      <div className="fa-card">
        <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Every zone of this scan"><table className="fa-tbl fa-stack">
          <thead><tr><th>Zone</th><th className="n">Average (mm)</th><th className="n">Minimum (mm)</th><th>Status</th><th className="n">Δ avg</th><th className="n">Δ min</th><th>Limits on min (mm)</th><th>Recommendation</th></tr></thead>
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
            <td><b>{r.zone}</b><small>{clean(r.angle) ? `${clean(r.angle)}° · ${clean(r.depth)} m` : ""}</small></td>
            <td className="n" data-label="Average (mm)">{r.avg_mm}</td><td className="n" data-label="Minimum (mm)">{r.min_mm}</td>
            <td data-label="Status"><StatusBadge status={st} /></td>
            <td data-label="Change in average" className={`n ${d && d.avg < 0 ? "fa-down" : d && d.avg > 0 ? "fa-up" : ""}`}>{d ? sign(d.avg) : "–"}</td>
            <td data-label="Change in minimum" className={`n ${d && d.min < 0 ? "fa-down" : d && d.min > 0 ? "fa-up" : ""}`}>{d ? sign(d.min) : "–"}{d?.rose && <span className="fa-flag">Repair?</span>}</td>
            <td data-label="Limits on minimum"><small>{lm ? `W ${lm.warn_below ?? "–"} · C ${lm.critical_below ?? "–"}` : "–"}</small></td>
            <td>{ev.recommendations.map((t, i) => <div key={i}>{t}</div>)}</td>
          </tr>
        );
      })}
    </>
  );
}
