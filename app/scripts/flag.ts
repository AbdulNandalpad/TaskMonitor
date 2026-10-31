/* Test helper: flag.ts <login> <true|false> sets profiles.must_change_password for a seeded user (password ChangeMe-2026!). */
import fs from "node:fs";
import { createRequire } from "node:module";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l); if (m) process.env[m[1]] = m[2]; }
const { createClient } = createRequire(process.cwd() + "/package.json")("@supabase/supabase-js");
(async () => {
  const [login, val] = process.argv.slice(2);
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const r = await c.auth.signInWithPassword({ email: `${login}@users.taskmonitor.local`, password: "ChangeMe-2026!" });
  if (r.error) throw r.error;
  await c.from("profiles").update({ must_change_password: val === "true" }).eq("id", r.data.user.id);
  console.log(login, "must_change_password =", val);
})();
