/* Offline check of the Furnace Analysis logic: judging against limits, reading a report draft, the findings email, the limits spreadsheet. npx tsx scripts/fa-unit-test.ts */
import { counts, delta, evaluate, judge, parseLimitRows, pickLimit, worst, type Limit } from "../src/lib/fa/evaluate";
import { toDraft } from "../src/lib/fa/extract";
import { buildMail } from "../src/lib/fa/email";
import { sectionOf } from "../src/lib/fa/zones";

let fail = 0;
const ck = (n: string, ok: boolean, d = "") => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  " + d : ""}`); };

const L = (zone: string, metric: "avg" | "min", warn: number | null, crit: number | null, rw: string | null = null, rc: string | null = null): Limit => ({ zone, metric, warn_below: warn, critical_below: crit, rec_warning: rw, rec_critical: rc });
const limits = [L("*", "min", 400, 150, "Plan gunning", "Repair now"), L("Tapside", "min", 300, 100), L("ChargePad-1A", "min", 500, 250, null, "Stop the converter"), L("Tapside", "avg", 900, 600)];

ck("sections", sectionOf("Tapside Area-1") === "Tapside" && sectionOf("Left Trunion-3") === "Trunnion" && sectionOf("ChargePad-1A") === "Charge Pad" && sectionOf("SL-NON Drive") === "Slag line" && sectionOf("X") === "Other");
ck("most specific limit wins: zone > section > *", pickLimit(limits, "ChargePad-1A", "min")?.critical_below === 250 && pickLimit(limits, "Tapside Area-2", "min")?.critical_below === 100 && pickLimit(limits, "Left Trunion-1", "min")?.critical_below === 150);
ck("no limit for a metric gives null", pickLimit(limits, "Left Trunion-1", "avg") === null);
ck("judge: ok / warning / critical", judge(500, limits[0]) === "ok" && judge(399, limits[0]) === "warning" && judge(149, limits[0]) === "critical" && judge(150, limits[0]) === "warning");
ck("judge: no limit is unset, never ok", judge(1000, null) === "unset" && judge(1000, L("*", "min", null, null)) === "unset");
const a = evaluate({ zone: "ChargePad-1A", avg_mm: 1138, min_mm: 60 }, limits);
ck("heat 2083 ChargePad-1A (min 60 mm) is critical with its recommendation", a.status === "critical" && a.recommendations.join() === "Stop the converter", JSON.stringify(a.recommendations));
const b = evaluate({ zone: "Tapside Area-1", avg_mm: 1087, min_mm: 359 }, limits);
ck("Tapside-1 min 359 is ok against the Tapside limit (300/100), avg ok", b.status === "ok", b.status);
const c = evaluate({ zone: "Right Trunion-1", avg_mm: 951, min_mm: 108 }, limits);
ck("Right Trunion-1 min 108 is critical by the * limit, with its recommendation", c.status === "critical" && c.recommendations[0] === "Repair now");
const d = evaluate({ zone: "Tapside Area-3", avg_mm: 741, min_mm: 522 }, limits);
ck("worst of average and minimum decides (avg 741 < 900 warns)", d.status === "warning" && d.avg.status === "warning" && d.min.status === "ok");
ck("evaluate without limits is unset", evaluate({ zone: "A", avg_mm: 1, min_mm: 1 }, []).status === "unset");
ck("worst/counts", worst("ok", "critical", "warning") === "critical" && JSON.stringify(counts(["ok", "ok", "critical", "unset"])) === '{"critical":1,"warning":0,"ok":2,"unset":1}');
const dl = delta({ zone: "ChargePad-1A", avg_mm: 1138, min_mm: 60 }, { zone: "ChargePad-1A", avg_mm: 861, min_mm: 202 });
ck("minimum going up 142 mm is flagged as a possible repair", dl?.rose === true && dl.min === 142 && dl.avg === -277);
ck("thinning is not flagged", delta({ zone: "Z", avg_mm: 800, min_mm: 600 }, { zone: "Z", avg_mm: 790, min_mm: 590 })?.rose === false);

const draft = toDraft({
  plant: "JSW SMS4", converter: "1", campaign: 2, heat: "2083", meas_no: 20, date: "2026-09-24", time: "17:00:07", steel_level_m: 8.57, steel_tonnes: 350, bath_level_m: -3.1,
  zones: [{ zone: "Tapside Area-1", avg_mm: 1087, min_mm: 359, angle: "[ 300-60 ]", depth: "[ 0.01-1.8 ] m" }, { zone: "Tapside Area-1", avg_mm: 1, min_mm: 1 }, { zone: "Bad Zone", avg_mm: 100, min_mm: 200 }, { zone: "", avg_mm: 1, min_mm: 1 }],
});
ck("draft: IST timestamp and converter name", draft.scanned_at === "2026-09-24T17:00:07+05:30" && draft.converter_name === "JSW SMS4 Converter 1");
ck("draft: duplicate, unreadable, unknown-zone and min>avg rows are reported", draft.zones.length === 2 && draft.warnings.some((w) => w.includes("appears twice")) && draft.warnings.some((w) => w.includes("could not be read")) && draft.warnings.some((w) => w.includes("not a known zone")) && draft.warnings.some((w) => w.includes("above the average")));
ck("draft: wrong zone count is reported", draft.warnings.some((w) => w.includes("2 zones were read")));
ck("draft: bad date is reported", toDraft({ plant: "P", converter: "1", campaign: 1, heat: "1", meas_no: 1, date: "24/09/2026", time: "x", zones: [] }).warnings[0].includes("date"));

const m = buildMail({ converter: "JSW SMS4 Converter 1", heat: "2886", measNo: 25, scannedAt: "01 Nov 2026", link: "https://x/furnace/scans/1", severity: "critical", findings: [{ zone: "Right <Trunion>-1", section: "Trunnion", avg_mm: 951, min_mm: 108, status: "critical", evaluated: c }] });
ck("mail: subject and escaped content", m.subject === "Critical: JSW SMS4 Converter 1, heat 2886 (measurement 25)" && m.html.includes("Right &lt;Trunion&gt;-1") && m.html.includes("Repair now"));

const p = parseLimitRows([["Zone", "Metric", "Warning below", "Critical below", "rw", "rc"], ["*", "Minimum", 400, 150, "Gun it", "Repair"], ["Tapside", "Average", "900 mm", "", "", ""], ["", "", "", "", "", ""], ["ChargePad", "Min", 100, 200, "", ""], ["X", "Width", 1, 1, "", ""], ["Y", "Minimum", "", "", "", ""]]);
ck("limits sheet: good rows parsed, header and blank rows skipped", p.rows.length === 2 && p.rows[0].zone === "*" && p.rows[0].rec_critical === "Repair" && p.rows[1].warn_below === 900 && p.rows[1].critical_below === null);
ck("limits sheet: critical above warning, unknown metric and empty levels are reported", p.problems.length === 3, JSON.stringify(p.problems));

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
