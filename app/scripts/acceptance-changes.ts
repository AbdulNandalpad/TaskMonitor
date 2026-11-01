/* Acceptance for the 1 Nov change requests (docs/changes/2026-11-01-client-requests.md): CR-1 to CR-5.
   Run from app/ with `npm run dev` up and the migrations 0002 and 0003 applied: npx tsx scripts/acceptance-changes.ts
   Runs as ravi.k (field user) and anil.v (manager in bf1) with the seed password; sunita.m is not needed.
   Creates two tasks named "CR-ACCEPT ..." through the app so they are easy to find and clean up. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

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

async function sb(login: string) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const r = await c.auth.signInWithPassword({ email: `${login}@users.taskmonitor.local`, password: PW });
  if (r.error) throw new Error(`${login}: ${r.error.message}`);
  return { c, id: r.data.user!.id };
}
async function appLogin(login: string) {
  const res = await fetch(`${APP}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, password: PW }) });
  return { j: await res.json(), jar: res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") };
}
const post = async (p: string, jar: string, body: unknown) => {
  const r = await fetch(APP + p, { method: "POST", headers: { cookie: jar, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, j: await r.json().catch(() => ({})) };
};
const page = async (p: string, jar: string) => (await (await fetch(APP + p, { headers: { cookie: jar } })).text()).replace(/<!-- -->/g, "");

async function main() {
  const ravi = await sb("ravi.k"), anil = await sb("anil.v");
  await ravi.c.from("profiles").update({ must_change_password: false }).eq("id", ravi.id); // pages need it off; restored below
  try {
    const rj = (await appLogin("ravi.k")).jar, aj = (await appLogin("anil.v")).jar;
    const { data: area } = await anil.c.from("area").select("id").eq("code", "bf1").single();
    const { data: list } = await anil.c.from("task_list").select("id").eq("area_id", area.id).limit(1).single();
    const { data: sec } = await anil.c.from("section").select("id").eq("task_list_id", list.id).order("position").limit(1).single();
    const mk = async (name: string) => (await post("/api/tasks", aj, { list_id: list.id, section_id: sec.id, responsible_person_id: null, values: { work_description: name, planned_hours: 1, manpower: 1, vendor: "", photo_on_completion: false } })).j.id as string;
    const T1 = await mk("CR-ACCEPT forward-only status"), T2 = await mk("CR-ACCEPT remarks");
    const state = async (id: string) => (await ravi.c.from("task").select("status, progress").eq("id", id).single()).data;
    const upd = (id: string, b: object) => post(`/api/tasks/${id}/update`, rj, b);

    // CR-3 forward only
    const s1 = await upd(T1, { type: "status", status: "in_progress", text: "x" });
    const back = await upd(T1, { type: "status", status: "not_started", text: "x" });
    const st1 = await state(T1);
    check("CR-3a in progress, then not started is refused and unchanged", s1.status === 200 && back.status === 409 && st1.status === "in_progress", `${back.status} ${back.j.error} ${JSON.stringify(st1)}`);
    await upd(T1, { type: "progress", progress: 60, text: "x" });
    const down = await upd(T1, { type: "progress", progress: 40, text: "x" });
    const zero = await upd(T1, { type: "progress", progress: 0, text: "x" });
    check("CR-3c progress 60 then 40 (and 0) is refused", down.status === 409 && zero.status === 409 && (await state(T1)).progress === 60, `${down.status} ${down.j.error} / ${zero.status} ${zero.j.error}`);
    const same = await upd(T1, { type: "status", status: "in_progress", text: "x" });
    check("CR-3  same status again is not an error", same.status === 200 && (await state(T1)).progress === 60, String(same.status));
    const fin = await upd(T1, { type: "status", status: "completed", text: "x" });
    const reopen = await upd(T1, { type: "status", status: "in_progress", text: "x" });
    const lower = await upd(T1, { type: "progress", progress: 40, text: "x" });
    const noteDone = await upd(T1, { type: "note", text: "remark after completion" });
    check("CR-3b completed is final (status and progress refused), a remark is still allowed",
      fin.status === 200 && reopen.status === 409 && lower.status === 409 && noteDone.status === 200 && (await state(T1)).status === "completed", `${reopen.status}/${lower.status}/${noteDone.status}`);
    const html = await page(`/tasks/${T1}`, rj);
    check("CR-3d task screen: earlier status buttons disabled with 'Cannot go back', progress locked", html.includes("Cannot go back") && html.includes("Completed is final"), "");
    const html2 = await page(`/tasks/${T2}`, rj);
    const rangeMin = /type="range"[^>]*min="0"/.test(html2) || /min="0"[^>]*type="range"/.test(html2);
    check("CR-3d slider starts at 0 for a not-started task", rangeMin, "");
    await upd(T2, { type: "progress", progress: 30, text: "x" });
    const html3 = await page(`/tasks/${T2}`, rj);
    check("CR-3d slider minimum is the current progress once in progress", /min="30"/.test(html3), "");

    // CR-4 typed remark
    const before = await state(T2);
    const empty = await upd(T2, { type: "note", text: "   " });
    const note = await upd(T2, { type: "note", text: "Scaffold ready on level 2, waiting for permit" });
    const { data: nrow } = await ravi.c.from("task_update").select("type, text, by_user").eq("id", note.j.updateId).single();
    const after = await state(T2);
    const t2html = await page(`/tasks/${T2}`, rj);
    const firstUpd = t2html.indexOf("Scaffold ready on level 2");
    check("CR-4 typed remark saves as a note, status and progress unchanged, shows in the timeline",
      empty.status === 400 && empty.j.error === "Type a remark first." && note.status === 200 && nrow.type === "note" && nrow.by_user === ravi.id
      && JSON.stringify(before) === JSON.stringify(after) && firstUpd > 0 && t2html.includes("Add remark"), `${empty.status} ${empty.j.error}`);
    const { error: meenaErr } = await (async () => { const m = await sb("meena.r"); return m.c.rpc("task_record_update", { p_task: T2, p_type: "note", p_text: "intruder" }); })();
    check("CR-4 a user outside the area cannot add a remark", !!meenaErr, meenaErr?.message ?? "");
    skip("CR-4 viewer cannot add a remark", "no viewer account is seeded; covered by the role check in task_record_update (tested on a local database)");

    // CR-5 correct a remark
    const wrong = await upd(T2, { type: "note", text: "wrng remark" });
    const fix = await post(`/api/updates/${wrong.j.updateId}/correct`, rj, { text: "wrong remark, corrected" });
    const { data: crow } = await ravi.c.from("task_update").select("text, text_original, edit_count, edited_by").eq("id", wrong.j.updateId).single();
    const chtml = await page(`/tasks/${T2}`, rj);
    check("CR-5 author corrects own remark: new text shown, original kept, edit_count 1, 'edited' chip",
      fix.status === 200 && crow.text === "wrong remark, corrected" && crow.text_original === "wrng remark" && crow.edit_count === 1 && crow.edited_by === ravi.id
      && chtml.includes("wrong remark, corrected") && chtml.includes("edited"), JSON.stringify(crow));
    const mgr = await post(`/api/updates/${wrong.j.updateId}/correct`, aj, { text: "manager wording" });
    const { data: crow2 } = await ravi.c.from("task_update").select("text, text_original, edit_count").eq("id", wrong.j.updateId).single();
    check("CR-5 a manager can correct it; the first original stays", mgr.status === 200 && crow2.text === "manager wording" && crow2.text_original === "wrng remark" && crow2.edit_count === 2, JSON.stringify(crow2));
    const m = await sb("meena.r");
    const { error: mErr } = await m.c.rpc("task_update_correct", { p_update: wrong.j.updateId, p_text: "hacked" });
    check("CR-5 a user outside the area is refused", !!mErr, mErr?.message ?? "");
    const blank = await post(`/api/updates/${wrong.j.updateId}/correct`, rj, { text: "  " });
    check("CR-5 blank text is refused", blank.status === 400, blank.j.error ?? "");
    const progEntry = (await ravi.c.from("task_update").select("id").eq("task_id", T2).eq("type", "progress").limit(1).single()).data;
    const nonRemark = await post(`/api/updates/${progEntry.id}/correct`, rj, { text: "x" });
    check("CR-5 a progress entry cannot be corrected", nonRemark.status === 400, nonRemark.j.error ?? "");
    const direct = await ravi.c.from("task_update").update({ text: "direct" }).eq("id", wrong.j.updateId).select();
    check("CR-5 the browser role has no direct update right", !!direct.error || (direct.data ?? []).length === 0, direct.error?.message ?? "no rows changed");
    skip("CR-5 another field user / viewer refused", "no second field user or viewer is seeded; covered by task_update_correct's role rule (tested on a local database)");

    // CR-1 / CR-2 static proofs (the voice sheet needs a microphone; the AI path needs keys)
    const voice = fs.readFileSync("src/components/VoiceSheet.tsx", "utf8");
    check("CR-1 the voice sheet never uploads audio or writes an audio attachment", !voice.includes("uploadAttachment") && !voice.includes(`kind: "audio"`), "");
    const { count: audioCount } = await ravi.c.from("attachment").select("id", { count: "exact", head: true }).eq("kind", "audio").gte("created_at", new Date(Date.now() - 20 * 60_000).toISOString());
    const v = await upd(T2, { type: "voice", status: "in_progress", progress: 50, text: "Work is half done, four people", extracted: { original_transcript: "kaam aadha ho gaya, chaar log", language: "hi" }, confirmed: { status: "in_progress", progress: 50, manpower: 4, remarks: "" } });
    const { count: audioAfter } = await ravi.c.from("attachment").select("id", { count: "exact", head: true }).eq("kind", "audio").gte("created_at", new Date(Date.now() - 20 * 60_000).toISOString());
    const vhtml = await page(`/tasks/${T2}`, rj);
    check("CR-1/2 a voice update stores the English text, keeps the original and language, and adds no audio attachment",
      v.status === 200 && audioAfter === audioCount && vhtml.includes("Spoken in Hindi") && vhtml.includes("kaam aadha ho gaya"), `audio rows ${audioCount} -> ${audioAfter}`);
    skip("CR-2 live Kannada/Hindi regression", "needs OPENAI_API_KEY and ANTHROPIC_API_KEY in app/.env.local: npx tsx scripts/ai-live-test.ts (extraction path covered by scripts/ai-mock-test.ts)");
  } finally {
    await ravi.c.from("profiles").update({ must_change_password: true }).eq("id", ravi.id);
    console.log("must_change_password restored to true for ravi.k");
  }
  const failed = results.filter((x) => !x[1]);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
