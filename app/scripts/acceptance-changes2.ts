/* Acceptance for the second batch of change requests (docs/changes/2026-11-01-client-requests-2.md): CR-6 and CR-7.
   Run from app/ with `npm run dev` up and migrations 0001 to 0005 applied: npx tsx scripts/acceptance-changes2.ts
   Runs as anil.v (manager in bf1) and ravi.k (field user) with the seed password. Renames are restored at the end.
   The model is stubbed (no keys needed) and only ever writes a summary for the test task "CR-ACCEPT detailed". */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as XLSX from "xlsx";

const appRequire = createRequire(path.resolve(process.cwd(), "package.json"));
const { createClient } = appRequire("@supabase/supabase-js");
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP = "http://localhost:3000", PW = "ChangeMe-2026!";
const results: [string, boolean, string][] = [];
const check = (n: string, ok: boolean, d = "") => { results.push([n, ok, d]); console.log(`${ok ? "PASS" : "FAIL"}  ${n}  ${d}`); };
const skip = (n: string, why: string) => console.log(`SKIP  ${n}  ${why}`);

// stub the hosted model only; every other request goes through
const realFetch = globalThis.fetch;
let modelCalls = 0;
const modelBodies: string[] = [];
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).includes("api.anthropic.com")) {
    modelCalls++; modelBodies.push(String(init?.body ?? ""));
    return new Response(JSON.stringify({ usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "tool_use", name: "write_summary", input: { summary: "Stub summary written from the evidence." } }] }), { status: 200 });
  }
  return realFetch(url, init);
}) as typeof fetch;

