import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluate, type Limit, type Status } from "./evaluate";

export type Converter = { id: string; code: string; name: string; plant: string; active: boolean };
export type ScanRow = {
  id: string; converter_id: string; campaign_id: string; heat: string; meas_no: number; scanned_at: string;
  steel_level_m: number | null; steel_tonnes: number | null; bath_level_m: number | null; pdf_key: string; limit_version_id: string | null;
};
export type ReadingRow = { id: string; scan_id: string; zone: string; section: string; avg_mm: number; min_mm: number; angle: string | null; depth: string | null; status: Status };
export type LimitVersion = { id: string; converter_id: string; version: number; note: string | null; created_at: string; active: boolean };

const SCAN_COLS = "id, converter_id, campaign_id, heat, meas_no, scanned_at, steel_level_m, steel_tonnes, bath_level_m, pdf_key, limit_version_id";

/** A failed query must look like a failure (the error page), never like "no data". */
function ok<T>(r: { data: T | null; error: { message: string } | null }, what: string): T | null {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

export async function listConverters(supabase: SupabaseClient): Promise<Converter[]> {
  return (ok(await supabase.from("fa_converter").select("id, code, name, plant, active").order("code"), "converters") ?? []) as Converter[];
}

export async function limitsOfVersion(supabase: SupabaseClient, versionId: string | null): Promise<Limit[]> {
  if (!versionId) return [];
  const data = ok(await supabase.from("fa_limit").select("zone, metric, warn_below, critical_below, rec_warning, rec_critical").eq("version_id", versionId), "limits") ?? [];
  return data.map((l) => ({ ...l, warn_below: l.warn_below == null ? null : Number(l.warn_below), critical_below: l.critical_below == null ? null : Number(l.critical_below) })) as Limit[];
}

export async function activeLimits(supabase: SupabaseClient, converterId: string) {
  const v = ok(await supabase.from("fa_limit_version").select("id, converter_id, version, note, created_at, active").eq("converter_id", converterId).eq("active", true).maybeSingle(), "limit version");
  const version = (v as LimitVersion | null) ?? null;
  return { version, rows: await limitsOfVersion(supabase, version?.id ?? null) };
}

export async function loadScan(supabase: SupabaseClient, id: string) {
  const scan = ok(await supabase.from("fa_scan").select(SCAN_COLS).eq("id", id).maybeSingle(), "scan");
  if (!scan) return null;
  const readings = ok(await supabase.from("fa_reading").select("id, scan_id, zone, section, avg_mm, min_mm, angle, depth, status").eq("scan_id", id).order("zone"), "readings") ?? [];
  const rows = (readings as ReadingRow[]).map((r) => ({ ...r, avg_mm: Number(r.avg_mm), min_mm: Number(r.min_mm) }));
  return { scan: scan as ScanRow, readings: rows };
}

/** The scan before this one on the same converter (any campaign), with its readings. */
export async function previousScan(supabase: SupabaseClient, scan: ScanRow) {
  const data = ok(await supabase.from("fa_scan").select("id").eq("converter_id", scan.converter_id).lt("scanned_at", scan.scanned_at).order("scanned_at", { ascending: false }).limit(1), "previous scan");
  const id = data?.[0]?.id as string | undefined;
  return id ? loadScan(supabase, id) : null;
}

/** The newest `limit` scans of every converter, newest first. Per converter, so a quiet converter keeps its scans. */
export async function latestScansByConverter(supabase: SupabaseClient, converters: { id: string }[], limit = 12): Promise<ScanRow[]> {
  const parts = await Promise.all(converters.map(async (c) => (ok(await supabase.from("fa_scan").select(SCAN_COLS).eq("converter_id", c.id).order("scanned_at", { ascending: false }).limit(limit), "scans") ?? []) as ScanRow[]));
  return parts.flat();
}

/** The newest `limit` scans of one converter in time order (oldest first), for the selectors and charts. */
export async function scansForPicker(supabase: SupabaseClient, converterId: string, limit = 300) {
  const data = ok(await supabase.from("fa_scan").select("id, heat, meas_no, scanned_at").eq("converter_id", converterId).order("scanned_at", { ascending: false }).limit(limit), "scans") ?? [];
  return [...data].reverse() as { id: string; heat: string; meas_no: number; scanned_at: string }[];
}

/** Zone counts per scan, judged with each converter's current limits (so a scan saved before the limits existed is judged too). */
export async function statusCounts(supabase: SupabaseClient, scans: Pick<ScanRow, "id" | "converter_id">[], limitsBy: Map<string, Limit[]>) {
  const out = new Map<string, { critical: number; warning: number; ok: number; unset: number }>();
  if (!scans.length) return out;
  const conv = new Map(scans.map((s) => [s.id, s.converter_id]));
  // a response is capped at 1000 rows (about 45 scans of 22 zones), so ask in small batches
  for (let i = 0; i < scans.length; i += 20) {
    const ids = scans.slice(i, i + 20).map((s) => s.id);
    const data = ok(await supabase.from("fa_reading").select("scan_id, zone, avg_mm, min_mm").in("scan_id", ids), "readings") ?? [];
    for (const r of data) {
      const c = out.get(r.scan_id as string) ?? { critical: 0, warning: 0, ok: 0, unset: 0 };
      const st = evaluate({ zone: r.zone as string, avg_mm: Number(r.avg_mm), min_mm: Number(r.min_mm) }, limitsBy.get(conv.get(r.scan_id as string) ?? "") ?? []).status;
      c[st]++;
      out.set(r.scan_id as string, c);
    }
  }
  return out;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
