/* Furnace Analysis charts: plain SVG, rendered on the server, no chart library.
   One frame for all of them: 880 units wide, 12 px text, neutral grid, zone names horizontal, values printed. */
import Link from "next/link";

export const COLOR = { critical: "#d92d20", warning: "#dc6803", ok: "#079455", unset: "#98a2b3", a: "#475467", b: "#c2410c" } as const;
const INK = "#101828", MUTED = "#667085", GRID = "#eef0f3", CRIT_BG = "#fee4e2", WARN_BG = "#fef0c7";
type St = "critical" | "warning" | "ok" | "unset";
const STATUS_WORD: Record<St, string> = { critical: "Critical", warning: "Warning", ok: "OK", unset: "No limit" };

const W = 880, ROW = 22, HEAD = 26, TOP = 22, AXIS = 42;
/** The same chart is drawn twice, wide for desktop and compact for a phone; CSS shows one of them. */
const frame = (compact: boolean) => { const w = compact ? 380 : 880, lbl = compact ? 112 : 150, right = compact ? 84 : 150; return { w, X0: lbl, X1: w - right }; };
function Both({ children }: { children: (compact: boolean) => React.ReactNode }) { return (<><div className="fa-wide-only">{children(false)}</div><div className="fa-narrow-only">{children(true)}</div></>); }

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

function Axis({ x, top, step, height, X1, from = 0, unit = "mm" }: { x: (v: number) => number; top: number; step: number; height: number; X1: number; from?: number; unit?: string }) {
  const ticks: number[] = []; for (let v = from; v <= top + 0.001; v += step) ticks.push(v);
  return (
    <g>
      {ticks.map((v) => (<g key={v}><line x1={x(v)} x2={x(v)} y1={TOP - 4} y2={height - AXIS + 2} stroke={GRID} /><text x={x(v)} y={height - AXIS + 16} textAnchor="middle" fontSize="12" fill={MUTED}>{v}</text></g>))}
      <text x={X1} y={height - 4} textAnchor="end" fontSize="12" fill={MUTED}>thickness ({unit})</text>
    </g>
  );
}

