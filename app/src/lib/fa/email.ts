/* Furnace Analysis: the findings email, sent through Resend. Without RESEND_API_KEY nothing is sent and the log says so. */
import type { Evaluated, Status } from "./evaluate";
import { STATUS_LABEL } from "./evaluate";

export type MailFinding = { zone: string; section: string; avg_mm: number; min_mm: number; status: Status; evaluated: Evaluated };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildMail(opts: { converter: string; heat: string; measNo: number; scannedAt: string; link: string; severity: Status; findings: MailFinding[] }) {
  const sev = STATUS_LABEL[opts.severity];
  const subject = `${sev}: ${opts.converter}, heat ${opts.heat} (measurement ${opts.measNo})`;
  const rows = opts.findings.map((f) => {
    const recs = f.evaluated.recommendations.map((r) => `<div style="color:#475569;font-size:12px">${esc(r)}</div>`).join("");
    const color = f.status === "critical" ? "#dc2626" : "#d97706";
    return `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0"><b>${esc(f.zone)}</b><div style="color:#64748b;font-size:12px">${esc(f.section)}</div></td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0">${f.avg_mm} mm</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${f.min_mm} mm</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0"><b style="color:${color}">${STATUS_LABEL[f.status]}</b>${recs}</td></tr>`;
  }).join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:640px">
    <h2 style="margin:0 0 4px">Furnace Analysis: ${esc(sev)}</h2>
    <p style="margin:0 0 12px;color:#475569">${esc(opts.converter)} · heat ${esc(opts.heat)} · measurement ${opts.measNo} · ${esc(opts.scannedAt)}</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr style="text-align:left;color:#64748b;font-size:12px"><th style="padding:8px">Zone</th><th style="padding:8px">Average</th><th style="padding:8px">Minimum</th><th style="padding:8px">Status</th></tr></thead><tbody>${rows}</tbody></table>
    <p style="margin:16px 0"><a href="${esc(opts.link)}" style="background:#ea580c;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open the report</a></p>
    <p style="color:#94a3b8;font-size:12px">Zones are judged against the limits kept in Furnace Analysis. This message was sent automatically.</p></div>`;
  return { subject, html };
}

export type SendOutcome = { outcome: "sent" | "skipped_no_key" | "failed"; detail: string };

export async function sendMail(to: string, mail: { subject: string; html: string }): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { outcome: "skipped_no_key", detail: "RESEND_API_KEY is not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.FA_MAIL_FROM || "Furnace Analysis <onboarding@resend.dev>", to: [to], subject: mail.subject, html: mail.html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); return { outcome: "failed", detail: `Resend ${res.status}: ${String(j?.message ?? j?.name ?? "").slice(0, 160)}` }; }
    return { outcome: "sent", detail: "" };
  } catch (e) {
    return { outcome: "failed", detail: (e as Error).message.slice(0, 160) };
  }
}
