import Link from "next/link";
import { DeltaBars, Donut, GroupedBars, COLOR } from "@/components/fa/Charts";
import { FaPrint } from "@/components/fa/FaPrint";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, fmtDate, fmtDateTime, listConverters, loadScan } from "@/lib/fa/data";
import { counts, evaluate } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";
import { COMPARE_GROUP_ORDER, compareGroup } from "@/lib/fa/zones";

export const dynamic = "force-dynamic";

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sg = (n: number) => (n > 0 ? `+${n}` : String(n));
const f1 = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1);
const cls = (n: number) => (n > 0 ? "fa-up" : n < 0 ? "fa-down" : "");

/** Heat against heat: any two scans of a converter, reading by reading, with charts. Defaults to the previous scan against the latest. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ c?: string; a?: string; b?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFa();
  const { supabase } = ctx;
  const converters = await listConverters(supabase);
  if (!converters.length) return <FaShell ctx={ctx} title="Compare"><div className="fa-card fa-empty"><b>No scans yet</b>Upload at least two reports to compare them.</div></FaShell>;
  const conv = converters.find((c) => c.id === sp.c) ?? converters[0];

  const { data: all } = await supabase.from("fa_scan").select("id, heat, meas_no, scanned_at").eq("converter_id", conv.id).order("scanned_at", { ascending: true }).limit(300);
  const scans = (all ?? []) as { id: string; heat: string; meas_no: number; scanned_at: string }[];
  const opt = (s: (typeof scans)[number]) => `Heat ${s.heat} · measurement ${s.meas_no} · ${fmtDate(s.scanned_at)}`;
  const selector = (
    <form className="fa-sel" method="get">
      {converters.length > 1 && <label>Converter<select name="c" defaultValue={conv.id}>{converters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label>Earlier scan<select name="a" defaultValue={sp.a ?? scans[Math.max(0, scans.length - 2)]?.id}>{scans.map((s) => <option key={s.id} value={s.id}>{opt(s)}</option>)}</select></label>
      <label>Later scan<select name="b" defaultValue={sp.b ?? scans[scans.length - 1]?.id}>{scans.map((s) => <option key={s.id} value={s.id}>{opt(s)}</option>)}</select></label>
      <button className="fa-btn primary" type="submit">Compare</button>
    </form>
  );
  if (scans.length < 2) return <FaShell ctx={ctx} title="Compare"><div className="fa-card fa-empty"><b>Two scans are needed</b>This converter has {scans.length}. Upload another report to compare.</div></FaShell>;

  const aId = scans.some((s) => s.id === sp.a) ? sp.a! : scans[scans.length - 2].id;
  const bId = scans.some((s) => s.id === sp.b) ? sp.b! : scans[scans.length - 1].id;
  const [A, B, lim] = await Promise.all([loadScan(supabase, aId), loadScan(supabase, bId), activeLimits(supabase, conv.id)]);
  if (!A || !B) return <FaShell ctx={ctx} title="Compare">{selector}<div className="fa-card fa-empty"><b>Scan not found</b></div></FaShell>;

  const aBy = new Map(A.readings.map((r) => [r.zone, r]));
  const rows = B.readings.flatMap((rb) => {
    const ra = aBy.get(rb.zone);
    if (!ra) return [];
    const evA = evaluate(ra, lim.rows), evB = evaluate(rb, lim.rows);
    return [{ zone: rb.zone, group: compareGroup(rb.zone), angle: rb.angle, depth: rb.depth, aAvg: ra.avg_mm, bAvg: rb.avg_mm, aMin: ra.min_mm, bMin: rb.min_mm, dAvg: rb.avg_mm - ra.avg_mm, dMin: rb.min_mm - ra.min_mm, evA, evB }];
  }).sort((x, y) => COMPARE_GROUP_ORDER.indexOf(x.group) - COMPARE_GROUP_ORDER.indexOf(y.group) || x.zone.localeCompare(y.zone, undefined, { numeric: true }));
  const sameOrder = rows;

  const lowA = rows.reduce((m, r) => (r.aMin < m.aMin ? r : m), rows[0]), lowB = rows.reduce((m, r) => (r.bMin < m.bMin ? r : m), rows[0]);
  const up = rows.filter((r) => r.dAvg > 0).length, dn = rows.filter((r) => r.dAvg < 0).length;
  const big = rows.reduce((m, r) => (r.dAvg > m.dAvg ? r : m), rows[0]), small = rows.reduce((m, r) => (r.dAvg < m.dAvg ? r : m), rows[0]);
  const mA = mean(rows.map((r) => r.aAvg)), mB = mean(rows.map((r) => r.bAvg));
  const cA = counts(rows.map((r) => r.evA.status)), cB = counts(rows.map((r) => r.evB.status));
  const groups = COMPARE_GROUP_ORDER.filter((g) => rows.some((r) => r.group === g));
  const label = (x: { scan: { heat: string; meas_no: number } }) => `Heat ${x.scan.heat}`;

  return (
    <FaShell ctx={ctx} title="Compare heats" sub={`${conv.name} · ${rows.length} zones compared reading by reading`} actions={<FaPrint />}>
      {selector}
      <div className="fa-twocol" style={{ marginBottom: 18 }}>
        {[A, B].map((x, i) => (
          <div key={x.scan.id} className="fa-card" style={{ marginBottom: 0, borderTop: `4px solid ${i ? COLOR.b : COLOR.a}` }}>
            <h3 style={{ color: i ? COLOR.b : COLOR.a }}>{label(x)} · {i ? "later" : "earlier"}</h3>
            <p className="fa-note" style={{ margin: 0 }}>Measurement {x.scan.meas_no} · {fmtDateTime(x.scan.scanned_at)}{x.scan.steel_level_m != null ? ` · steel level ${x.scan.steel_level_m} m` : ""}{x.scan.bath_level_m != null ? ` · bath level ${x.scan.bath_level_m} m` : ""} · <Link href={`/furnace/scans/${x.scan.id}`}>open scan</Link></p>
          </div>
        ))}
      </div>

      <div className="fa-kpis">
        <div className="fa-kpi"><div className="l">Mean of averages</div><div className="v">{mA.toFixed(0)} → {mB.toFixed(0)} mm</div><div className={`s ${cls(mB - mA)}`}>{f1(mB - mA)} mm</div></div>
        <div className="fa-kpi"><div className="l">Lowest minimum</div><div className="v">{lowA.aMin} → {lowB.bMin} mm</div><div className="s">{lowA.zone} → {lowB.zone}</div></div>
        <div className="fa-kpi"><div className="l">Zones with a higher average</div><div className="v">{up} of {rows.length}</div><div className="s">{dn} lower, {rows.length - up - dn} unchanged</div></div>
        <div className="fa-kpi"><div className="l">Largest increase</div><div className={`v ${cls(big.dAvg)}`}>{f1(big.dAvg)} mm</div><div className="s">{big.zone}</div></div>
        <div className="fa-kpi"><div className="l">Largest decrease</div><div className={`v ${cls(small.dAvg)}`}>{f1(small.dAvg)} mm</div><div className="s">{small.zone}</div></div>
      </div>

      <section className="fa-card">
        <h2>Status of the zones</h2>
        <p className="fa-note">Judged with the converter&apos;s current limits{lim.version ? ` (version ${lim.version.version})` : " (none set, so zones show no status)"}.</p>
        <div className="fa-twocol">
          <Donut counts={cA} title={`${label(A)} (earlier)`} />
          <Donut counts={cB} title={`${label(B)} (later)`} />
        </div>
      </section>

      <section className="fa-card">
        <h2>Average thickness by zone</h2>
        <div className="fa-legend"><span><i style={{ background: COLOR.a }} />{label(A)}</span><span><i style={{ background: COLOR.b }} />{label(B)}</span></div>
        <GroupedBars rows={sameOrder.map((r) => ({ zone: r.zone, a: r.aAvg, b: r.bAvg }))} aLabel={label(A)} bLabel={label(B)} />
      </section>

      <section className="fa-card">
        <h2>Change in minimum thickness, {label(B)} minus {label(A)}</h2>
        <p className="fa-note">Up (green) is thicker, down (red) is thinner. A large rise in a minimum is usually a repair, not wear.</p>
        <DeltaBars rows={sameOrder.map((r) => ({ zone: r.zone, d: r.dMin }))} title="Change in minimum thickness per zone" />
      </section>

      <section className="fa-card">
        <h2>Zone summary (mean of area averages)</h2>
        <div className="fa-tablewrap"><table className="fa-tbl">
          <thead><tr><th>Zone</th><th className="n">Areas</th><th className="n">Mean avg {A.scan.heat}</th><th className="n">Mean avg {B.scan.heat}</th><th className="n">Delta</th><th className="n">Lowest min {A.scan.heat}</th><th className="n">Lowest min {B.scan.heat}</th></tr></thead>
          <tbody>{groups.map((g) => {
            const rs = rows.filter((r) => r.group === g), a = mean(rs.map((r) => r.aAvg)), b = mean(rs.map((r) => r.bAvg));
            return <tr key={g}><td><b>{g}</b></td><td className="n">{rs.length}</td><td className="n">{a.toFixed(0)}</td><td className="n">{b.toFixed(0)}</td><td className={`n ${cls(b - a)}`}>{f1(b - a)}</td><td className="n">{Math.min(...rs.map((r) => r.aMin))}</td><td className="n">{Math.min(...rs.map((r) => r.bMin))}</td></tr>;
          })}</tbody>
        </table></div>
      </section>

      <section className="fa-card">
        <h2>Detailed comparison, all readings</h2>
        <div className="fa-tablewrap"><table className="fa-tbl">
          <thead><tr><th>Zone</th><th className="n">Avg {A.scan.heat}</th><th className="n">Avg {B.scan.heat}</th><th className="n">Delta</th><th className="n">Delta %</th><th className="n">Min {A.scan.heat}</th><th className="n">Min {B.scan.heat}</th><th className="n">Min delta</th><th>Status {B.scan.heat}</th></tr></thead>
          <tbody>{groups.map((g) => (
            <GroupRows key={g} g={g} rows={rows.filter((r) => r.group === g)} />
          ))}</tbody>
        </table></div>
        <p className="fa-note" style={{ marginBottom: 0 }}>Delta is {label(B)} minus {label(A)} in mm; positive (green) means thicker, negative (red) thinner. Shaded minimums are below the warning (amber) or critical (red) level of the current limits.</p>
      </section>
    </FaShell>
  );
}

type Row = { zone: string; angle: string | null; depth: string | null; aAvg: number; bAvg: number; aMin: number; bMin: number; dAvg: number; dMin: number; evA: ReturnType<typeof evaluate>; evB: ReturnType<typeof evaluate> };

function GroupRows({ g, rows }: { g: string; rows: Row[] }) {
  const mc = (ev: ReturnType<typeof evaluate>) => (ev.min.status === "critical" ? "crit" : ev.min.status === "warning" ? "warn" : "");
  return (
    <>
      <tr className="sec"><td colSpan={9}>{g}</td></tr>
      {rows.map((r) => (
        <tr key={r.zone}>
          <td><b>{r.zone}</b><small>{[r.angle, r.depth].filter(Boolean).join(" · ")}</small></td>
          <td className="n">{r.aAvg}</td><td className="n">{r.bAvg}</td>
          <td className={`n ${cls(r.dAvg)}`}>{sg(r.dAvg)}</td><td className={`n ${cls(r.dAvg)}`}>{f1((r.dAvg / r.aAvg) * 100)}%</td>
          <td className={`n ${mc(r.evA)}`}>{r.aMin}</td><td className={`n ${mc(r.evB)}`}>{r.bMin}</td>
          <td className={`n ${cls(r.dMin)}`}>{sg(r.dMin)}</td>
          <td><StatusBadge status={r.evB.status} /></td>
        </tr>
      ))}
    </>
  );
}
