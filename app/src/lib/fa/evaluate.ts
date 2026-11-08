/* Furnace Analysis: judge zone readings against the limits an administrator keeps.
   Thickness BELOW the warning level is a warning and below the critical level is critical. The most specific limit wins:
   an exact zone name, then its section, then "*" (every zone). Without any limit a reading is "unset", never "ok". */
import { sectionOf } from "./zones";

export type Status = "ok" | "warning" | "critical" | "unset";
export type Metric = "avg" | "min";
export type Limit = {
  zone: string; metric: Metric; warn_below: number | null; critical_below: number | null;
  rec_warning: string | null; rec_critical: string | null;
};
export type Reading = { zone: string; section?: string; avg_mm: number; min_mm: number };

const RANK: Record<Status, number> = { unset: 0, ok: 1, warning: 2, critical: 3 };
export const worst = (...s: Status[]): Status => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "unset" as Status);

/** The limit that applies to a zone and metric, or null. */
export function pickLimit(limits: Limit[], zone: string, metric: Metric): Limit | null {
  const section = sectionOf(zone);
  const norm = (s: string) => s.trim().toLowerCase();
  const rows = limits.filter((l) => l.metric === metric);
  return rows.find((l) => norm(l.zone) === norm(zone)) ?? rows.find((l) => norm(l.zone) === norm(section)) ?? rows.find((l) => l.zone.trim() === "*") ?? null;
}

export function judge(value: number, limit: Limit | null): Status {
  if (!limit || (limit.warn_below == null && limit.critical_below == null)) return "unset";
  if (limit.critical_below != null && value < limit.critical_below) return "critical";
  if (limit.warn_below != null && value < limit.warn_below) return "warning";
  return "ok";
}

export type Evaluated = {
  status: Status;
  avg: { status: Status; limit: Limit | null };
  min: { status: Status; limit: Limit | null };
  /** the recommendation texts that go with the status, without repeats */
  recommendations: string[];
};

export function evaluate(r: Reading, limits: Limit[]): Evaluated {
  const la = pickLimit(limits, r.zone, "avg"), lm = pickLimit(limits, r.zone, "min");
  const sa = judge(r.avg_mm, la), sm = judge(r.min_mm, lm);
  const status = worst(sa, sm);
  const rec = (s: Status, l: Limit | null) => (s === "critical" ? l?.rec_critical : s === "warning" ? l?.rec_warning : null);
  const recommendations = [...new Set([rec(sa, la), rec(sm, lm)].filter((x): x is string => !!x && !!x.trim()))];
  return { status, avg: { status: sa, limit: la }, min: { status: sm, limit: lm }, recommendations };
}

export const counts = (statuses: Status[]) => ({
  critical: statuses.filter((s) => s === "critical").length,
  warning: statuses.filter((s) => s === "warning").length,
  ok: statuses.filter((s) => s === "ok").length,
  unset: statuses.filter((s) => s === "unset").length,
});

/** A minimum that goes UP between scans cannot be wear; it usually means a repair (gunning) or a scan difference. */
export const RISE_MM = 30;
export type Delta = { avg: number; min: number; rose: boolean };
export function delta(prev: Reading | undefined, cur: Reading): Delta | null {
  if (!prev) return null;
  const min = cur.min_mm - prev.min_mm;
  return { avg: cur.avg_mm - prev.avg_mm, min, rose: min >= RISE_MM };
}

export const STATUS_LABEL: Record<Status, string> = { ok: "OK", warning: "Warning", critical: "Critical", unset: "No limit" };

/** Limits from a spreadsheet: Zone, Metric, Warning below, Critical below, Recommendation (warning), Recommendation (critical). */
export function parseLimitRows(rows: unknown[][]): { rows: Limit[]; problems: string[] } {
  const problems: string[] = [];
  const out: Limit[] = [];
  const num = (v: unknown) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.\-]/g, "")); return String(v ?? "").trim() === "" || !Number.isFinite(n) ? null : n; };
  rows.forEach((r, i) => {
    const first = String(r[0] ?? "").trim().toLowerCase();
    if (i === 0 && (first === "zone" || first.startsWith("zone"))) return;
    if (r.every((c) => String(c ?? "").trim() === "")) return;
    const zone = String(r[0] ?? "").trim() || "*";
    const m = String(r[1] ?? "").trim().toLowerCase();
    const metric: Metric | null = m.startsWith("avg") || m.startsWith("average") ? "avg" : m.startsWith("min") ? "min" : null;
    if (!metric) { problems.push(`Row ${i + 1}: metric must be Average or Minimum`); return; }
    const warn = num(r[2]), crit = num(r[3]);
    if (warn == null && crit == null) { problems.push(`Row ${i + 1}: give a warning or a critical level`); return; }
    if (warn != null && crit != null && crit > warn) { problems.push(`Row ${i + 1}: the critical level must not be above the warning level`); return; }
    out.push({ zone, metric, warn_below: warn, critical_below: crit, rec_warning: String(r[4] ?? "").trim() || null, rec_critical: String(r[5] ?? "").trim() || null });
  });
  return { rows: out, problems };
}
