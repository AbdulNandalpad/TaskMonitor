/* Furnace Analysis charts: plain SVG, rendered on the server, no chart library.
   One frame for all of them: 880 units wide, 12 px text, neutral grid, zone names horizontal, values printed. */
import Link from "next/link";

export const COLOR = { critical: "#d92d20", warning: "#dc6803", ok: "#079455", unset: "#98a2b3", a: "#475467", b: "#c2410c" } as const;
const INK = "#101828", MUTED = "#667085", GRID = "#eef0f3", CRIT_BG = "#fee4e2", WARN_BG = "#fef0c7";
type St = "critical" | "warning" | "ok" | "unset";
const STATUS_WORD: Record<St, string> = { critical: "Critical", warning: "Warning", ok: "OK", unset: "No limit" };

const W = 880, LBL = 150, RIGHT = 150, X0 = LBL, X1 = W - RIGHT, ROW = 22, HEAD = 26, TOP = 22, AXIS = 28;

/** Round the top of a scale up to a tidy number and give a tidy tick step. */
const scale = (max: number) => { const step = max > 1500 ? 500 : max > 600 ? 200 : 100; return { top: Math.ceil((max * 1.04) / step) * step, step }; };

/** Rows grouped under section headings: y position of every row and the total height. */
function layout<T extends { section: string }>(items: T[]) {
  let y = TOP;
  const out: ({ kind: "head"; y: number; text: string } | { kind: "row"; y: number; item: T })[] = [];
  let last = "";
  for (const it of items) {
    if (it.section !== last) { out.push({ kind: "head", y, text: it.section }); y += HEAD; last = it.section; }
    out.push({ kind: "row", y, item: it }); y += ROW;
  }
  return { out, height: y + AXIS };
}

function Axis({ x, top, step, height, from = 0, unit = "mm" }: { x: (v: number) => number; top: number; step: number; height: number; from?: number; unit?: string }) {
  const ticks: number[] = []; for (let v = from; v <= top + 0.001; v += step) ticks.push(v);
  return (
    <g>
      {ticks.map((v) => (<g key={v}><line x1={x(v)} x2={x(v)} y1={TOP - 4} y2={height - AXIS + 2} stroke={GRID} /><text x={x(v)} y={height - AXIS + 16} textAnchor="middle" fontSize="12" fill={MUTED}>{v}</text></g>))}
      <text x={X1} y={height - 4} textAnchor="end" fontSize="12" fill={MUTED}>thickness ({unit})</text>
    </g>
  );
}

