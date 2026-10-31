import { NextResponse } from "next/server";
import { requireCtx } from "@/lib/auth";

export async function POST(req: Request) {
  const ctx = await requireCtx({ managerOnly: true });
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const kind = b.kind === "vendor_team" ? "vendor_team" : "employee";
  const { data, error } = await ctx.supabase.from("person").insert({
    area_id: ctx.area.id, name, kind, role_title: b.role_title ?? null, vendor_name: kind === "vendor_team" ? name : null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
