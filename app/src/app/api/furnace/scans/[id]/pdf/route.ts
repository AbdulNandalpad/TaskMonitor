import { NextResponse } from "next/server";
import { faApi } from "@/lib/fa/guard";

/** Opens the original vendor PDF through a short-lived link. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await faApi();
  if ("res" in g) return g.res;
  const { supabase } = g.ctx;
  const { data: scan } = await supabase.from("fa_scan").select("pdf_key, heat, meas_no").eq("id", id).maybeSingle();
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await supabase.storage.from("fa-reports").createSignedUrl(scan.pdf_key as string, 300, { download: `Heat-${scan.heat}-Meas-${scan.meas_no}.pdf` });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "The file could not be opened" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, 302);
}
