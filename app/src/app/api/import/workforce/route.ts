import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";

type In = { name: string; role: string; section: string; phone: string; vendor: string };

/** Workforce import: match by name (case-insensitive); existing people are updated, new ones created. */
export async function POST(req: Request) {
  const ctx = await requireCtx({ managerOnly: true });
  const b = await req.json().catch(() => null);
  const people: In[] = Array.isArray(b?.people) ? b.people : [];
  if (!people.length) return NextResponse.json({ error: "No people to import" }, { status: 400 });
  const { supabase, area } = ctx;
  const [{ data: have }, { data: secs }] = await Promise.all([
    supabase.from("person").select("id, name").eq("area_id", area.id),
    supabase.from("section").select("id, name").eq("area_id", area.id),
  ]);
  const byName = new Map((have ?? []).map((p) => [p.name.toLowerCase(), p.id as string]));
  const secId = new Map((secs ?? []).map((s) => [s.name.toLowerCase(), s.id as string]));
  let created = 0, updated = 0;
  for (const p of people) {
    const vendor = p.vendor?.trim() || null;
    const fields = {
      role_title: p.role || null, phone: p.phone || null, section_id: secId.get(p.section?.toLowerCase()) ?? null,
      vendor_name: vendor, kind: vendor || /vendor/i.test(p.name) ? "vendor_team" : "employee",
    };
    const id = byName.get(p.name.toLowerCase());
    if (id) {
      const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));
      const { error } = await supabase.from("person").update(clean).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      updated++;
    } else {
      const { error } = await supabase.from("person").insert({ area_id: area.id, name: p.name, ...fields });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      created++;
    }
  }
  await supabase.from("import_job").insert({
    area_id: area.id, kind: "workforce", sheet: b.sheet ?? null, mapping: b.mapping ?? null, status: "done",
    rows_total: people.length + (b.skipped ?? 0), rows_created: created, rows_updated: updated, rows_skipped: b.skipped ?? 0,
    by_user: ctx.userId, finished_at: new Date().toISOString(), report: { filename: b.filename ?? null },
  });
  await supabase.rpc("log_audit", { p_action: "import", p_area_code: area.code, p_detail: { kind: "workforce", created, updated } });
  return NextResponse.json({ created, updated });
}
