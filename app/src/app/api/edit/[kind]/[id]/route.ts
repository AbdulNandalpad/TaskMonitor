import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * CR-6: rename what the client sees. Only the listed columns can change (the database enforces the same with column-level
 * grants, role policies and an audit trigger that records old and new per column). Zero rows updated means not allowed.
 */
const KINDS: Record<string, { table: string; fields: Record<string, "name" | "text" | "date" | "num" | "int" | "uuid"> }> = {
  list: { table: "task_list", fields: { name: "name", starts_at: "date", ends_at: "date", planned_hours: "num" } },
  section: { table: "section", fields: { name: "name", head_person_id: "uuid" } },
  person: { table: "person", fields: { name: "name", role_title: "text", phone: "text", team_size: "int" } },
  area: { table: "area", fields: { name: "name" } },
};

export async function POST(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const def = KINDS[kind];
  const b = await req.json().catch(() => null);
  if (!def || !b || typeof b !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  for (const [key, type] of Object.entries(def.fields)) {
    if (!(key in b)) continue;
    const v = b[key];
    if (type === "name") {
      const t = String(v ?? "").trim();
      if (!t) return NextResponse.json({ error: "A name is required." }, { status: 400 });
      if (t.length > 120) return NextResponse.json({ error: "That name is too long." }, { status: 400 });
      patch[key] = t;
    } else if (type === "text") patch[key] = String(v ?? "").trim() || null;
    else if (type === "date") {
      if (v === null || v === "") patch[key] = null;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) patch[key] = `${v}T00:00:00+05:30`;
      else return NextResponse.json({ error: "Use a valid date." }, { status: 400 });
    } else if (type === "num" || type === "int") {
      if (v === null || v === "") patch[key] = null;
      else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "Use a number of zero or more." }, { status: 400 });
        patch[key] = type === "int" ? Math.round(n) : n;
      }
    } else if (type === "uuid") patch[key] = v ? String(v) : null;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.from(def.table).update(patch).eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400 });
  if (!data?.length) return NextResponse.json({ error: "You are not allowed to change this." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
