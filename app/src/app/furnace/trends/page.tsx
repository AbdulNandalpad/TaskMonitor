import { FaShell } from "@/components/fa/FaShell";
import { activeLimits, fmtDate, listConverters } from "@/lib/fa/data";
import { pickLimit } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";
import { sectionOrder } from "@/lib/fa/zones";

export const dynamic = "force-dynamic";

type Pt = { label: string; heat: string; avg: number; min: number };

function Chart({ pts, warn, crit }: { pts: Pt[]; warn: number | null; crit: number | null }) {
  const W = 760, H = 320, L = 52, R = 16, T = 16, B = 44;
  const vals = [...pts.flatMap((p) => [p.avg, p.min]), ...(warn != null ? [warn] : []), ...(crit != null ? [crit] : [])];
  const top = Math.max(200, Math.ceil((Math.max(...vals) + 50) / 200) * 200);
  const x = (i: number) => (pts.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const line = (k: "avg" | "min") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(" ");
  const grid = Array.from({ length: top / 200 + 1 }, (_, i) => i * 200);
  const every = Math.max(1, Math.ceil(pts.length / 8));
  return (
    <svg className="fa-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Thickness over successive scans">
      {grid.map((g) => (<g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#ffedd5" /><text x={L - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{g}</text></g>))}
      {warn != null && <g><line x1={L} x2={W - R} y1={y(warn)} y2={y(warn)} stroke="#d97706" strokeDasharray="5 4" /><text x={W - R} y={y(warn) - 4} textAnchor="end" fontSize="11" fill="#b45309">warning {warn}</text></g>}
      {crit != null && <g><line x1={L} x2={W - R} y1={y(crit)} y2={y(crit)} stroke="#dc2626" strokeDasharray="5 4" /><text x={W - R} y={y(crit) - 4} textAnchor="end" fontSize="11" fill="#b91c1c">critical {crit}</text></g>}
      <path d={line("avg")} fill="none" stroke="#ea580c" strokeWidth="2.5" />
      <path d={line("min")} fill="none" stroke="#7c2d12" strokeWidth="2.5" />
      {pts.map((p, i) => (<g key={i}>
        <circle cx={x(i)} cy={y(p.avg)} r="3.5" fill="#ea580c"><title>{`${p.label} · heat ${p.heat} · average ${p.avg} mm`}</title></circle>
        <circle cx={x(i)} cy={y(p.min)} r="3.5" fill="#7c2d12"><title>{`${p.label} · heat ${p.heat} · minimum ${p.min} mm`}</title></circle>
        {i % every === 0 && <text x={x(i)} y={H - 22} textAnchor="middle" fontSize="10.5" fill="#6b7280">{p.label}</text>}
      </g>))}
      <text x={14} y={H / 2} transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle" fontSize="11" fill="#9ca3af">thickness (mm)</text>
    </svg>
  );
}

/** Thickness of one zone over successive scans, with the converter's limits drawn on the minimum. */
export default async function TrendsPage({ searchParams }: { searchParams: Promise<{ c?: string; z?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFa();
  const { supabase } = ctx;
  const converters = await listConverters(supabase);
  if (!converters.length) return <FaShell ctx={ctx} title="Trends"><div className="fa-card fa-empty"><b>No scans yet</b>Trends appear once reports are uploaded.</div></FaShell>;
  const conv = converters.find((c) => c.id === sp.c) ?? converters[0];

  const { data: scans } = await supabase.from("fa_scan").select("id, heat, meas_no, scanned_at").eq("converter_id", conv.id).order("scanned_at", { ascending: true }).limit(500);
  const list = scans ?? [];
  const latestId = list[list.length - 1]?.id as string | undefined;
  const { data: zr } = latestId ? await supabase.from("fa_reading").select("zone, section").eq("scan_id", latestId) : { data: [] };
  const zones = (zr ?? []).sort((a, b) => sectionOrder(a.section as string) - sectionOrder(b.section as string) || (a.zone as string).localeCompare(b.zone as string, undefined, { numeric: true })).map((r) => r.zone as string);
  const zone = zones.includes(sp.z ?? "") ? (sp.z as string) : zones[0];

  let pts: Pt[] = [];
  if (zone && list.length) {
    const { data: rd } = await supabase.from("fa_reading").select("scan_id, avg_mm, min_mm").eq("zone", zone).in("scan_id", list.map((s) => s.id as string));
    const by = new Map((rd ?? []).map((r) => [r.scan_id as string, r]));
    pts = list.flatMap((s) => { const r = by.get(s.id as string); return r ? [{ label: fmtDate(s.scanned_at as string), heat: s.heat as string, avg: Number(r.avg_mm), min: Number(r.min_mm) }] : []; });
  }
  const lim = await activeLimits(supabase, conv.id);
  const lm = zone ? pickLimit(lim.rows, zone, "min") : null;

  return (
    <FaShell ctx={ctx} title="Trends" sub="How a zone thins from scan to scan">
      <form className="fa-sel" method="get">
        {converters.length > 1 && <label>Converter<select name="c" defaultValue={conv.id}>{converters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        <label>Zone<select name="z" defaultValue={zone}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select></label>
        <button className="fa-btn primary" type="submit">Show</button>
      </form>
      {pts.length === 0 ? <div className="fa-card fa-empty"><b>No readings for this zone</b></div> : (
        <div className="fa-card">
          <h2>{zone}</h2>
          <div className="fa-legend"><span><i style={{ background: "#ea580c" }} />Average</span><span><i style={{ background: "#7c2d12" }} />Minimum</span>{lm && <span>Dashed lines: limits on the minimum</span>}</div>
          <Chart pts={pts} warn={lm?.warn_below ?? null} crit={lm?.critical_below ?? null} />
          <div className="fa-tablewrap" style={{ marginTop: 12 }}><table className="fa-tbl">
            <thead><tr><th>Date</th><th>Heat</th><th className="n">Average</th><th className="n">Minimum</th><th className="n">Δ min</th></tr></thead>
            <tbody>{[...pts].reverse().map((p, i, a) => { const older = a[i + 1]; const d = older ? p.min - older.min : null; return (
              <tr key={i}><td>{p.label}</td><td>{p.heat}</td><td className="n">{p.avg} mm</td><td className="n">{p.min} mm</td><td className={`n ${d != null && d < 0 ? "fa-down" : d != null && d > 0 ? "fa-up" : ""}`}>{d == null ? "–" : d > 0 ? `+${d}` : d}</td></tr>); })}</tbody>
          </table></div>
        </div>
      )}
    </FaShell>
  );
}
