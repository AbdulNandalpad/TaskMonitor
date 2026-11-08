/* Seed: organisation, plant, areas bf1 + sp1, four users, 12 workforce people, form, sections, 99 tasks.
   Run from app/:  npm run seed    (uses SUPABASE_SERVICE_ROLE_KEY from app/.env.local, never shipped to the browser) */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const appRequire = createRequire(path.resolve(process.cwd(), "package.json"));
const { createClient } = appRequire("@supabase/supabase-js");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in app/.env.local");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, "seed-data.json"), "utf8"));
const PASSWORD = "ChangeMe-2026!";
const must = <T>(r: { data: T | null; error: any }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
};

async function ensureUser(login: string, displayName: string): Promise<string> {
  const email = `${login}@users.taskmonitor.local`;
  const created = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  let id: string | undefined = created.data?.user?.id;
  if (!id) {
    for (let page = 1; page < 20 && !id; page++) {
      const { data: l } = await db.auth.admin.listUsers({ page, perPage: 200 });
      id = l?.users.find((u: any) => u.email === email)?.id;
      if (!l?.users.length) break;
    }
    if (!id) throw new Error(`cannot create user ${login}: ${created.error?.message}`);
    await db.auth.admin.updateUserById(id, { password: PASSWORD });
  }
  must(await db.from("profiles").upsert({ id, login, display_name: displayName, must_change_password: true }), "profile " + login);
  return id;
}

async function main() {
  // organisation, plant, areas
  let org = (await db.from("organisation").select("id").eq("name", "Default").maybeSingle()).data;
  if (!org) org = must(await db.from("organisation").insert({ name: "Default" }).select("id").single(), "organisation");
  let plant = (await db.from("plant").select("id").eq("name", "Main Works").maybeSingle()).data;
  if (!plant) plant = must(await db.from("plant").insert({ organisation_id: org.id, name: "Main Works" }).select("id").single(), "plant");
  const areaId: Record<string, string> = {};
  for (const [code, name] of [["bf1", "Blast Furnace 1"], ["sp1", "Sinter Plant 1"]]) {
    let a = (await db.from("area").select("id").eq("code", code).maybeSingle()).data;
    if (!a) a = must(await db.from("area").insert({ plant_id: plant.id, code, name, settings: { retention_days: 90 } }).select("id").single(), "area " + code);
    areaId[code] = a.id;
  }

  // users and memberships
  const sunita = await ensureUser("sunita.m", "Sunita Mehta");
  const ravi = await ensureUser("ravi.k", "Ravi Kumar");
  const anil = await ensureUser("anil.v", "Anil Verma");
  const meena = await ensureUser("meena.r", "Meena R.");
  must(await db.from("membership").upsert([
    { user_id: sunita, area_id: areaId.bf1, role: "manager" },
    { user_id: ravi, area_id: areaId.bf1, role: "field_user" },
    { user_id: anil, area_id: areaId.bf1, role: "manager" },
    { user_id: anil, area_id: areaId.sp1, role: "manager" },
    { user_id: meena, area_id: areaId.sp1, role: "field_user" },
  ]), "membership");
  // platform layer (migration 0007); skipped quietly when that migration has not been applied yet
  await db.from("app_access").upsert([sunita, ravi, anil, meena].map((u) => ({ user_id: u, app_code: "task_monitor" })));

  const bf1 = areaId.bf1;
  const existing = (await db.from("task_list").select("id").eq("area_id", bf1)).data ?? [];
  if (existing.length) { console.log("bf1 already has a task list; skipping workforce, form and tasks."); return; }

  // workforce
  const people = must(await db.from("person").insert(data.people.map((p: any) => ({
    area_id: bf1, kind: p.kind, name: p.name, role_title: p.role_title, team_size: p.team_size,
    vendor_name: p.kind === "vendor_team" ? p.name : null,
    user_id: p.name === "Ravi Kumar" ? ravi : null,
  }))).select("id,name"), "people");
  const personId = new Map<string, string>(people.map((p: any) => [p.name, p.id]));

  // form v1
  const form = must(await db.from("form").insert({ area_id: bf1, name: "Shutdown jobs", template: "Shutdown jobs" }).select("id").single(), "form");
  const fv = must(await db.from("form_version").insert({ area_id: bf1, form_id: form.id, version: 1, created_by: sunita, note: "Seed" }).select("id").single(), "form_version");
  const fields = [
    ["section", "Section", "section", true], ["work_description", "Work description", "text", true],
    ["planned_hours", "Planned hours", "number", false], ["manpower", "Manpower", "number", false],
    ["vendor", "Vendor", "text", false], ["responsible", "Responsible", "person", true],
    ["photo_on_completion", "Photo on completion", "photo", true],
  ];
  must(await db.from("form_field").insert(fields.map((f, i) => ({ area_id: bf1, form_version_id: fv.id, key: f[0], label: f[1], type: f[2], required: f[3], position: i + 1 }))), "form_field");
  must(await db.from("form").update({ current_version_id: fv.id }).eq("id", form.id), "form current");

  // task list, sections, tasks
  const list = must(await db.from("task_list").insert({ area_id: bf1, form_id: form.id, name: "Blast Furnace 1 shutdown", planned_hours: 72, created_by: sunita }).select("id").single(), "task_list");
  const secRows = must(await db.from("section").insert(data.sections.map((s: any, i: number) => ({
    area_id: bf1, task_list_id: list.id, name: s.name, position: i + 1, head_person_id: personId.get(s.head) ?? null,
  }))).select("id,position"), "sections");
  const sectionId = new Map<number, string>(secRows.map((s: any) => [s.position - 1, s.id]));

  for (const t of data.tasks) {
    const values = { work_description: t.work_description, planned_hours: t.planned_hours, manpower: t.manpower, vendor: t.vendor ?? "", photo_on_completion: true };
    const resp = t.responsible ? personId.get(t.responsible) ?? null : null;
    const id = must(await db.rpc("task_create", {
      p_list: list.id, p_section: sectionId.get(t.section), p_values: values, p_responsible: resp,
      p_source: "excel_import", p_actor: sunita, p_note: "Imported from Excel",
    }), "task_create " + t.seq) as string;
    const by = t.responsible ?? "the responsible person";
    if (t.status !== "not_started") {
      must(await db.rpc("task_record_update", { p_task: id, p_type: "status", p_status: "in_progress", p_text: "Started. Isolation and work permit confirmed.", p_actor: ravi }), "update start");
    }
    if (t.status === "in_progress") {
      must(await db.rpc("task_record_update", { p_task: id, p_type: "progress", p_progress: t.progress, p_text: `${t.progress}% done, ${by} on site.`, p_actor: ravi }), "update progress");
    }
    if (t.status === "completed") {
      must(await db.rpc("task_record_update", {
        p_task: id, p_type: "voice", p_status: "completed", p_progress: 100,
        p_text: "Task completed and trial taken, no abnormality. Area cleared.",
        p_extracted: { status: "completed", progress: 100, manpower: t.manpower }, p_confirmed: { status: "completed", progress: 100, manpower: t.manpower },
        p_actor: ravi,
      }), "update done");
    }
  }
  console.log(`Seeded: ${data.people.length} people, ${data.sections.length} sections, ${data.tasks.length} tasks. Password for all users: ${PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
