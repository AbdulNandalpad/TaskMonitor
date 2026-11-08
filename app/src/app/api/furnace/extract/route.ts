import { NextResponse } from "next/server";
import { AiUnavailable } from "@/lib/ai/config";
import { extractReport } from "@/lib/fa/extract";
import { faApi } from "@/lib/fa/guard";

export const maxDuration = 120;
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * The browser has already put the PDF in the private bucket (it is too big for a request body); this reads it with Claude
 * and returns the header and zone table as a draft. Nothing is saved here.
 */
export async function POST(req: Request) {
  const g = await faApi({ edit: true });
  if ("res" in g) return g.res;
  const { supabase } = g.ctx;
  const b = await req.json().catch(() => null);
  const key = typeof b?.key === "string" ? b.key : "";
  if (!/^uploads\/[A-Za-z0-9_-]+\.pdf$/.test(key)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const dl = await supabase.storage.from("fa-reports").download(key);
  if (dl.error || !dl.data) return NextResponse.json({ error: "The uploaded file could not be found" }, { status: 404 });
  if (dl.data.size > MAX_BYTES) return NextResponse.json({ error: "The PDF is too large" }, { status: 413 });
  const buf = Buffer.from(await dl.data.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return NextResponse.json({ error: "This is not a PDF file" }, { status: 400 });

  try {
    const draft = await extractReport(buf);
    // warn early when this measurement is already saved
    const { data: conv } = await supabase.from("fa_converter").select("id").eq("code", draft.converter_code).maybeSingle();
    if (conv) {
      const { data: camp } = await supabase.from("fa_campaign").select("id").eq("converter_id", conv.id).eq("no", draft.campaign_no).maybeSingle();
      if (camp) {
        const { data: dup } = await supabase.from("fa_scan").select("id").eq("campaign_id", camp.id).eq("meas_no", draft.meas_no).maybeSingle();
        if (dup) draft.warnings.unshift(`Measurement ${draft.meas_no} of campaign ${draft.campaign_no} is already saved. Saving again will be refused.`);
      }
    }
    return NextResponse.json({ draft, pdf_key: key, pdf_bytes: buf.length });
  } catch (e) {
    if (e instanceof AiUnavailable) return NextResponse.json({ error: "Reading reports needs the AI service, which is not set up." }, { status: 503 });
    const detail = (e as Error).message.slice(0, 200);
    console.error("fa extract failed", detail);
    return NextResponse.json({ error: "The report could not be read", detail }, { status: 502 });
  }
}