// ------------------------------------------------------------------ donut (status split)
export function Donut({ counts, title, hrefFor, selected }: {
  counts: { critical: number; warning: number; ok: number; unset: number }; title: string; hrefFor?: (s: St) => string; selected?: string | null;
}) {
  const order: St[] = ["critical", "warning", "ok", "unset"];
  const total = order.reduce((a, s) => a + counts[s], 0);
  const R = 80, r = 52, C = 100;
  let ang = -Math.PI / 2;
  const arcs = order.map((s) => {
    const n = counts[s];
    if (!n) return null;
    const a2 = ang + (n / total) * 2 * Math.PI;
    const full = n === total;
    const p = (rad: number, a: number) => `${(C + rad * Math.cos(a)).toFixed(2)} ${(C + rad * Math.sin(a)).toFixed(2)}`;
    const big = n / total > 0.5 ? 1 : 0;
    const d = full
      ? `M${C} ${C - R}A${R} ${R} 0 1 1 ${C} ${C + R}A${R} ${R} 0 1 1 ${C} ${C - R}ZM${C} ${C - r}A${r} ${r} 0 1 0 ${C} ${C + r}A${r} ${r} 0 1 0 ${C} ${C - r}Z`
      : `M${p(R, ang)}A${R} ${R} 0 ${big} 1 ${p(R, a2)}L${p(r, a2)}A${r} ${r} 0 ${big} 0 ${p(r, ang)}Z`;
    ang = a2;
    return <path key={s} d={d} fill={COLOR[s]} fillRule="evenodd" stroke="#fff" strokeWidth="2" opacity={selected && selected !== s ? 0.35 : 1}><title>{`${STATUS_WORD[s]}: ${n}`}</title></path>;
  });
  return (
    <div className="fa-donut">
      <svg viewBox="0 0 200 200" width="160" height="160" role="img" aria-label={`${title}: ${order.map((s) => `${counts[s]} ${STATUS_WORD[s]}`).join(", ")}`}>
        {total ? arcs : <circle cx={C} cy={C} r={R} fill="#f2f4f7" />}
        <text x={C} y={C + 2} textAnchor="middle" fontSize="30" fontWeight="700" fill={INK}>{total}</text>
        <text x={C} y={C + 20} textAnchor="middle" fontSize="12" fill={MUTED}>zones</text>
      </svg>
      <div className="fa-donut-leg">
        <b>{title}</b>
        {order.filter((s) => counts[s] > 0 || s !== "unset").map((s) => {
          const row = (<><i style={{ background: COLOR[s] }} />{STATUS_WORD[s]} <b>{counts[s]}</b> <span>({total ? Math.round((counts[s] / total) * 100) : 0}%)</span></>);
          return hrefFor ? <Link key={s} href={hrefFor(s)} className={`fa-leg-row${selected === s ? " sel" : ""}`}>{row}</Link> : <div key={s} className="fa-leg-row">{row}</div>;
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ every zone against its limits
export type RangeRow = { zone: string; section: string; min: number; avg: number; status: St; warn: number | null; crit: number | null };

/**
 * One row per zone, grouped by section. A pale red band shows the critical range and a pale amber band the warning range
 * (that zone's own limits). A filled dot is the minimum, coloured by status; a hollow dot is the average; both values are printed.
 */
export function ZoneRange({ items }: { items: RangeRow[] }) {
  const { out, height } = layout(items);
  const { top, step } = scale(Math.max(...items.flatMap((i) => [i.avg, i.min, i.warn ?? 0]), 100));
  const x = (v: number) => X0 + (v / top) * (X1 - X0);
  return (
    <svg className="fa-chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Minimum and average thickness of every zone against its limits">
      <Axis x={x} top={top} step={step} height={height} />
      <text x={X1 + 16} y={TOP - 8} fontSize="12" fontWeight="600" fill={MUTED}>min · avg (mm)</text>
      {out.map((o) => {
        if (o.kind === "head") return <text key={`h${o.y}`} x={0} y={o.y + 17} fontSize="12" fontWeight="600" fill={MUTED} style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>{o.text}</text>;
        const r = o.item, cy = o.y + ROW / 2;
        return (
          <g key={r.zone}>
            {r.crit != null && <rect x={x(0)} y={cy - 7} width={Math.max(0, x(r.crit) - x(0))} height="14" rx="2" fill={CRIT_BG} />}
            {r.warn != null && <rect x={x(r.crit ?? 0)} y={cy - 7} width={Math.max(0, x(r.warn) - x(r.crit ?? 0))} height="14" rx="2" fill={WARN_BG} />}
            <line x1={x(Math.min(r.min, r.avg))} x2={x(Math.max(r.min, r.avg))} y1={cy} y2={cy} stroke="#98a2b3" strokeWidth="1.5" />
            <circle cx={x(r.avg)} cy={cy} r="4.5" fill="#fff" stroke={MUTED} strokeWidth="1.8"><title>{`${r.zone}: average ${r.avg} mm`}</title></circle>
            <circle cx={x(r.min)} cy={cy} r="5.5" fill={COLOR[r.status]}><title>{`${r.zone}: minimum ${r.min} mm, ${STATUS_WORD[r.status]}`}</title></circle>
            <text x={X0 - 12} y={cy + 4} textAnchor="end" fontSize="12" fill={INK}>{r.zone}</text>
            <text x={X1 + 16} y={cy + 4} fontSize="12" fill={INK}><tspan fontWeight="600" fill={r.status === "critical" ? "#b42318" : r.status === "warning" ? "#b54708" : INK}>{r.min}</tspan><tspan fill={MUTED}> · {r.avg}</tspan></text>
          </g>
        );
      })}
    </svg>
  );
}

export function ZoneRangeLegend() {
  return (
    <div className="fa-legend">
      <span><i style={{ background: COLOR.ok, borderRadius: "50%" }} />Minimum, OK</span>
      <span><i style={{ background: COLOR.warning, borderRadius: "50%" }} />Minimum, Warning</span>
      <span><i style={{ background: COLOR.critical, borderRadius: "50%" }} />Minimum, Critical</span>
      <span><i style={{ background: "#fff", border: `2px solid ${MUTED}`, borderRadius: "50%", boxSizing: "border-box" }} />Average</span>
      <span><i style={{ background: WARN_BG, width: 18 }} />Warning range</span>
      <span><i style={{ background: CRIT_BG, width: 18 }} />Critical range</span>
    </div>
  );
}

// ------------------------------------------------------------------ heat against heat
export type DumbbellRow = { zone: string; section: string; a: number; b: number };

/** One row per zone: earlier value (slate dot) to later value (brand dot), the line red when thinner and green when thicker, the change printed. */
export function Dumbbell({ rows, aLabel, bLabel, title }: { rows: DumbbellRow[]; aLabel: string; bLabel: string; title: string }) {
  const { out, height } = layout(rows);
  const lo = Math.min(...rows.flatMap((r) => [r.a, r.b])), hi = Math.max(...rows.flatMap((r) => [r.a, r.b]));
  const { top, step } = scale(hi);
  const from = Math.max(0, Math.floor((lo * 0.92) / step) * step);
  const x = (v: number) => X0 + ((v - from) / (top - from)) * (X1 - X0);
  return (
    <svg className="fa-chart" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`${title}: ${aLabel} against ${bLabel}`}>
      <Axis x={x} top={top} step={step} height={height} from={from} />
      <text x={X1 + 16} y={TOP - 8} fontSize="12" fontWeight="600" fill={MUTED}>change (mm)</text>
      {out.map((o) => {
        if (o.kind === "head") return <text key={`h${o.y}`} x={0} y={o.y + 17} fontSize="12" fontWeight="600" fill={MUTED} style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>{o.text}</text>;
        const r = o.item, cy = o.y + ROW / 2, d = r.b - r.a;
        const line = d < 0 ? COLOR.critical : d > 0 ? COLOR.ok : "#98a2b3";
        return (
          <g key={r.zone}>
            <line x1={x(r.a)} x2={x(r.b)} y1={cy} y2={cy} stroke={line} strokeWidth="3" strokeLinecap="round" />
            <circle cx={x(r.a)} cy={cy} r="5" fill={COLOR.a}><title>{`${r.zone} · ${aLabel}: ${r.a} mm`}</title></circle>
            <circle cx={x(r.b)} cy={cy} r="5" fill={COLOR.b}><title>{`${r.zone} · ${bLabel}: ${r.b} mm`}</title></circle>
            <text x={X0 - 12} y={cy + 4} textAnchor="end" fontSize="12" fill={INK}>{r.zone}</text>
            <text x={X1 + 16} y={cy + 4} fontSize="12" fontWeight="600" fill={d < 0 ? "#b42318" : d > 0 ? "#067647" : MUTED}>{d > 0 ? `+${d}` : d}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function DumbbellLegend({ aLabel, bLabel }: { aLabel: string; bLabel: string }) {
  return (
    <div className="fa-legend">
      <span><i style={{ background: COLOR.a, borderRadius: "50%" }} />{aLabel}</span>
      <span><i style={{ background: COLOR.b, borderRadius: "50%" }} />{bLabel}</span>
      <span><i style={{ background: COLOR.critical, width: 18 }} />Thinner</span>
      <span><i style={{ background: COLOR.ok, width: 18 }} />Thicker</span>
    </div>
  );
}
