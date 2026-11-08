import { NextResponse } from "next/server";
import { activeLimits, fmtDateTime } from "@/lib/fa/data";
import { buildMail, sendMail, type MailFinding } from "@/lib/fa/email";
import { counts, evaluate, worst, type Status } from "@/lib/fa/evaluate";
import { faApi } from "@/lib/fa/guard";
import { dbError } from "@/lib/fa/http";
import { sectionOf } from "@/lib/fa/zones";

/**
 * Save one confirmed scan. The zones are judged against the converter's active limits here (never trusted from the browser),
 * the limit version used is stored with the scan, and a warning or critical result is mailed to the configured recipients.
 */
export async function POST(req: Request) {
  const g = await faApi({ edit: true });
  if ("res" in g) return g.res;
  const { supabase } = g.ctx;
  const b = await req.json().catch(() => null);
  const d = b?.draft;
  const key = typeof b?.pdf_key === "string" ? b.pdf_key : "";
  if (!d || !/^uploads\/[A-Za-z0-9_-]+\.pdf$/.test(key)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const code = String(d.converter_code ?? "").trim(), heat = String(d.heat ?? "").trim();
  const campaign = Number(d.campaign_no), meas = Number(d.meas_no);
  const when = String(d.scanned_at ?? "");
  const zones: Record<string, unknown>[] = Array.isArray(d.zones) ? d.zones : [];
  if (!code || !heat || !Number.isInteger(campaign) || !Number.isInteger(meas) || !when || Number.isNaN(Date.parse(when))) {
    return NextResponse.json({ error: "Converter, campaign, heat, measurement number and date are all needed" }, { status: 400 });
  }
  type Z = { zone: string; avg_mm: number; min_mm: number; angle: string; depth: string };
  const clean: Z[] = zones.flatMap((z): Z[] => {
    const zone = String(z.zone ?? "").trim(), avg = Number(z.avg_mm), min = Number(z.min_mm);
    return zone && Number.isFinite(avg) && Number.isFinite(min) && avg >= 0 && min >= 0 ? [{ zone, avg_mm: avg, min_mm: min, angle: String(z.angle ?? ""), depth: String(z.depth ?? "") }] : [];
  });
  if (!clean.length) return NextResponse.json({ error: "No zone readings to save" }, { status: 400 });

  const { data: conv } = await supabase.from("fa_converter").select("id, name").eq("code", code).maybeSingle();
  const lim = conv ? await activeLimits(supabase, conv.id) : { version: null, rows: [] };
  const evald = clean.map((z) => ({ ...z, section: sectionOf(z.zone), ev: evaluate({ ...z }, lim.rows) }));
  const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

  const { data: id, error } = await supabase.rpc("fa_scan_save", {
    p_scan: {
      converter_code: code, converter_name: String(d.converter_name ?? ""), plant: String(d.plant ?? ""), campaign_no: campaign, heat, meas_no: meas,
      scanned_at: when, steel_level_m: num(d.steel_level_m), steel_tonnes: num(d.steel_tonnes), bath_level_m: num(d.bath_level_m),
      pdf_key: key, pdf_bytes: num(b.pdf_bytes), limit_version_id: lim.version?.id ?? null,
    },
    p_readings: evald.map((z) => ({ zone: z.zone, section: z.section, avg_mm: z.avg_mm, min_mm: z.min_mm, angle: z.angle, depth: z.depth, status: z.ev.status })),
  });
  if (error) return dbError(error);

  const statuses = evald.map((z) => z.ev.status);
  const severity: Status = worst(...statuses);
  const mail = { sent: 0, failed: 0, skipped: 0, recipients: 0 };
  if (severity === "warning" || severity === "critical") {
    const { data: scanRow } = await supabase.from("fa_scan").select("converter_id").eq("id", id).maybeSingle();
    const converterId = scanRow?.converter_id as string | undefined;
    const { data: to } = converterId ? await supabase.rpc("fa_recipients_for", { p_converter: converterId, p_severity: severity }) : { data: [] };
    const recipients = (to ?? []) as { name: string; email: string }[];
    mail.recipients = recipients.length;
    if (recipients.length) {
      const { data: c2 } = await supabase.from("fa_converter").select("name").eq("code", code).maybeSingle();
      const findings: MailFinding[] = evald.filter((z) => z.ev.status === "critical" || z.ev.status === "warning")
        .sort((a, bb) => (a.ev.status === bb.ev.status ? a.min_mm - bb.min_mm : a.ev.status === "critical" ? -1 : 1))
        .map((z) => ({ zone: z.zone, section: z.section, avg_mm: z.avg_mm, min_mm: z.min_mm, status: z.ev.status, evaluated: z.ev }));
      const origin = req.headers.get("origin") ?? new URL(req.url).origin;
      const m = buildMail({ converter: c2?.name ?? conv?.name ?? `Converter ${code}`, heat, measNo: meas, scannedAt: fmtDateTime(when), link: `${origin}/furnace/scans/${id}`, severity, findings });
      for (const r of recipients) {
        const out = await sendMail(r.email, m);
        await supabase.rpc("fa_notification_log", { p_scan: id, p_email: r.email, p_outcome: out.outcome, p_detail: out.detail });
        if (out.outcome === "sent") mail.sent++; else if (out.outcome === "failed") mail.failed++; else mail.skipped++;
      }
    }
  }
  return NextResponse.json({ id, severity, counts: counts(statuses), limitVersion: lim.version?.version ?? null, mail });
}