// ------------------------------------------------------------------ status split as one segmented bar
/** The split of zones by status as one bar; each segment is a link that filters the list below. */
export function StatusBar({ counts, hrefFor, selected }: { counts: { critical: number; warning: number; ok: number; unset: number }; hrefFor?: (s: St) => string; selected?: string | null }) {
  const order: St[] = ["critical", "warning", "ok", "unset"];
  const total = order.reduce((a, s) => a + counts[s], 0);
  if (!total) return null;
  return (
    <div className="fa-statuswrap">
      <div className="fa-meter" aria-hidden="true">
        {order.filter((s) => counts[s] > 0).map((s) => <i key={s} className={s} style={{ flexGrow: counts[s] }} />)}
      </div>
      <div className="fa-segbar" role="group" aria-label={`Zones by status: ${order.map((s) => `${counts[s]} ${STATUS_WORD[s]}`).join(", ")}`}>
        {order.filter((s) => counts[s] > 0).map((s) => {
          const inner = (<><span className="fa-seg-l"><i aria-hidden="true" />{STATUS_WORD[s]}</span><b>{counts[s]}</b></>);
          const cls = `fa-seg ${s}${selected === s ? " sel" : ""}`;
          const tip = `${counts[s]} of ${total} zones (${Math.round((counts[s] / total) * 100)}%)`;
          return hrefFor ? <Link key={s} href={hrefFor(s)} className={cls} title={tip}>{inner}</Link> : <div key={s} className={cls} title={tip}>{inner}</div>;
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
  return <Both>{(compact) => <ZoneRangeSvg items={items} compact={compact} />}</Both>;
}

function ZoneRangeSvg({ items, compact }: { items: RangeRow[]; compact: boolean }) {
  const { w, X0, X1 } = frame(compact);
  const { out, height } = layout(items);
  const { top, step } = scale(Math.max(...items.flatMap((i) => [i.avg, i.min, i.warn ?? 0]), 100));
  const x = (v: number) => X0 + (v / top) * (X1 - X0);
  return (
    <svg className="fa-chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Minimum and average thickness of every zone against its limits">
      <Axis x={x} top={top} step={step} height={height} X1={X1} />
      <text x={X1 + (compact ? 10 : 16)} y={TOP - 8} fontSize="12" fontWeight="600" fill={MUTED}>{compact ? "thin · avg" : "thin · avg (mm)"}</text>
      {out.map((o) => {
        if (o.kind === "head") return <text key={`h${o.y}`} x={0} y={o.y + 17} fontSize="12" fontWeight="600" fill={MUTED} style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>{o.text}</text>;
        const r = o.item, cy = o.y + ROW / 2;
        return (
          <g key={r.zone}>
            <rect x={x(0)} y={cy - 6} width={Math.max(2, x(r.avg) - x(0))} height="12" rx="6" fill="#e7e2da"><title>{`${r.zone}: average ${r.avg} mm`}</title></rect>
            <rect x={x(0)} y={cy - 6} width={Math.max(6, x(r.min) - x(0))} height="12" rx="6" fill={COLOR[r.status]}><title>{`${r.zone}: thinnest point ${r.min} mm, ${STATUS_WORD[r.status]}`}</title></rect>
            {r.warn != null && <line x1={x(r.warn)} x2={x(r.warn)} y1={cy - 10} y2={cy + 10} stroke={COLOR.warning} strokeWidth="2" strokeLinecap="round"><title>{`Warning below ${r.warn} mm`}</title></line>}
            {r.crit != null && <line x1={x(r.crit)} x2={x(r.crit)} y1={cy - 10} y2={cy + 10} stroke={COLOR.critical} strokeWidth="2" strokeLinecap="round"><title>{`Critical below ${r.crit} mm`}</title></line>}
            <text x={X0 - (compact ? 8 : 12)} y={cy + 4} textAnchor="end" fontSize="12" fill={INK}>{r.zone}</text>
            <text x={X1 + (compact ? 10 : 16)} y={cy + 4} fontSize="12" fill={INK}><tspan fontWeight="600" fill={r.status === "critical" ? "#b42318" : r.status === "warning" ? "#b54708" : INK}>{r.min}</tspan><tspan fill={MUTED}> · {r.avg}</tspan></text>
          </g>
        );
      })}
    </svg>
  );
}

export function ZoneRangeLegend() {
  return (
    <div className="fa-legend">
      <span><i style={{ background: COLOR.ok, width: 18, borderRadius: 6 }} />Thinnest point (colour = status)</span>
      <span><i style={{ background: "#e7e2da", width: 18, borderRadius: 6 }} />Average</span>
      <span><i style={{ background: COLOR.warning, width: 3, height: 14 }} />Warning level</span>
      <span><i style={{ background: COLOR.critical, width: 3, height: 14 }} />Critical level</span>
    </div>
  );
}

// ------------------------------------------------------------------ heat against heat
export type DumbbellRow = { zone: string; section: string; a: number; b: number };

/** One row per zone: earlier value (slate dot) to later value (brand dot), the line red when thinner and green when thicker, the change printed. */
export function Dumbbell(props: { rows: DumbbellRow[]; aLabel: string; bLabel: string; title: string }) {
  return <Both>{(compact) => <DumbbellSvg {...props} compact={compact} />}</Both>;
}

function DumbbellSvg({ rows, aLabel, bLabel, title, compact }: { rows: DumbbellRow[]; aLabel: string; bLabel: string; title: string; compact: boolean }) {
  const { w, X0, X1 } = frame(compact);
  const { out, height } = layout(rows);
  const lo = Math.min(...rows.flatMap((r) => [r.a, r.b])), hi = Math.max(...rows.flatMap((r) => [r.a, r.b]));
  const { top, step } = scale(hi);
  const from = Math.max(0, Math.floor((lo * 0.92) / step) * step);
  const x = (v: number) => X0 + ((v - from) / (top - from)) * (X1 - X0);
  return (
    <svg className="fa-chart" viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`${title}: ${aLabel} against ${bLabel}`}>
      <Axis x={x} top={top} step={step} height={height} X1={X1} from={from} />
      <text x={X1 + (compact ? 10 : 16)} y={TOP - 8} fontSize="12" fontWeight="600" fill={MUTED}>change</text>
      {out.map((o) => {
        if (o.kind === "head") return <text key={`h${o.y}`} x={0} y={o.y + 17} fontSize="12" fontWeight="600" fill={MUTED} style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>{o.text}</text>;
        const r = o.item, cy = o.y + ROW / 2, d = r.b - r.a;
        const line = d < 0 ? COLOR.critical : d > 0 ? COLOR.ok : "#98a2b3";
        return (
          <g key={r.zone}>
            <line x1={x(r.a)} x2={x(r.b)} y1={cy} y2={cy} stroke={line} strokeWidth="3" strokeLinecap="round" />
            <circle cx={x(r.a)} cy={cy} r="5" fill={COLOR.a}><title>{`${r.zone} · ${aLabel}: ${r.a} mm`}</title></circle>
            <circle cx={x(r.b)} cy={cy} r="5" fill={COLOR.b}><title>{`${r.zone} · ${bLabel}: ${r.b} mm`}</title></circle>
            <text x={X0 - (compact ? 8 : 12)} y={cy + 4} textAnchor="end" fontSize="12" fill={INK}>{r.zone}</text>
            <text x={X1 + (compact ? 10 : 16)} y={cy + 4} fontSize="12" fontWeight="600" fill={d < 0 ? "#b42318" : d > 0 ? "#067647" : MUTED}>{d > 0 ? `+${d}` : d}</text>
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

// ------------------------------------------------------------------ lines over time
export type Pt = { t: number; v: number };
export type Series = { label: string; color: string; points: Pt[]; dash?: string };
const dshort = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });

/** Lines over a real time axis, with optional horizontal limit lines labelled in the right gutter. */
export function LineChart(props: { series: Series[]; lines?: { v: number; color: string; label: string }[]; title: string; height?: number; width?: number }) {
  return (<><div className="fa-wide-only"><LineSvg {...props} /></div><div className="fa-narrow-only"><LineSvg {...props} width={360} height={Math.min(props.height ?? 280, 260)} compact /></div></>);
}

function LineSvg({ series, lines = [], title, height = 280, width = W, compact = false }: { series: Series[]; lines?: { v: number; color: string; label: string }[]; title: string; height?: number; width?: number; compact?: boolean }) {
  const Wd = width;
  const L = compact ? 40 : 48, R = compact ? 70 : 96, T = 14, B = 34;
  const all = series.flatMap((s) => s.points);
  if (!all.length) return null;
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t)) || t0 + 1;
  const { top, step } = scale(Math.max(...all.map((p) => p.v), ...lines.map((l) => l.v), 100));
  const x = (t: number) => (t1 === t0 ? (L + Wd - R) / 2 : L + ((t - t0) / (t1 - t0)) * (Wd - L - R));
  const y = (v: number) => T + (1 - v / top) * (height - T - B);
  const grid: number[] = []; for (let v = 0; v <= top + 0.001; v += step) grid.push(v);
  const ticks = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b);
  const every = Math.max(1, Math.ceil(ticks.length / (Wd < 600 ? 4 : 7)));
  const lastI = ticks.length - 1;
  return (
    <svg className="fa-chart" viewBox={`0 0 ${Wd} ${height}`} role="img" aria-label={title}>
      {grid.map((g) => (<g key={g}><line x1={L} x2={Wd - R} y1={y(g)} y2={y(g)} stroke={GRID} /><text x={L - 8} y={y(g) + 4} textAnchor="end" fontSize="12" fill={MUTED}>{g}</text></g>))}
      {lines.map((l) => (<g key={l.label}><line x1={L} x2={Wd - R} y1={y(l.v)} y2={y(l.v)} stroke={l.color} strokeWidth="1.5" strokeDasharray="5 4" /><text x={Wd - R + 8} y={y(l.v) + 4} fontSize="12" fill={l.color}>{l.label}</text></g>))}
      {ticks.map((t, i) => (i === lastI || (i % every === 0 && lastI - i >= every)) && <text key={t} x={x(t)} y={height - 12} textAnchor="middle" fontSize="12" fill={MUTED}>{dshort(t)}</text>)}
      {series.map((s) => (
        <g key={s.label}>
          <path d={s.points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join("")} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray={s.dash} />
          {s.points.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r="4" fill="#fff" stroke={s.color} strokeWidth="2"><title>{`${s.label}, ${dshort(p.t)}: ${p.v} mm`}</title></circle>)}
        </g>
      ))}
    </svg>
  );
}

/** Small trend line for a card: the series over time with the zone's own limit lines, last point filled. */
export function Spark({ points, warn, crit, color }: { points: Pt[]; warn: number | null; crit: number | null; color: string }) {
  const Wd = 180, Hd = 52, p = 6;
  if (points.length < 1) return null;
  const vs = [...points.map((q) => q.v), ...(warn != null ? [warn] : []), ...(crit != null ? [crit] : [])];
  const lo = Math.min(...vs) * 0.92, hi = Math.max(...vs) * 1.05 || 1;
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const x = (t: number) => (t1 === t0 ? Wd / 2 : p + ((t - t0) / (t1 - t0)) * (Wd - 2 * p));
  const y = (v: number) => Hd - p - ((v - lo) / (hi - lo || 1)) * (Hd - 2 * p);
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${Wd} ${Hd}`} width="100%" height={Hd} preserveAspectRatio="none" aria-hidden="true">
      {warn != null && <line x1="0" x2={Wd} y1={y(warn)} y2={y(warn)} stroke={COLOR.warning} strokeWidth="1" strokeDasharray="3 3" />}
      {crit != null && <line x1="0" x2={Wd} y1={y(crit)} y2={y(crit)} stroke={COLOR.critical} strokeWidth="1" strokeDasharray="3 3" />}
      <path d={points.map((q, i) => `${i ? "L" : "M"}${x(q.t).toFixed(1)} ${y(q.v).toFixed(1)}`).join("")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last.t)} cy={y(last.v)} r="3.5" fill={color} />
    </svg>
  );
}
