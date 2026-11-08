/* Platform layer acceptance (migration 0007), against the live project. Run from app/ with the app up:
   APP=http://localhost:3100 npx tsx scripts/acceptance-platform.ts
   Needs: 0007 applied and one platform admin (default anil.v):  insert into platform_admin select id from profiles where login = 'anil.v';
   Uses the seeded users and the seed password; it restores every grant and flag it changes. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const appRequire = createRequire(path.resolve(process.cwd(), "package.json"));
const { createClient } = appRequire("@supabase/supabase-js");
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line); if (m) process.env[m[1]] = m[2]; }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP = process.env.APP ?? "http://localhost:3000";
const ADMIN = process.env.ADMIN_LOGIN ?? "anil.v";
const PW = "ChangeMe-2026!";
let failed = 0;
const check = (n: string, ok: boolean, d = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}  ${d}`); };

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
const get = async (p: string, jar: string) => { const r = await fetch(APP + p, { headers: { cookie: jar }, redirect: "manual" }); return { status: r.status, text: await r.text(), loc: r.headers.get("location") }; };
const post = async (p: string, jar: string, body: unknown) => { const r = await fetch(APP + p, { method: "POST", headers: { cookie: jar, "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, j: await r.json().catch(() => ({})) }; };

async function main() {
  const admin = await sb(ADMIN), ravi = await sb("ravi.k");
  const flagged = [admin, ravi];
  for (const s of flagged) await s.c.from("profiles").update({ must_change_password: false }).eq("id", s.id);
  const grants: (() => Promise<unknown>)[] = [];
  try {
    const isAdmin = (await admin.c.rpc("is_platform_admin")).data === true;
    check("0 migration applied and admin present", isAdmin, isAdmin ? "" : `insert ${ADMIN} into platform_admin first`);
    if (!isAdmin) return;

    const mine = (await ravi.c.rpc("my_apps")).data as { code: string }[];
    check("1 ravi.k has Task Monitor only", mine.map((a) => a.code).join() === "task_monitor", JSON.stringify(mine.map((a) => a.code)));
    const rl = await appLogin("ravi.k");
    check("2 single-app user logs in straight to the app", rl.j.ok && rl.j.next === "/", JSON.stringify(rl.j));
    const ln = await get("/launch", rl.jar);
    check("3 /launch redirects a single-app user into the app", ln.status >= 300 && ln.status < 400 && new globalThis.URL(ln.loc!, APP).pathname === "/", `${ln.status} ${ln.loc}`);
    const fu = await get("/furnace", rl.jar);
    check("4 /furnace without the app goes back to /launch", fu.status >= 300 && fu.status < 400 && (fu.loc ?? "").includes("/launch"), `${fu.status} ${fu.loc}`);
    const ad = await get("/admin/access", rl.jar);
    check("5 admin screen refuses a non-admin", ad.status >= 300 && ad.status < 400, `${ad.status} ${ad.loc}`);
    const np = await post("/api/admin/access", rl.jar, { login: "meena.r", app: "furnace_analysis", on: true });
    check("6 non-admin cannot change access", np.status === 403, `${np.status}`);

    // admin grants Furnace Analysis to ravi.k
    const al = await appLogin(ADMIN);
    grants.push(async () => (await admin.c.rpc("app_access_set", { p_login: "ravi.k", p_app: "furnace_analysis", p_on: false })));
    const g = await post("/api/admin/access", al.jar, { login: "ravi.k", app: "furnace_analysis", on: true });
    check("7 admin grants Furnace Analysis", g.status === 200, JSON.stringify(g.j));
    const page = await get("/admin/access", al.jar);
    check("8 admin screen lists users and apps", page.status === 200 && page.text.includes("Who can open which app") && page.text.includes("ravi.k"));

    const enabled = ((await ravi.c.rpc("my_apps")).data as { code: string }[]).some((a) => a.code === "furnace_analysis");
    if (!enabled) console.log("SKIPPED  9-11 chooser checks: furnace_analysis is switched off (update app set enabled = true where code = 'furnace_analysis')");
    else {
      const r2 = await appLogin("ravi.k");
      check("9 two-app user lands on the chooser", r2.j.ok && r2.j.next === "/apps", JSON.stringify(r2.j));
      const ch = await get("/apps", r2.jar);
      check("10 chooser shows both apps", ch.status === 200 && ch.text.includes("Task Monitor") && ch.text.includes("Furnace Analysis"));
      const fh = await get("/furnace", r2.jar);
      check("11 Furnace Analysis opens for the user who has it", fh.status === 200 && fh.text.includes("Furnace Analysis"));
    }

    // revoking Task Monitor shuts its data at the database and the login
    grants.push(async () => (await admin.c.rpc("app_access_set", { p_login: "ravi.k", p_app: "task_monitor", p_on: true })));
    await admin.c.rpc("app_access_set", { p_login: "ravi.k", p_app: "task_monitor", p_on: false });
    const rows = await ravi.c.from("task").select("id", { count: "exact", head: true });
    check("12 without Task Monitor the database returns no tasks", (rows.count ?? 0) === 0, `${rows.count}`);
    const tm = await get("/tasks", (await appLogin("ravi.k")).jar || "");
    check("13 Task Monitor pages are closed to that user", tm.status >= 300 && tm.status < 400, `${tm.status} ${tm.loc}`);
    await admin.c.rpc("app_access_set", { p_login: "ravi.k", p_app: "furnace_analysis", p_on: false });
    const none = await appLogin("ravi.k");
    check("14 a user with no app is refused at sign-in", none.j.noApp === true, JSON.stringify(none.j));
  } finally {
    for (const undo of grants.reverse()) await undo();
    for (const s of flagged) await s.c.from("profiles").update({ must_change_password: true }).eq("id", s.id);
    const back = ((await ravi.c.rpc("my_apps")).data ?? []) as { code: string }[];
    if (back.length) check("restore: ravi.k back to Task Monitor only", back.map((a) => a.code).join() === "task_monitor", JSON.stringify(back.map((a) => a.code)));
  }
  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