async function sb(login: string) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const r = await c.auth.signInWithPassword({ email: `${login}@users.taskmonitor.local`, password: PW });
  if (r.error) throw new Error(`${login}: ${r.error.message}`);
  return { c, id: r.data.user!.id };
}
async function appLogin(login: string, areaId: string) {
  const res = await realFetch(`${APP}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password: PW }) });
  await res.json();
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") + `; tm_area=${areaId}`;
}
const post = async (p: string, jar: string, body: unknown) => {
  const r = await realFetch(APP + p, { method: "POST", headers: { cookie: jar, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const page = async (p: string, jar: string) => { const r = await realFetch(APP + p, { headers: { cookie: jar }, redirect: "manual" }); return { status: r.status, text: (await r.text()).replace(/<!-- -->/g, "") }; };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function main() {
  const { loadDetailed, fmtDuration } = await import("../src/lib/report/detailed");
  const { fillSummaries } = await import("../src/lib/report/summaries");
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "stub-key"; // only the stubbed fetch sees it

  const anil = await sb("anil.v"), ravi = await sb("ravi.k");
  const { data: area } = await anil.c.from("area").select("id, name").eq("code", "bf1").single();
  await anil.c.from("profiles").update({ must_change_password: false }).eq("id", anil.id);
  await ravi.c.from("profiles").update({ must_change_password: false }).eq("id", ravi.id);
  const restore: (() => Promise<unknown>)[] = [];
  try {
    const aj = await appLogin("anil.v", area.id), rj = await appLogin("ravi.k", area.id);
    const { data: list } = await anil.c.from("task_list").select("id, name, planned_hours").eq("area_id", area.id).limit(1).single();
    const { data: secs } = await anil.c.from("section").select("id, name, head_person_id").eq("task_list_id", list.id).order("position");
    const sec = secs[0];
    const { data: ravP } = await anil.c.from("person").select("id, name").eq("area_id", area.id).eq("name", "Ravi Kumar").single();
    const auditFor = async (id: string, action: string) =>
      ((await anil.c.from("audit_log").select("detail, user_id").eq("target_id", id).eq("action", action).order("id", { ascending: false })).data ?? []);

    // ---- CR-6
    const newList = "BF1 shutdown (CR-ACCEPT rename)";
    restore.push(() => post(`/api/edit/list/${list.id}`, aj, { name: list.name, planned_hours: list.planned_hours }));
    const r1 = await post(`/api/edit/list/${list.id}`, aj, { name: newList, planned_hours: 81 });
    const aud1 = await auditFor(list.id, "task_list_renamed");
    const dash = await page("/", aj), rep = await page(`/report/${list.id}`, aj);
    check("CR-6 manager renames the task list: shown on dashboard and report, audit row with old and new",
      r1.status === 200 && dash.text.includes(newList) && rep.text.includes(newList) && aud1.some((a: any) => a.detail.field === "name" && a.detail.old === list.name && a.detail.new === newList)
      && aud1.some((a: any) => a.detail.field === "planned_hours" && a.detail.new === 81), `${r1.status}`);

    const newSec = "Tuyere Platform (CR-ACCEPT rename)";
    restore.push(() => post(`/api/edit/section/${sec.id}`, aj, { name: sec.name, head_person_id: sec.head_person_id }));
    const r2 = await post(`/api/edit/section/${sec.id}`, aj, { name: newSec });
    const { data: aTask } = await anil.c.from("task_current").select("id").eq("section_id", sec.id).limit(1).single();
    const [d2, s2, t2, p2] = await Promise.all([page("/", aj), page(`/sections/${sec.id}`, aj), page(`/tasks/${aTask.id}`, aj), page(`/report/${list.id}`, aj)]);
    const aud2 = await auditFor(sec.id, "section_renamed");
    check("CR-6 renaming a section shows at once on dashboard, section, task and report; audit row",
      r2.status === 200 && [d2, s2, t2, p2].every((x) => x.text.includes(newSec)) && aud2.some((a: any) => a.detail.old === sec.name && a.detail.new === newSec), `${r2.status}`);

    const newPer = "Ravi Kumar (CR-ACCEPT)";
    restore.push(() => post(`/api/edit/person/${ravP.id}`, aj, { name: ravP.name }));
    const r3 = await post(`/api/edit/person/${ravP.id}`, aj, { name: newPer, phone: "+91 99999 00000" });
    const [w3, p3] = await Promise.all([page("/workforce", aj), page(`/report/${list.id}`, aj)]);
    const aud3 = await auditFor(ravP.id, "person_edited");
    check("CR-6 editing a person shows on workforce and report; audit rows per column",
      r3.status === 200 && w3.text.includes(newPer) && p3.text.includes(newPer) && aud3.some((a: any) => a.detail.field === "name" && a.detail.new === newPer) && aud3.some((a: any) => a.detail.field === "phone"), `${r3.status}`);

    const r4 = await post(`/api/edit/area/${area.id}`, aj, { name: "Hijacked area" });
    const { data: areaNow } = await anil.c.from("area").select("name").eq("id", area.id).single();
    check("CR-6 a manager cannot rename the area (area admin only)", r4.status === 403 && areaNow.name === area.name, `${r4.status}`);
    skip("CR-6 area admin renames the area", "no area admin is seeded and sunita.m cannot sign in; covered by the local database test of 0004");

    const f1 = await post(`/api/edit/list/${list.id}`, rj, { name: "hack" });
    const f2 = await post(`/api/edit/section/${sec.id}`, rj, { name: "hack" });
    const f3 = await post(`/api/edit/person/${ravP.id}`, rj, { name: "hack" });
    const direct = await ravi.c.from("task_list").update({ name: "hack" }).eq("id", list.id).select("id");
    const rd = await page("/", rj);
    check("CR-6 a field user is refused on every edit, a direct update changes nothing, and sees no pencil icons",
      [f1, f2, f3].every((x) => x.status === 403) && (direct.data ?? []).length === 0 && !rd.text.includes("Edit task list") && dash.text.includes("Edit task list"),
      `${f1.status}/${f2.status}/${f3.status} direct=${(direct.data ?? []).length}`);
    const blank = await post(`/api/edit/section/${sec.id}`, aj, { name: "   " });
    check("CR-6 a blank name is refused", blank.status === 400, blank.j.error ?? "");
    await Promise.all(restore.splice(0).map((f) => f()));
    const back = await page("/", aj);
    check("CR-6 names restored", back.text.includes(list.name) && !back.text.includes("CR-ACCEPT rename"), "");

    // ---- CR-7
    const mk = async (name: string, photoRule: boolean) => (await post("/api/tasks", aj, { list_id: list.id, section_id: sec.id, responsible_person_id: null, values: { work_description: name, planned_hours: 2, manpower: 3, vendor: "", photo_on_completion: photoRule } })).j.id as string;
    const T3 = await mk("CR-ACCEPT detailed GB 05A belt hot joint", false), T4 = await mk("CR-ACCEPT detailed completion photo rule", true);
    const up = (id: string, b: object) => post(`/api/tasks/${id}/update`, aj, b);
    await up(T3, { type: "status", status: "in_progress", text: "Started" });
    await up(T3, { type: "note", text: "GB 05A belt hot joint finished with two fitters, no leakage" });
    const ph = await up(T3, { type: "photo", text: "Photo added" });
    const key = `area/${area.id}/task/${T3}/${ph.j.updateId}/${crypto.randomUUID()}.png`;
    await anil.c.storage.from("attachments").upload(key, PNG, { contentType: "image/png" });
    await anil.c.from("attachment").insert({ area_id: area.id, task_update_id: ph.j.updateId, kind: "photo", object_key: key, sha256: "test", mime: "image/png", bytes: PNG.length, label: "after" });
    await up(T3, { type: "status", status: "completed", text: "Completed" });
    await up(T4, { type: "status", status: "in_progress", text: "Started" });

    const data = (await loadDetailed(anil.c, area.id, list.id, { signUrls: true }))!;
    const b3 = data.blocks.find((b) => b.id === T3)!, b4 = data.blocks.find((b) => b.id === T4)!;
    const started = data.blocks.filter((b) => b.status !== "not_started"), done = data.blocks.filter((b) => b.status === "completed");
    check("CR-7 every started task has a start time; every completed task an end time and a duration",
      started.every((b) => b.start) && done.every((b) => b.end && b.durationMin !== null) && data.blocks.filter((b) => b.status === "not_started").every((b) => !b.start && !b.end),
      `${started.length} started, ${done.length} completed of ${data.blocks.length}`);
    check("CR-7 the test task shows start, end, duration and its photo with label", !!b3.start && !!b3.end && b3.durationMin !== null && b3.photos.length === 1 && b3.photos[0].label === "after" && !!b3.photos[0].url, `${fmtDuration(b3.durationMin)}`);
    check("CR-7 a task with the completion-photo rule and no photo is flagged", b4.noCompletionPhoto && !b3.noCompletionPhoto, "");

    const dpage = await page(`/report/${list.id}/detailed`, aj);
    const rdpage = await page(`/report/${list.id}/detailed`, rj);
    check("CR-7 the detailed report page renders sections, the test task, its photo and the 'No completion photo' note; field users are redirected",
      dpage.status === 200 && dpage.text.includes("Detailed Task Report") && dpage.text.includes("CR-ACCEPT detailed GB 05A belt hot joint") && dpage.text.includes("No completion photo")
      && dpage.text.includes("<img") && data.sections.every((s) => dpage.text.includes(String(s.name).replace(/&/g, "&amp;"))) && rdpage.status >= 300 && rdpage.status < 400, `${dpage.status}/${rdpage.status}`);

    const x = await realFetch(`${APP}/api/report/${list.id}/export`, { headers: { cookie: aj } });
    const wb = XLSX.read(Buffer.from(await x.arrayBuffer()), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    const xr = await realFetch(`${APP}/api/report/${list.id}/export`, { headers: { cookie: rj } });
    check("CR-7 Excel export has one row per task with the agreed columns; field users are refused",
      x.status === 200 && rows.length === data.blocks.length && ["Section", "Work description", "Start", "End", "Duration", "Planned hours", "Status", "Progress %", "Summary", "Photo count"].every((c) => c in rows[0]) && xr.status === 403, `${rows.length} rows, ${xr.status}`);

    // caching: the model is called once per changed evidence, never twice for the same
    modelCalls = 0; modelBodies.length = 0;
    const g1 = await fillSummaries(anil.c, area.id, list.id, { only: [T3] });
    const callsFirst = modelCalls;
    const g2 = await fillSummaries(anil.c, area.id, list.id, { only: [T3] });
    check("CR-7 first generation calls the model once, a second generation with unchanged evidence makes no model call",
      callsFirst === 1 && g1!.generated === 1 && modelCalls === 1 && g2!.generated === 0 && g2!.pending === 0, `calls ${callsFirst} then ${modelCalls - callsFirst}`);
    check("CR-7 the task's remark and photo record are in the evidence sent to the model, nothing from other tasks",
      modelBodies[0].includes("GB 05A belt hot joint finished with two fitters") && modelBodies[0].includes("after") && !modelBodies[0].includes("completion photo rule"), "");
    await up(T3, { type: "note", text: "Follow-up: grease points checked next shift" });
    const before = modelCalls;
    const g3 = await fillSummaries(anil.c, area.id, list.id, { only: [T3] });
    const g4 = await fillSummaries(anil.c, area.id, list.id, { only: [T3] });
    check("CR-7 new evidence regenerates exactly that task's summary, then it is cached again", g3!.generated === 1 && modelCalls === before + 1 && g4!.generated === 0, `${modelCalls - before} call`);
    const after = (await loadDetailed(anil.c, area.id, list.id, { signUrls: true }))!;
    const rendered = await page(`/report/${list.id}/detailed`, aj);
    check("CR-7 the stored summary appears under the task in the report", after.blocks.find((b) => b.id === T3)!.summary === "Stub summary written from the evidence." && rendered.text.includes("Stub summary written from the evidence."), "");

    const s503 = await post(`/api/report/${list.id}/summaries`, aj, { limit: 3 });
    const sForbidden = await post(`/api/report/${list.id}/summaries`, rj, {});
    check("CR-7 the summaries route needs a manager, and says so clearly when the AI key is not configured",
      sForbidden.status === 403 && (process.env.ANTHROPIC_API_KEY !== "stub-key" ? true : s503.status === 503 && s503.j.pending > 0), `${sForbidden.status}, no key -> ${s503.status}`);
    check("CR-7 the dashboard offers Generate with two choices to managers only",
      dash.text.includes("Generate report") && !rd.text.includes("Generate report"), "");
    skip("CR-7 live AI summaries for the seeded list (GB 05A belt remarks reflected in the real model's text)", "needs ANTHROPIC_API_KEY on the server; run Generate on the dashboard after adding it");
  } finally {
    await Promise.all(restore.splice(0).map((f) => f().catch(() => null)));
    await anil.c.from("profiles").update({ must_change_password: true }).eq("id", anil.id);
    await ravi.c.from("profiles").update({ must_change_password: true }).eq("id", ravi.id);
    console.log("must_change_password restored to true for anil.v and ravi.k");
  }
  const failed = results.filter((x) => !x[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
