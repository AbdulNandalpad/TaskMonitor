/* Rules-based extraction of a voice update. Server-side STT / LLM extraction can replace this later behind the same signature. */
import type { Status } from "../types";

export type Extracted = {
  status: Status;
  progress: number;
  manpower: number | null;
  remarks: string;
  needsAttention: boolean;
  /** 0..1 per field so the sheet can highlight low ones */
  confidence: { status: number; progress: number; manpower: number; remarks: number };
};

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
const NUM = "(?:\\d+(?:\\.\\d+)?|" + Object.keys(ONES).join("|") + ")(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?";

export function toNumber(s: string): number | null {
  const t = s.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const parts = t.split(/[\s-]+/);
  let sum = 0;
  for (const p of parts) {
    if (!(p in ONES)) return null;
    sum += ONES[p];
  }
  return sum;
}

export function extract(
  transcript: string,
  task: { status: Status; progress: number; manpower?: number | null },
): Extracted {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const used: string[] = [];
  const conf = { status: 0.3, progress: 0.3, manpower: 0.3, remarks: 0.7 };

  let status: Status = task.status;
  let progress = task.progress;
  let needsAttention = false;

  // explicit percentage: "60 percent", "60%", "seventy percent"
  const pct = new RegExp(`(${NUM})\\s*(?:percent|per cent|%)`).exec(lower);
  let explicitProgress: number | null = null;
  if (pct) {
    const n = toNumber(pct[1]);
    if (n !== null) { explicitProgress = Math.max(0, Math.min(100, Math.round(n))); used.push(pct[0]); }
  }

  const done = /\b(completed?|done|finished|finish)\b/.exec(lower);
  const stopped = /\b(stopped|stop|hold|waiting|blocked|blocker)\b/.exec(lower);
  const started = /\b(started|starting|start|begin|begins|beginning|began)\b/.exec(lower);

  if (done && !/\b(not|nothing|yet to)\s+(?:be\s+)?(?:completed?|done|finished)\b/.test(lower)) {
    status = "completed"; progress = 100; conf.status = 0.9; conf.progress = 0.9; used.push(done[0]);
  } else if (stopped) {
    status = "in_progress"; needsAttention = true; conf.status = 0.7; used.push(stopped[0]);
    if (task.status === "not_started") progress = 10;
  } else if (started) {
    status = "in_progress"; progress = task.status === "in_progress" ? task.progress : 10; conf.status = 0.85; conf.progress = 0.6; used.push(started[0]);
  }
  if (explicitProgress !== null && status !== "completed") {
    progress = explicitProgress;
    status = progress === 100 ? "completed" : progress === 0 ? "not_started" : "in_progress";
    conf.progress = 0.85; conf.status = Math.max(conf.status, 0.75);
  }

  // manpower: "6 people", "six persons", "ten workers", "12 men"
  let manpower: number | null = task.manpower ?? null;
  const mp = new RegExp(`(${NUM})\\s*(?:people|persons|men|workers|manpower)`).exec(lower);
  if (mp) {
    const n = toNumber(mp[1]);
    if (n !== null) { manpower = Math.round(n); conf.manpower = 0.85; used.push(mp[0]); }
  }

  // remarks: whatever is left once clauses made only of recognised phrases are dropped
  const clauses = text.split(/[.;,\n]+|\s+(?:and|but)\s+/i).map((c) => c.trim()).filter(Boolean);
  const rest = clauses.filter((c) => {
    const l = c.toLowerCase();
    const hit = used.some((u) => l.includes(u));
    return !(hit && l.split(/\s+/).length <= 4);
  });
  let remarks = rest.join(". ");
  if (remarks) remarks = remarks[0].toUpperCase() + remarks.slice(1) + (/[.!?]$/.test(remarks) ? "" : ".");
  if (needsAttention) remarks = ("Needs attention. " + remarks).trim();
  if (!remarks) conf.remarks = 0.5;

  return { status, progress, manpower, remarks, needsAttention, confidence: conf };
}
