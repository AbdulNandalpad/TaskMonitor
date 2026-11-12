import Link from "next/link";
import { AutoForm } from "@/components/fa/AutoForm";
import { COLOR, LineChart, Spark } from "@/components/fa/Charts";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, fmtDate, listConverters, readingsOf, scansForPicker } from "@/lib/fa/data";
import { evaluate, pickLimit, type Status } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";
import { sectionOrder } from "@/lib/fa/zones";

export const dynamic = "force-dynamic";

const sg = (n: number) => (n > 0 ? `+${n}` : String(n));
const STROKE: Record<Status, string> = { critical: COLOR.critical, warning: COLOR.warning, ok: COLOR.ok, unset: COLOR.unset };

/** Every zone over the recent scans as small trend cards, and one zone enlarged with its limits. */
export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ c?: string; z?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFa();
  const { supabase } = ctx;
  const converters = await listConverters(supabase);
  if (!converters.length) return <FaShell ctx={ctx} title="Trends"><div className="fa-card fa-empty"><b>No scans yet</b>Trends appear once reports are uploaded.</div></FaShell>;
  const conv = converters.find((c) => c.id === sp.c) ?? converters[0];

  const scans = await scansForPicker(supabase, conv.id, 30); // oldest first
  const lim = await activeLimits(supabase, conv.id);
  const rows = await readingsOf(supabase, scans.map((s) => s.id));
  const when = new Map(scans.map((s) => [s.id, Date.parse(s.scanned_at)]));
  const heatOf = new Map(scans.map((s) => [s.id, s.heat]));
  const byZone = new Map<string, { section: string; pts: { t: number; scan: string; avg: number; min: number }[] }>();
  for (const r of rows) {
    const z = byZone.get(r.zone) ?? { section: r.section, pts: [] };
    z.pts.push({ t: when.get(r.scan_id) ?? 0, scan: r.scan_id, avg: r.avg_mm, min: r.min_mm });
    byZone.set(r.zone, z);
  }
  const cards = [...byZone].map(([zone, z]) => {
    const pts = z.pts.sort((a, b) => a.t - b.t);
    const last = pts[pts.length - 1], prev = pts.length > 1 ? pts[pts.length - 2] : null;
    const ev = evaluate({ zone, avg_mm: last.avg, min_mm: last.min }, lim.rows);
    return { zone, section: z.section, pts, last, prev, status: ev.status, warn: ev.min.limit?.warn_below ?? null, crit: ev.min.limit?.critical_below ?? null };
  }).sort((a, b) => sectionOrder(a.section) - sectionOrder(b.section) || a.zone.localeCompare(b.zone, undefined, { numeric: true }));

  // the zone shown large: the one asked for, else the thinnest right now
  const chosen = cards.find((c) => c.zone === sp.z) ?? [...cards].sort((a, b) => a.last.min - b.last.min)[0];
  const lm = chosen ? pickLimit(lim.rows, chosen.zone, "min") : null;
  const q = (zone: string) => `/furnace/trends?${converters[0].id !== conv.id ? `c=${conv.id}&` : ""}z=${encodeURIComponent(zone)}`;

  return (
    <FaShell ctx={ctx} title="Trends" sub={`How every zone of ${conv.name} changed over its last ${scans.length} scans`}>
      {converters.length > 1 && (
        <AutoForm className="fa-sel fa-toolbar">
          <label>Converter<select name="c" defaultValue={conv.id}>{converters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </AutoForm>
      )}
      {!chosen ? <div className="fa-card fa-empty"><b>No readings yet</b></div> : (
        <>
          <section className="fa-card">
            <div className="fa-cardhead">
              <div><h2>{chosen.zone}</h2><p className="fa-note" style={{ margin: 0 }}>{chosen.section} · latest minimum {chosen.last.min} mm, average {chosen.last.avg} mm</p></div>
              <StatusBadge status={chosen.status} />
            </div>
            <div className="fa-legend"><span><i style={{ background: COLOR.b }} />Minimum</span><span><i style={{ background: COLOR.a }} />Average</span>{lm?.warn_below != null && <span><i style={{ background: COLOR.warning }} />Warning level</span>}{lm?.critical_below != null && <span><i style={{ background: COLOR.critical }} />Critical level</span>}</div>
            <LineChart title={`${chosen.zone}: minimum and average thickness over the last scans`} height={290}
              series={[{ label: "Average", color: COLOR.a, points: chosen.pts.map((p) => ({ t: p.t, v: p.avg })) }, { label: "Minimum", color: COLOR.b, points: chosen.pts.map((p) => ({ t: p.t, v: p.min })) }]}
              lines={[...(lm?.warn_below != null ? [{ v: lm.warn_below, color: COLOR.warning, label: `warning ${lm.warn_below}` }] : []), ...(lm?.critical_below != null ? [{ v: lm.critical_below, color: COLOR.critical, label: `critical ${lm.critical_below}` }] : [])]} />
            <div className="fa-tablewrap" tabIndex={0} role="region" aria-label={`Readings of ${chosen.zone}`} style={{ marginTop: 12 }}><table className="fa-tbl">
              <thead><tr><th>Date</th><th>Heat</th><th className="n">Average (mm)</th><th className="n">Minimum (mm)</th><th className="n">Change in minimum (mm)</th></tr></thead>
              <tbody>{[...chosen.pts].reverse().map((p, i, a) => { const older = a[i + 1]; const d = older ? p.min - older.min : null; return (
                <tr key={p.scan}><td>{fmtDate(new Date(p.t).toISOString())}</td><td>{heatOf.get(p.scan)}</td><td className="n">{p.avg}</td><td className="n">{p.min}</td><td className={`n ${d != null && d < 0 ? "fa-down" : d != null && d > 0 ? "fa-up" : ""}`}>{d == null ? "–" : sg(d)}</td></tr>); })}</tbody>
            </table></div>
          </section>

          <section className="fa-card">
            <h3>All zones</h3>
            <p className="fa-note">Minimum thickness over the last {scans.length} scans with each zone&apos;s limits (dashed). Choose a zone to enlarge it above.</p>
            {[...new Set(cards.map((c) => c.section))].map((sec) => (
              <div key={sec} className="fa-section" style={{ marginTop: 16 }}>
                <h4 className="fa-sechead">{sec}</h4>
                <div className="fa-cards">
                  {cards.filter((c) => c.section === sec).map((c) => (
                    <Link key={c.zone} href={q(c.zone)} className={`fa-mini ${c.status}${c.zone === chosen.zone ? " sel" : ""}`} aria-label={`${c.zone}, minimum ${c.last.min} millimetres, ${c.status}`}>
                      <span className="fa-mini-top"><b>{c.zone}</b><StatusBadge status={c.status} /></span>
                      <span className="fa-mini-val">{c.last.min}<small> mm</small>{c.prev && <em className={c.last.min < c.prev.min ? "fa-down" : c.last.min > c.prev.min ? "fa-up" : ""}>{sg(c.last.min - c.prev.min)}</em>}</span>
                      <Spark points={c.pts.map((p) => ({ t: p.t, v: p.min }))} warn={c.warn} crit={c.crit} color={STROKE[c.status]} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </FaShell>
  );
}
