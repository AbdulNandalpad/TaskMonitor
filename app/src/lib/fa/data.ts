import type { SupabaseClient } from "@supabase/supabase-js";
import type { Limit, Status } from "./evaluate";

export type Converter = { id: string; code: string; name: string; plant: string; active: boolean };
export type ScanRow = {
  id: string; converter_id: string; campaign_id: string; heat: string; meas_no: number; scanned_at: string;
  steel_level_m: number | null; steel_tonnes: number | null; bath_level_m: number | null; pdf_key: string; limit_version_id: string | null;
};
export type ReadingRow = { id: string; scan_id: string; zone: string; section: string; avg_mm: number; min_mm: number; angle: string | null; depth: string | null; status: Status };
export type LimitVersion = { id: string; converter_id: string; version: number; note: string | null; created_at: string; active: boolean };

const SCAN_COLS = "id, converter_id, campaign_id, heat, meas_no, scanned_at, steel_level_m, steel_tonnes, bath_level_m, pdf_key, limit_version_id";

export async function listConverters(supabase: SupabaseClient): Promise<Converter[]> {
  const { data } = await supabase.from("fa_converter").select("id, code, name, plant, active").order("code");
  return (data ?? []) as Converter[];
}

export async function limitsOfVersion(supabase: SupabaseClient, versionId: string | null): Promise<Limit[]> {
  if (!versionId) return [];
  const { data } = await supabase.from("fa_limit").select("zone, metric, warn_below, critical_below, rec_warning, rec_critical").eq("version_id", versionId);
  return (data ?? []).map((l) => ({ ...l, warn_below: l.warn_below == null ? null : Number(l.warn_below), critical_below: l.critical_below == null ? null : Number(l.critical_below) })) as Limit[];
}

export async function activeLimits(supabase: SupabaseClient, converterId: string) {
  const { data: v } = await supabase.from("fa_limit_version").select("id, converter_id, version, note, created_at, active").eq("converter_id", converterId).eq("active", true).maybeSingle();
  const version = (v as LimitVersion | null) ?? null;
  return { version, rows: await limitsOfVersion(supabase, version?.id ?? null) };
}

export async function loadScan(supabase: SupabaseClient, id: string) {
  const { data: scan } = await supabase.from("fa_scan").select(SCAN_COLS).eq("id", id).maybeSingle();
  if (!scan) return null;
  const { data: readings } = await supabase.from("fa_reading").select("id, scan_id, zone, section, avg_mm, min_mm, angle, depth, status").eq("scan_id", id).order("zone");
  const rows = ((readings ?? []) as ReadingRow[]).map((r) => ({ ...r, avg_mm: Number(r.avg_mm), min_mm: Number(r.min_mm) }));
  return { scan: scan as ScanRow, readings: rows };
}

/** The scan before this one on the same converter (any campaign), with its readings. */
export async function previousScan(supabase: SupabaseClient, scan: ScanRow) {
  const { data } = await supabase.from("fa_scan").select("id").eq("converter_id", scan.converter_id).lt("scanned_at", scan.scanned_at).order("scanned_at", { ascending: false }).limit(1);
  const id = data?.[0]?.id as string | undefined;
  return id ? loadScan(supabase, id) : null;
}

export async function recentScans(supabase: SupabaseClient, limit = 12) {
  const { data } = await supabase.from("fa_scan").select(SCAN_COLS).order("scanned_at", { ascending: false }).limit(limit);
  return (data ?? []) as ScanRow[];
}

export async function statusCounts(supabase: SupabaseClient, scanIds: string[]) {
  const out = new Map<string, { critical: number; warning: number; ok: number; unset: number }>();
  if (!scanIds.length) return out;
  const { data } = await supabase.from("fa_reading").select("scan_id, status").in("scan_id", scanIds).limit(5000);
  for (const r of data ?? []) {
    const c = out.get(r.scan_id as string) ?? { critical: 0, warning: 0, ok: 0, unset: 0 };
    c[r.status as Status]++;
    out.set(r.scan_id as string, c);
  }
  return out;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
