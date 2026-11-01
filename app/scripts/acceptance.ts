/* Acceptance run against the live project (section 8). Run from app/ with `npm run dev` up: npx tsx scripts/acceptance.ts */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import * as XLSX from "xlsx";
import { extract } from "../src/lib/voice/extract";
import { readWorkbook, parseRows, guessTaskField } from "../src/lib/excel";

const appRequire = createRequire(path.resolve(process.cwd(), "package.json"));
const { createClient } = appRequire("@supabase/supabase-js");
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP = process.env.APP ?? "http://localhost:3000";
const PW = "ChangeMe-2026!";
const results: [string, boolean, string][] = [];
const check = (n: string, ok: boolean, d = "") => { results.push([n, ok, d]); console.log(`${ok ? "PASS" : "FAIL"}  ${n}  ${d}`); };

async function sb(login: string) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const r = await c.auth.signInWithPassword({ email: `${login}@users.taskmonitor.local`, password: PW });
  if (r.error) throw new Error(`${login}: ${r.error.message}`);
  return { c, id: r.data.user!.id };
}
async function appLogin(login: string) {
  const res = await fetch(`${APP}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password: PW }) });
  const j = await res.json();
  const jar = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { j, jar };
}
const get = async (p: string, jar: string) => { const r = await fetch(APP + p, { headers: { cookie: jar }, redirect: "manual" }); return { status: r.status, text: (await r.text()).replace(/<!-- -->/g, ""), loc: r.headers.get("location") }; };
const post = async (p: string, jar: string, body: unknown) => { const r = await fetch(APP + p, { method: "POST", headers: { cookie: jar, "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };

async function main() {
  const users = ["sunita.m", "ravi.k", "anil.v"];
  const flagged: Record<string, any> = {};
  for (const u of users) { const s = await sb(u); flagged[u] = s; await s.c.from("profiles").update({ must_change_password: false }).eq("id", s.id); }
  try {
    // 1 scope refusal
    const meena = await appLogin("meena.r");
    check("1 meena.r refused with scope", meena.j.scope === true, JSON.stringify(meena.j));
    const { data: audit } = await flagged["sunita.m"].c.from("audit_log").select("action, detail").eq("action", "login_refused_scope");
    check("1 audit_log row login_refused_scope", (audit ?? []).length >= 1, `${(audit ?? []).length} rows`);
    const lp = await get("/login?reason=scope&name=Meena%20R.", "");
    check("1 login page shows scope message", lp.text.includes("is not scoped to") && lp.text.includes("Blast Furnace 1"));

    // 2 anil -> picker
    const anil = await appLogin("anil.v");
    check("2 anil.v next=/areas", anil.j.next === "/areas", JSON.stringify(anil.j));
    const ap = await get("/areas", anil.jar);
    check("2 area picker lists two areas", ap.text.includes("Blast Furnace 1") && ap.text.includes("Sinter Plant 1"));

    // 3 sunita / ravi
    const sun = await appLogin("sunita.m");
    const sd = await get("/", sun.jar);
    check("3 sunita dashboard + menu", sun.j.next === "/" && sd.text.includes("/tasks/new") && sd.text.includes("PDF report"));
    const rav = await appLogin("ravi.k");
    const rd = await get("/", rav.jar);
    check("3 ravi dashboard My tasks, no menu", rd.text.includes("My tasks") && !rd.text.includes("/tasks/new"));

    const board = await flagged["sunita.m"].c.from("task_list").select("id, area_id").limit(1);
    const listId = board.data[0].id, bf1 = board.data[0].area_id;
    const { data: secs } = await flagged["sunita.m"].c.from("section").select("id, name").eq("task_list_id", listId).order("position");
    const { data: people } = await flagged["sunita.m"].c.from("person").select("id, name").eq("area_id", bf1);

    // 4 create task
    const cr = await post("/api/tasks", sun.jar, { list_id: listId, section_id: secs[5].id, responsible_person_id: null, values: { work_description: "ACCEPT-4 head pulley bearing replacement", planned_hours: 8, manpower: 6, vendor: "", photo_on_completion: true } });
    const tid = cr.j.id;
    const { data: t4 } = await flagged["sunita.m"].c.from("task_current").select("*").eq("id", tid).single();
    const sec = await get(`/sections/${secs[5].id}`, sun.jar);
    check("4 create task: not_started, version 1, listed in section", t4?.status === "not_started" && t4?.version === 1 && sec.text.includes("ACCEPT-4"), JSON.stringify({ status: t4?.status, v: t4?.version }));

    // 5 edit
    const ed = await post(`/api/tasks/${tid}/edit`, sun.jar, { values: { ...t4.values, planned_hours: 12, vendor: "Vendor team A" }, section_id: t4.section_id, responsible_person_id: null, source: "app_edit" });
    const { data: fc } = await flagged["sunita.m"].c.from("task_field_change").select("field_key, old_value, new_value").eq("task_id", tid);
    const tp = await get(`/tasks/${tid}`, sun.jar);
    check("5 edit -> v2, two field changes, history shows old -> new", ed.j.version === 2 && ed.j.changed === 2 && fc.length === 2 && tp.text.includes("Version 2") && tp.text.includes("Vendor team A"), JSON.stringify({ ed: ed.j, fc }));
    const noEdit = await post(`/api/tasks/${tid}/edit`, rav.jar, { values: { ...t4.values, vendor: "X" }, section_id: t4.section_id, responsible_person_id: null, source: "app_edit" });
    check("5b field user cannot edit (403)", noEdit.status === 403, String(noEdit.status));

    // 6 import
    const seed = JSON.parse(fs.readFileSync("../supabase/seed/seed-data.json", "utf8"));
    const rows: (string | number)[][] = [["S.NO", "Area", "Work Description", "Shutdown Duration (Hrs.)", "Manpower Required", "Vendor", "Responsible Person", "Compliance Description", "Status", "Remarks", "Compliance %"]];
    const pick = seed.tasks.slice(0, 10);
    pick.forEach((t: any, i: number) => rows.push([i + 1, i === 0 || i === 5 ? seed.sections[t.section].name : "", `TEST ${t.work_description}`, i === 0 ? "4 hrs" : i === 1 ? "08 hrs" : i === 2 ? "6 hra" : t.planned_hours, t.manpower, t.vendor, i % 3 === 0 ? t.responsible ?? "" : "", "", i === 3 ? "In progress" : "", "", i === 3 ? 40 : ""]));
    // section fill-down: rows 1..4 under the first section, 5.. under the second; make section col consistent
    rows[6][1] = seed.sections[pick[5].section].name;
    rows.splice(3, 0, ["", "", "", "", "", "", "", "", "", "", ""]);   // blank
    rows.push(["", "", "", "", "", "", "", "", "", "", ""]);            // blank
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Dec-2025");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    fs.writeFileSync(path.join(process.env.TEMP ?? ".", "acceptance-test.xlsx"), buf);
    const sheet = await readWorkbook(new File([buf], "test.xlsx"));
    const mapping = sheet.headers.map(guessTaskField);
    const parsed = parseRows(sheet.rows, mapping);
    const imp = await post("/api/import/tasks", sun.jar, { tasks: parsed.tasks, skipped: parsed.skipped, filename: "test.xlsx", sheet: sheet.name, mapping });
    const hrs = parsed.tasks.slice(0, 3).map((t) => t.planned_hours);
    check("6 import: 10 created, blank rows skipped, '4 hrs'->4", (imp.j.created === 10 || (imp.j.created === 0 && imp.j.unchanged === 10)) && parsed.skipped === 2 && hrs.join() === "4,8,6", JSON.stringify({ imp: imp.j, skipped: parsed.skipped, hrs }));
    const again = await post("/api/import/tasks", sun.jar, { tasks: parsed.tasks, skipped: parsed.skipped, filename: "test.xlsx", sheet: sheet.name, mapping });
    check("6b re-import matches existing (no duplicates)", again.j.created === 0 && (again.j.updated + again.j.unchanged) === 10, JSON.stringify(again.j));

    // 7 assign
    const { data: before } = await flagged["sunita.m"].c.from("task_current").select("id, version, values, section_id").is("responsible_person_id", null).limit(1).single();
    const target = people.find((p: any) => p.name === "D. Patil");
    const loadBefore = (await flagged["sunita.m"].c.from("task").select("id", { count: "exact", head: true }).eq("responsible_person_id", target.id)).count;
    const as = await post(`/api/tasks/${before.id}/edit`, sun.jar, { values: before.values, section_id: before.section_id, responsible_person_id: target.id, source: "assignment" });
    const loadAfter = (await flagged["sunita.m"].c.from("task").select("id", { count: "exact", head: true }).eq("responsible_person_id", target.id)).count;
    check("7 assign: version increments, load +1", as.j.version === before.version + 1 && loadAfter === (loadBefore ?? 0) + 1, JSON.stringify({ as: as.j, loadBefore, loadAfter }));

    // 8 ravi
    const r = flagged["ravi.k"].c;
    const mineT = await r.from("task_current").select("id, seq, status, progress, values").eq("status", "not_started").limit(1).single();
    const T = mineT.data;
    const s1 = await post(`/api/tasks/${T.id}/update`, rav.jar, { type: "status", status: "in_progress", text: "Status set to In progress." });
    const s2 = await post(`/api/tasks/${T.id}/update`, rav.jar, { type: "progress", progress: 60, text: "Progress set to 60%." });
    const mid = (await r.from("task").select("status, progress").eq("id", T.id).single()).data;
    check("8a in progress 60%", s1.status === 200 && s2.status === 200 && mid.status === "in_progress" && mid.progress === 60, JSON.stringify(mid));
    const ph = await post(`/api/tasks/${T.id}/update`, rav.jar, { type: "photo", text: "Photo added · In progress" });
    const key = `area/${bf1}/task/${T.id}/${ph.j.updateId}/${crypto.randomUUID()}.png`;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const up = await r.storage.from("attachments").upload(key, png, { contentType: "image/png" });
    const at = await r.from("attachment").insert({ area_id: bf1, task_update_id: ph.j.updateId, kind: "photo", object_key: key, sha256: "test", mime: "image/png", bytes: png.length });
    check("8b photo uploaded + attachment row", !up.error && !at.error, JSON.stringify({ up: up.error?.message, at: at.error?.message }));
    const said = "completed, six people";
    const ex = extract(said, { status: "in_progress", progress: 60, manpower: T.values.manpower });
    const confirmed = { status: ex.status, progress: ex.progress, manpower: ex.manpower, remarks: ex.remarks };
    const vo = await post(`/api/tasks/${T.id}/update`, rav.jar, { type: "voice", status: ex.status, progress: ex.progress, text: said, extracted: ex, confirmed });
    const akey = `area/${bf1}/task/${T.id}/${vo.j.updateId}/${crypto.randomUUID()}.webm`;
    const aup = await r.storage.from("attachments").upload(akey, Buffer.from("fake-opus-bytes"), { contentType: "audio/webm" });
    const aat = await r.from("attachment").insert({ area_id: bf1, task_update_id: vo.j.updateId, kind: "audio", object_key: akey, sha256: "test", mime: "audio/webm", bytes: 15 });
    const fin = (await r.from("task").select("status, progress").eq("id", T.id).single()).data;
    const upd = (await r.from("task_update").select("text, extracted, confirmed").eq("id", vo.j.updateId).single()).data;
    check("8c voice 'completed, six people' -> completed; transcript + audio saved", fin.status === "completed" && upd.text === said && upd.confirmed.manpower === 6 && !aup.error && !aat.error, JSON.stringify({ fin, extracted: ex.status + "/" + ex.manpower, aup: aup.error?.message, aat: aat.error?.message }));
    const tpage = await get(`/tasks/${T.id}`, rav.jar);
    check("8d task page shows transcript, audio player, photo", tpage.text.includes("completed, six people") && tpage.text.includes("<audio") && tpage.text.includes("Uploaded photo"));
    const noEditBtn = !/>Edit</.test(tpage.text);
    check("3b ravi sees no Edit button", noEditBtn);

    // 9 report
    const rp = await get(`/report/${listId}`, sun.jar);
    const nPages = (rp.text.match(/Page \d of 3/g) ?? []).length;
    check("9 report renders 3 pages", rp.status === 200 && nPages >= 3, `pages=${nPages}`);
    const total = (await flagged["sunita.m"].c.from("task").select("id", { count: "exact", head: true })).count;
    check("9b report total matches task count", rp.text.includes(`/ ${total}`), `total=${total}`);
    const rpField = await get(`/report/${listId}`, rav.jar);
    check("9c field user cannot open report", rpField.status === 307 || rpField.status === 308 || rpField.status === 302 || rpField.loc !== null, String(rpField.status));

    // 10 RLS
    const an = flagged["anil.v"].c;
    const { data: sp1 } = await an.from("area").select("id").eq("code", "sp1").single();
    const lst = await an.from("task_list").insert({ area_id: sp1.id, name: "SP1 isolation check" }).select("id").single();
    const sc = await an.from("section").insert({ area_id: sp1.id, task_list_id: lst.data.id, name: "SP1 section", position: 1 }).select("id").single();
    const t10 = await an.rpc("task_create", { p_list: lst.data.id, p_section: sc.data.id, p_values: { work_description: "SP1 sample task", planned_hours: 1, manpower: 1, vendor: "" }, p_responsible: null });
    const seen = await r.from("task").select("id").eq("id", t10.data);
    const seenArea = await r.from("task").select("id").eq("area_id", sp1.id);
    const seenView = await r.from("task_current").select("id").eq("area_id", sp1.id);
    const direct = await fetch(`${URL}/rest/v1/task?id=eq.${t10.data}&select=id`, { headers: { apikey: KEY, Authorization: `Bearer ${(await r.auth.getSession()).data.session!.access_token}` } });
    const dj = await direct.json();
    check("10 ravi reads no sp1 rows (RLS)", !!t10.data && seen.data!.length === 0 && seenArea.data!.length === 0 && seenView.data!.length === 0 && dj.length === 0, JSON.stringify({ created: !!t10.data, err: t10.error?.message, seen: seen.data?.length, area: seenArea.data?.length, direct: dj.length }));
    const anon = await fetch(`${URL}/rest/v1/task?select=id`, { headers: { apikey: KEY } });
    check("10b anonymous reads nothing", (await anon.json()).length === 0);
    const w = await r.rpc("task_create", { p_list: listId, p_section: secs[0].id, p_values: { work_description: "nope" }, p_responsible: null });
    check("10c field user cannot call task_create", !!w.error, w.error?.message);
  } finally {
    for (const u of users) await flagged[u].c.from("profiles").update({ must_change_password: true }).eq("id", flagged[u].id);
    console.log("must_change_password restored to true for", users.join(", "));
  }
  const failed = results.filter((x) => !x[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
