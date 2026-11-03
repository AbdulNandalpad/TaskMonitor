import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { fmtStamp } from "@/lib/format";
import { fmtDuration, loadDetailed } from "@/lib/report/detailed";
import { STATUS } from "@/lib/types";

const TZ = "Asia/Kolkata";
const stamp = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }) : "");

/** Excel export of the detailed report: one row per task, in section order. Managers and area admins only. */
export async function GET(_req: Request, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: list } = await supabase.from("task_list").select("id, area_id").eq("id", listId).maybeSingle();
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: m } = await supabase.from("membership").select("role").eq("user_id", auth.user.id).eq("area_id", list.area_id).maybeSingle();
  if (!m || !["manager", "area_admin"].includes(m.role)) return NextResponse.json({ error: "Managers only" }, { status: 403 });

  const data = await loadDetailed(supabase, list.area_id, listId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = new Map(data.sections.map((s, i) => [s.id as string, i]));
  const rows = [...data.blocks].sort((a, b) => (order.get(a.sectionId ?? "") ?? 999) - (order.get(b.sectionId ?? "") ?? 999) || a.seq - b.seq).map((b) => ({
    Section: b.sectionName, "#": b.seq, "Work description": b.description, Responsible: b.responsible ?? "",
    Start: stamp(b.start), End: stamp(b.end), Duration: fmtDuration(b.durationMin), "Planned hours": b.plannedHours ?? "",
    Status: STATUS[b.status].label, "Progress %": b.progress, Summary: b.summary ?? "",
    Remarks: b.remarks.map((r) => `${stamp(r.at)}${r.by ? ` · ${r.by}` : ""}: ${r.text}${r.original && r.original !== r.text ? ` (original: ${r.original})` : ""}`).join("\n"),
    "Photo count": b.photos.length,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 26 }, { wch: 5 }, { wch: 60 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 80 }, { wch: 80 }, { wch: 11 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Detailed report");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const name = `${String(data.list.name).replace(/[^A-Za-z0-9]+/g, "-")}-detailed-${fmtStamp().replace(/[^0-9A-Za-z]+/g, "")}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
