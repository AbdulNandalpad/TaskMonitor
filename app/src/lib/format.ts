import type { Status, Task } from "./types";

/** Avatar / tile backgrounds. One neutral tint: colour is reserved for status and the primary action. */
export const HUES = ["var(--neutral-bg)"];

export const initials = (n: string) => {
  const w = n.replace(/[&,·]/g, " ").split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : n.slice(0, 2)).toUpperCase();
};

const TZ = "Asia/Kolkata";
export function fmtWhen(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return `${date} · ${time}`;
}
export function fmtStamp(d = new Date()) {
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}`;
}

export type Stats = { n: number; done: number; prog: number; open: number; pct: number; un: number };
export function stats(list: Pick<Task, "status" | "progress" | "responsible_person_id">[]): Stats {
  const o: Stats = { n: list.length, done: 0, prog: 0, open: 0, pct: 0, un: 0 };
  list.forEach((j) => {
    if (j.status === "completed") o.done++;
    else if (j.status === "in_progress") o.prog++;
    else o.open++;
    o.pct += j.progress;
    if (!j.responsible_person_id) o.un++;
  });
  o.pct = o.n ? Math.round(o.pct / o.n) : 0;
  return o;
}

export const statusOf = (s: string): Status => (["not_started", "in_progress", "completed"].includes(s) ? (s as Status) : "not_started");

export const fieldLabel: Record<string, string> = {
  work_description: "Work description", planned_hours: "Planned hours", manpower: "Manpower", vendor: "Vendor",
  remarks: "Remarks", photo_on_completion: "Photo required", section: "Section", responsible: "Responsible",
};
export function fmtValue(key: string, v: unknown) {
  if (v === null || v === undefined || v === "") return key === "responsible" ? "Unassigned" : key === "vendor" ? "In‑house" : "–";
  if (key === "planned_hours") return `${v} h`;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
