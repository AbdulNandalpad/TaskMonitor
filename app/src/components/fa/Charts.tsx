/* Furnace Analysis charts: plain SVG, rendered on the server, no chart library. */
import Link from "next/link";

export const COLOR = { critical: "#dc2626", warning: "#f59e0b", ok: "#16a34a", unset: "#9ca3af", a: "#2563eb", b: "#ea580c" } as const;
type St = "critical" | "warning" | "ok" | "unset";

/** Short label for a zone on a chart axis: "Tapside Area-1" > "Tap 1", "Left Trunion-3" > "LT 3", "ChargePad-1A" > "CP 1A". */
export function shortZone(z: string) {
  return z.replace(/^Tapside Area-/, "Tap ").replace(/^Left Trunion-/, "LT ").replace(/^Right Trunion-/, "RT ").replace(/^ChargePad-/, "CP ")
    .replace("SL-NON Drive", "SL non-drv").replace("SL-Drive", "SL drive");
}

const nice = (max: number) => { const step = max > 1500 ? 500 : max > 600 ? 200 : 100; return { top: Math.ceil((max * 1.05) / step) * step, step }; };

// ------------------------------------------------------------------ donut
export function Donut({ counts, title, hrefFor, selected }: {
  counts: { critical: number; warning: number; ok: number; unset: number }; title: string; hrefFor?: (s: St) => string; selected?: string | null;
}) {
  const order: St[] = ["critical", "warning", "ok", "unset"];
  const total = order.reduce((a, s) => a + counts[s], 0);
  const R = 80, r = 50, C = 100;
  let ang = -Math.PI / 2;
  const arcs = order.map((s) => {
    const n = counts[s];
    if (!n) return null;
    const a2 = ang + (n / total) * 2 * Math.PI;
    const full = n === total;
    const p = (rad: number, a: number) => `${(C + rad * Math.cos(a)).toFixed(2)} ${(C + rad * Math.sin(a)).toFixed(2)}`;
    const d = full
      ? `M${C} ${C - R}A${R} ${R} 0 1 1 ${C} ${C + R}A${R} ${R} 0 1 1 ${C} ${C - R}ZM${C} ${C - r}A${r} ${r} 0 1 0 ${C} ${C + r}A${r} ${r} 0 1 0 ${C} ${C - r}Z`
      : `M${p(R, ang)}A${R} ${R} 0 ${n / total > 0.5 ? 1 : 0} 1 ${p(R, a2)}L${p(r, a2)}A${r} ${r} 0 ${n / total > 0.5 ? 1 : 0} 0 ${p(r, ang)}Z`;
    ang = a2;
    const path = <path d={d} fill={COLOR[s]} fillRule="evenodd" stroke="#fff" strokeWidth="2" opacity={selected && selected !== s ? 0.35 : 1}><title>{`${s}: ${n}`}</title></path>;
    return <g key={s}>{hrefFor ? <a href={hrefFor(s)}>{path}</a> : path}</g>;
  });
  const label: Record<St, string> = { critical: "Critical", warning: "Warning", ok: "OK", unset: "No limit" };
  return (
    <div className="fa-donut">
      <svg viewBox="0 0 200 200" width="170" height="170" role="img" aria-label={`${title}: ${order.map((s) => `${counts[s]} ${label[s]}`).join(", ")}`}>
        {total ? arcs : <circle cx={C} cy={C} r={R} fill="#f3f4f6" />}
        <text x={C} y={C + 2} textAnchor="middle" fontSize="30" fontWeight="800" fill="#1f2937">{total}</text>
        <text x={C} y={C + 20} textAnchor="middle" fontSize="11" fill="#6b7280">zones</text>
      </svg>
      <div className="fa-donut-leg">
        <b>{title}</b>
        {order.filter((s) => counts[s] > 0 || s !== "unset").map((s) => {
          const row = (<><i style={{ background: COLOR[s] }} />{label[s]} <b>{counts[s]}</b> <span>({total ? Math.round((counts[s] / total) * 100) : 0}%)</span></>);
          return hrefFor ? <Link key={s} href={hrefFor(s)} className={`fa-leg-row${selected === s ? " sel" : ""}`}>{row}</Link> : <div key={s} className="fa-leg-row">{row}</div>;
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ minimum thickness per zone
export type ZoneBar = { zone: string; min: number; avg: number; status: St; warn: number | null; crit: number | null };

/** One bar per zone: its minimum thickness, coloured by status. A dark tick marks the average; amber and red ticks mark that zone's limits. */
export function ZoneBars({ items }: { items: ZoneBar[] }) {
  const W = 880, H = 330, L = 50, Rm = 12, T = 14, B = 62;
  const { top, step } = nice(Math.max(...items.flatMap((i) => [i.min, i.avg, i.warn ?? 0, i.crit ?? 0]), 100));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const slot = (W - L - Rm) / Math.max(items.length, 1), bw = Math.min(26, slot * 0.62);
  const grid = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  return (
    <svg className="fa-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Minimum thickness per zone">
      {grid.map((g) => (<g key={g}><line x1={L} x2={W - Rm} y1={y(g)} y2={y(g)} stroke="#ffedd5" /><text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="10.5" fill="#9ca3af">{g}</text></g>))}
      {items.map((it, i) => {
        const cx = L + slot * i + slot / 2;
        return (
          <g key={it.zone}>
            <rect x={cx - bw / 2} y={y(it.min)} width={bw} height={Math.max(1, y(0) - y(it.min))} rx="3" fill={COLOR[it.status]}><title>{`${it.zone}: minimum ${it.min} mm, average ${it.avg} mm`}</title></rect>
            <line x1={cx - bw / 2 - 3} x2={cx + bw / 2 + 3} y1={y(it.avg)} y2={y(it.avg)} stroke="#1f2937" strokeWidth="2.2" />
            {it.warn != null && <line x1={cx - bw / 2 - 3} x2={cx + bw / 2 + 3} y1={y(it.warn)} y2={y(it.warn)} stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 2" />}
            {it.crit != null && <line x1={cx - bw / 2 - 3} x2={cx + bw / 2 + 3} y1={y(it.crit)} y2={y(it.crit)} stroke="#dc2626" strokeWidth="2" strokeDasharray="3 2" />}
            <text x={cx} y={H - B + 14} textAnchor="end" fontSize="10.5" fill="#6b7280" transform={`rotate(-50 ${cx} ${H - B + 14})`}>{shortZone(it.zone)}</text>
          </g>
        );
      })}
      <text x={12} y={(H - B) / 2} transform={`rotate(-90 12 ${(H - B) / 2})`} textAnchor="middle" fontSize="11" fill="#9ca3af">thickness (mm)</text>
    </svg>
  );
}

export function ZoneBarsLegend() {
  return (
    <div className="fa-legend">
      <span><i style={{ background: COLOR.ok }} />OK</span><span><i style={{ background: COLOR.warning }} />Warning</span><span><i style={{ background: COLOR.critical }} />Critical</span><span><i style={{ background: COLOR.unset }} />No limit</span>
      <span><i style={{ background: "#1f2937" }} />Average</span><span><i style={{ background: "#f59e0b" }} />Warning level</span><span><i style={{ background: "#dc2626" }} />Critical level</span>
    </div>
  );
}

// ------------------------------------------------------------------ status by scan
export function ScanStatusBars({ scans }: { scans: { label: string; heat: string; critical: number; warning: number; ok: number; unset: number }[] }) {
  const W = 760, H = 250, L = 40, Rm = 12, T = 12, B = 48;
  const totals = scans.map((s) => s.critical + s.warning + s.ok + s.unset);
  const top = Math.max(4, ...totals);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const slot = (W - L - Rm) / Math.max(scans.length, 1), bw = Math.min(54, slot * 0.6);
  const order: St[] = ["critical", "warning", "ok", "unset"];
  return (
    <svg className="fa-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Zones by status for each scan">
      {[0, Math.round(top / 2), top].map((g) => (<g key={g}><line x1={L} x2={W - Rm} y1={y(g)} y2={y(g)} stroke="#ffedd5" /><text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="10.5" fill="#9ca3af">{g}</text></g>))}
      {scans.map((s, i) => {
        const cx = L + slot * i + slot / 2;
        let acc = 0;
        return (
          <g key={i}>
            {order.map((k) => { const n = s[k]; if (!n) return null; const y1 = y(acc + n), h = y(acc) - y(acc + n); acc += n; return <rect key={k} x={cx - bw / 2} y={y1} width={bw} height={h} fill={COLOR[k]}><title>{`${s.label} · heat ${s.heat} · ${k}: ${n}`}</title></rect>; })}
            <text x={cx} y={H - B + 16} textAnchor="middle" fontSize="10.5" fill="#6b7280">{s.label}</text>
            <text x={cx} y={H - B + 30} textAnchor="middle" fontSize="10" fill="#9ca3af">heat {s.heat}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ heat against heat
export function GroupedBars({ rows, aLabel, bLabel, unit = "mm" }: { rows: { zone: string; a: number; b: number }[]; aLabel: string; bLabel: string; unit?: string }) {
  const W = 880, H = 330, L = 50, Rm = 12, T = 14, B = 62;
  const { top, step } = nice(Math.max(...rows.flatMap((r) => [r.a, r.b]), 100));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const slot = (W - L - Rm) / Math.max(rows.length, 1), bw = Math.min(14, slot * 0.36);
  const grid = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  return (
    <svg className="fa-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${aLabel} against ${bLabel}`}>
      {grid.map((g) => (<g key={g}><line x1={L} x2={W - Rm} y1={y(g)} y2={y(g)} stroke="#ffedd5" /><text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="10.5" fill="#9ca3af">{g}</text></g>))}
      {rows.map((r, i) => {
        const cx = L + slot * i + slot / 2;
        return (
          <g key={r.zone}>
            <rect x={cx - bw - 1} y={y(r.a)} width={bw} height={Math.max(1, y(0) - y(r.a))} rx="2" fill={COLOR.a}><title>{`${r.zone} · ${aLabel}: ${r.a} ${unit}`}</title></rect>
            <rect x={cx + 1} y={y(r.b)} width={bw} height={Math.max(1, y(0) - y(r.b))} rx="2" fill={COLOR.b}><title>{`${r.zone} · ${bLabel}: ${r.b} ${unit}`}</title></rect>
            <text x={cx} y={H - B + 14} textAnchor="end" fontSize="10.5" fill="#6b7280" transform={`rotate(-50 ${cx} ${H - B + 14})`}>{shortZone(r.zone)}</text>
          </g>
        );
      })}
      <text x={12} y={(H - B) / 2} transform={`rotate(-90 12 ${(H - B) / 2})`} textAnchor="middle" fontSize="11" fill="#9ca3af">thickness ({unit})</text>
    </svg>
  );
}

/** Change per zone, centred on zero: up (green) is thicker, down (red) is thinner. */
export function DeltaBars({ rows, title }: { rows: { zone: string; d: number }[]; title: string }) {
  const W = 880, H = 300, L = 50, Rm = 12, T = 14, B = 62;
  const m = Math.max(50, ...rows.map((r) => Math.abs(r.d)));
  const { top, step } = nice(m);
  const y = (v: number) => T + (1 - (v + top) / (2 * top)) * (H - T - B);
  const slot = (W - L - Rm) / Math.max(rows.length, 1), bw = Math.min(22, slot * 0.6);
  const grid: number[] = []; for (let g = -top; g <= top; g += step) grid.push(g);
  return (
    <svg className="fa-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      {grid.map((g) => (<g key={g}><line x1={L} x2={W - Rm} y1={y(g)} y2={y(g)} stroke={g === 0 ? "#9ca3af" : "#ffedd5"} /><text x={L - 6} y={y(g) + 4} textAnchor="end" fontSize="10.5" fill="#9ca3af">{g > 0 ? `+${g}` : g}</text></g>))}
      {rows.map((r, i) => {
        const cx = L + slot * i + slot / 2;
        const y0 = y(0), y1 = y(r.d);
        return (
          <g key={r.zone}>
            <rect x={cx - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} rx="2" fill={r.d >= 0 ? "#16a34a" : "#dc2626"}><title>{`${r.zone}: ${r.d > 0 ? "+" : ""}${r.d} mm`}</title></rect>
            <text x={cx} y={H - B + 14} textAnchor="end" fontSize="10.5" fill="#6b7280" transform={`rotate(-50 ${cx} ${H - B + 14})`}>{shortZone(r.zone)}</text>
          </g>
        );
      })}
      <text x={12} y={(H - B) / 2} transform={`rotate(-90 12 ${(H - B) / 2})`} textAnchor="middle" fontSize="11" fill="#9ca3af">change (mm)</text>
    </svg>
  );
}
