import Link from "next/link";
import { Kpi } from "@/components/fa/Kpi";
import { COLOR, Dumbbell, DumbbellLegend } from "@/components/fa/Charts";
import { AutoForm } from "@/components/fa/AutoForm";
import { FaPrint } from "@/components/fa/FaPrint";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, fmtDate, fmtDateTime, listConverters, loadScan, scansForPicker } from "@/lib/fa/data";
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

  const scans = await scansForPicker(supabase, conv.id);
  const opt = (s: (typeof scans)[number]) => `Heat ${s.heat} · measurement ${s.meas_no} · ${fmtDate(s.scanned_at)}`;
  const selector = (aId: string, bId: string) => (
    <AutoForm className="fa-sel fa-toolbar">
      {converters.length > 1 && <label>Converter<select name="c" defaultValue={conv.id}>{converters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label>Earlier scan<select name="a" defaultValue={aId}>{scans.map((s) => <option key={s.id} value={s.id}>{opt(s)}</option>)}</select></label>
      <label>Later scan<select name="b" defaultValue={bId}>{scans.map((s) => <option key={s.id} value={s.id}>{opt(s)}</option>)}</select></label>
    </AutoForm>
  );
  if (scans.length < 2) return <FaShell ctx={ctx} title="Compare"><div className="fa-card fa-empty"><b>Two scans are needed</b>This converter has {scans.length}. Upload another report to compare.</div></FaShell>;

  // the pair is always earlier then later; a missing or unknown choice falls back to the latest two
  const pick = (id?: string) => scans.find((s) => s.id === id);
  let first = pick(sp.a) ?? scans[scans.length - 2], second = pick(sp.b) ?? scans[scans.length - 1];
  if (first.id !== second.id && first.scanned_at > second.scanned_at) [first, second] = [second, first];
  if (first.id === second.id) return <FaShell ctx={ctx} title="Compare heats" sub={conv.name}>{selector(first.id, second.id)}<div className="fa-banner">Choose two different scans to compare.</div></FaShell>;

  const [A, B, lim] = await Promise.all([loadScan(supabase, first.id), loadScan(supabase, second.id), activeLimits(supabase, conv.id)]);
  if (!A || !B) return <FaShell ctx={ctx} title="Compare">{selector(first.id, second.id)}<div className="fa-card fa-empty"><b>Scan not found</b></div></FaShell>;

  const { data: camps } = await supabase.from("fa_campaign").select("id, no").in("id", [A.scan.campaign_id, B.scan.campaign_id]);
  const campNo = (id: string) => (camps ?? []).find((c) => c.id === id)?.no ?? "–";
  const aBy = new Map(A.readings.map((r) => [r.zone, r]));
  const rows = B.readings.flatMap((rb) => {
    const ra = aBy.get(rb.zone);
    if (!ra) return [];
    const evA = evaluate(ra, lim.rows), evB = evaluate(rb, lim.rows);
    return [{ zone: rb.zone, group: compareGroup(rb.zone), angle: rb.angle, depth: rb.depth, aAvg: ra.avg_mm, bAvg: rb.avg_mm, aMin: ra.min_mm, bMin: rb.min_mm, dAvg: rb.avg_mm - ra.avg_mm, dMin: rb.min_mm - ra.min_mm, evA, evB }];
  }).sort((x, y) => COMPARE_GROUP_ORDER.indexOf(x.group) - COMPARE_GROUP_ORDER.indexOf(y.group) || x.zone.localeCompare(y.zone, undefined, { numeric: true }));
  if (!rows.length) return <FaShell ctx={ctx} title="Compare heats" sub={conv.name}>{selector(first.id, second.id)}<div className="fa-card fa-empty"><b>No zones in common</b>These two scans have no zone in common, so there is nothing to compare.</div></FaShell>;
  const sameOrder = rows;

  const lowA = rows.reduce((m, r) => (r.aMin < m.aMin ? r : m), rows[0]), lowB = rows.reduce((m, r) => (r.bMin < m.bMin ? r : m), rows[0]);
  const up = rows.filter((r) => r.dAvg > 0).length, dn = rows.filter((r) => r.dAvg < 0).length;
  const big = rows.reduce((m, r) => (r.dAvg > m.dAvg ? r : m), rows[0]), small = rows.reduce((m, r) => (r.dAvg < m.dAvg ? r : m), rows[0]);
  const mA = mean(rows.map((r) => r.aAvg)), mB = mean(rows.map((r) => r.bAvg));
  const cA = counts(rows.map((r) => r.evA.status)), cB = counts(rows.map((r) => r.evB.status));
  const maxAvg = Math.max(...rows.flatMap((r) => [r.aAvg, r.bAvg]), 1);
  const groups = COMPARE_GROUP_ORDER.filter((g) => rows.some((r) => r.group === g));
  const label = (x: { scan: { heat: string; meas_no: number } }) => `Heat ${x.scan.heat}`;

  return (
    <FaShell ctx={ctx} title="Compare heats" sub={`${conv.name} · ${rows.length} zones compared reading by reading`} actions={<FaPrint />}>
      {selector(first.id, second.id)}
      <div className="fa-twocol" style={{ marginBottom: 18 }}>
        {[A, B].map((x, i) => (
          <div key={x.scan.id} className="fa-card" style={{ marginBottom: 0 }}>
            <h3 style={{ color: i ? COLOR.b : COLOR.a }}>{label(x)} · {i ? "later" : "earlier"}</h3>
            <p className="fa-note" style={{ margin: 0 }}>Measurement {x.scan.meas_no} · {fmtDateTime(x.scan.scanned_at)} · converter {conv.code} · campaign {campNo(x.scan.campaign_id)}{x.scan.steel_level_m != null ? ` · steel level ${x.scan.steel_level_m} m` : ""}{x.scan.bath_level_m != null ? ` · bath level ${x.scan.bath_level_m} m` : ""} · <Link href={`/furnace/scans/${x.scan.id}`}>open scan</Link></p>
          </div>
        ))}
      </div>

      <div className="fa-kpis">
        <Kpi label="Mean of averages" value={`${mA.toFixed(0)} → ${mB.toFixed(0)} mm`} dClass={cls(mB - mA)} detail={`${f1(mB - mA)} mm`} />
        <Kpi label="Lowest minimum" value={`${lowA.aMin} → ${lowB.bMin} mm`} detail={`${lowA.zone} → ${lowB.zone}`} />
        <Kpi label="Higher average" value={`${up} of ${rows.length} zones`} detail={`${dn} lower, ${rows.length - up - dn} unchanged`} />
        <Kpi label="Largest increase" vClass={cls(big.dAvg)} value={`${f1(big.dAvg)} mm`} detail={big.zone} />
        <Kpi label="Largest decrease" vClass={cls(small.dAvg)} value={`${f1(small.dAvg)} mm`} detail={small.zone} />
      </div>

      <section className="fa-card">
        <h2>Status changes</h2>
        <p className="fa-note">Judged with the converter&apos;s current limits{lim.version ? ` (version ${lim.version.version})` : " (none set, so zones show no status)"}.</p>
        <StatusChanges rows={rows.map((r) => ({ zone: r.zone, a: r.evA.status, b: r.evB.status }))} aLabel={label(A)} bLabel={label(B)} cA={cA} cB={cB} />
      </section>

      <section className="fa-card">
        <h2>Average thickness by zone</h2>
        <DumbbellLegend aLabel={label(A)} bLabel={label(B)} />
        <Dumbbell title="Average thickness by zone" aLabel={label(A)} bLabel={label(B)} rows={sameOrder.map((r) => ({ zone: r.zone, section: r.group, a: r.aAvg, b: r.bAvg }))} />
      </section>

      <section className="fa-card">
        <h2>Minimum thickness by zone</h2>
        <p className="fa-note">A large rise in a minimum is usually a repair, not wear.</p>
        <DumbbellLegend aLabel={label(A)} bLabel={label(B)} />
        <Dumbbell title="Minimum thickness by zone" aLabel={label(A)} bLabel={label(B)} rows={sameOrder.map((r) => ({ zone: r.zone, section: r.group, a: r.aMin, b: r.bMin }))} />
      </section>

      <section className="fa-card">
        <h2>Zone summary (mean of area averages)</h2>
        <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Table"><table className="fa-tbl">
          <thead><tr><th>Zone</th><th className="n">Areas</th><th className="n">Mean avg {A.scan.heat}</th><th className="n">Mean avg {B.scan.heat}</th><th className="n">Delta</th><th className="n">Lowest min {A.scan.heat}</th><th className="n">Lowest min {B.scan.heat}</th></tr></thead>
          <tbody>{groups.map((g) => {
            const rs = rows.filter((r) => r.group === g), a = mean(rs.map((r) => r.aAvg)), b = mean(rs.map((r) => r.bAvg));
            return <tr key={g}><td><b>{g}</b></td><td className="n">{rs.length}</td><td className="n">{a.toFixed(0)}</td><td className="n">{b.toFixed(0)}</td><td className={`n ${cls(b - a)}`}>{f1(b - a)}</td><td className="n">{Math.min(...rs.map((r) => r.aMin))}</td><td className="n">{Math.min(...rs.map((r) => r.bMin))}</td></tr>;
          })}</tbody>
        </table></div>
      </section>

      <section className="fa-card">
        <h2>Detailed comparison, all readings</h2>
        <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Table"><table className="fa-tbl">
          <thead><tr><th>Zone</th><th className="n">Angle (deg)</th><th className="n">Depth (m)</th><th className="n">Avg {A.scan.heat}</th><th className="n">Avg {B.scan.heat}</th><th className="n">Delta</th><th className="n">Delta %</th><th className="n">Min {A.scan.heat}</th><th className="n">Min {B.scan.heat}</th><th className="n">Min delta</th><th>Status {B.scan.heat}</th><th>Average (bars)</th></tr></thead>
          <tbody>{groups.map((g) => (
            <GroupRows key={g} g={g} rows={rows.filter((r) => r.group === g)} maxAvg={maxAvg} />
          ))}</tbody>
        </table></div>
        <p className="fa-note" style={{ marginBottom: 0 }}>Delta is {label(B)} minus {label(A)} in mm; positive (green) means thicker, negative (red) thinner. Shaded minimums are below the warning (amber) or critical (red) level of the current limits.</p>
      </section>
    </FaShell>
  );
}

const RANK: Record<string, number> = { unset: 0, ok: 1, warning: 2, critical: 3 };

/** How many zones got worse or better in status between the two heats, and which. */
function StatusChanges({ rows, aLabel, bLabel, cA, cB }: { rows: { zone: string; a: string; b: string }[]; aLabel: string; bLabel: string; cA: { critical: number; warning: number; ok: number; unset: number }; cB: { critical: number; warning: number; ok: number; unset: number } }) {
  const worse = rows.filter((r) => RANK[r.b] > RANK[r.a] && r.a !== "unset"), better = rows.filter((r) => RANK[r.b] < RANK[r.a] && r.b !== "unset");
  const fmt = (c: typeof cA) => `${c.critical} critical, ${c.warning} warning, ${c.ok} OK${c.unset ? `, ${c.unset} no limit` : ""}`;
  return (
    <>
      <div className="fa-kpis" style={{ margin: 0, alignItems: "start" }}>
        <div className="fa-kpi"><div className="l">{aLabel}</div><div className="s">{fmt(cA)}</div></div>
        <div className="fa-kpi"><div className="l">{bLabel}</div><div className="s">{fmt(cB)}</div></div>
        <Kpi label="Worse" vClass="fa-down" value={worse.length} detail={worse.length ? worse.map((r) => `${r.zone} (${r.a} to ${r.b})`).join(", ") : "no zone got worse"} />
        <Kpi label="Better" vClass="fa-up" value={better.length} detail={better.length ? better.map((r) => `${r.zone} (${r.a} to ${r.b})`).join(", ") : "no zone got better"} />
      </div>
    </>
  );
}

type Row = { zone: string; angle: string | null; depth: string | null; aAvg: number; bAvg: number; aMin: number; bMin: number; dAvg: number; dMin: number; evA: ReturnType<typeof evaluate>; evB: ReturnType<typeof evaluate> };

const clean = (v: string | null) => (v ?? "").replace(/[\[\]]/g, "").replace(/\s*m\s*$/, "").trim() || "–";

function GroupRows({ g, rows, maxAvg }: { g: string; rows: Row[]; maxAvg: number }) {
  const mc = (ev: ReturnType<typeof evaluate>) => (ev.min.status === "critical" ? "crit" : ev.min.status === "warning" ? "warn" : "");
  return (
    <>
      <tr className="fa-sec"><td colSpan={12}>{g}</td></tr>
      {rows.map((r) => (
        <tr key={r.zone}>
          <td><b>{r.zone}</b></td>
          <td className="n">{clean(r.angle)}</td><td className="n">{clean(r.depth)}</td>
          <td className="n">{r.aAvg}</td><td className="n">{r.bAvg}</td>
          <td className={`n ${cls(r.dAvg)}`}>{sg(r.dAvg)}</td><td className={`n ${cls(r.dAvg)}`}>{r.aAvg ? `${f1((r.dAvg / r.aAvg) * 100)}%` : "–"}</td>
          <td className={`n ${mc(r.evA)}`}>{r.aMin}</td><td className={`n ${mc(r.evB)}`}>{r.bMin}</td>
          <td className={`n ${cls(r.dMin)}`}>{sg(r.dMin)}</td>
          <td><StatusBadge status={r.evB.status} /></td>
          <td><div className="fa-bar"><i style={{ width: `${(r.aAvg / maxAvg) * 100}%`, background: COLOR.a }} /><i style={{ width: `${(r.bAvg / maxAvg) * 100}%`, background: COLOR.b }} /></div></td>
        </tr>
      ))}
    </>
  );
}
