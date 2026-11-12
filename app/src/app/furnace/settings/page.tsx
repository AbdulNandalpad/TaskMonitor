import Link from "next/link";
import { FaShell } from "@/components/fa/FaShell";
import { activeLimits, fmtDateTime, listConverters } from "@/lib/fa/data";
import { requireFa } from "@/lib/fa/guard";
import { SECTIONS } from "@/lib/fa/zones";
import { ConverterForm, LimitsEditor, RecipientsEditor, RolesForm } from "./SettingsClient";

export const dynamic = "force-dynamic";

/** Settings (administrators): converters, the limits and recommendations, who gets the emails, who can upload. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFa({ admin: true });
  const { supabase } = ctx;
  const converters = await listConverters(supabase);
  const conv = converters.find((c) => c.id === sp.c) ?? converters[0];

  let zones: string[] = [];
  let limits = { version: null as null | { id: string; version: number; note: string | null; created_at: string }, rows: [] as Awaited<ReturnType<typeof activeLimits>>["rows"] };
  let history: { id: string; version: number; note: string | null; created_at: string; active: boolean }[] = [];
  if (conv) {
    limits = await activeLimits(supabase, conv.id);
    const { data: h } = await supabase.from("fa_limit_version").select("id, version, note, created_at, active").eq("converter_id", conv.id).order("version", { ascending: false }).limit(10);
    history = (h ?? []) as typeof history;
    const { data: last } = await supabase.from("fa_scan").select("id").eq("converter_id", conv.id).order("scanned_at", { ascending: false }).limit(1);
    if (last?.[0]) { const { data: z } = await supabase.from("fa_reading").select("zone").eq("scan_id", last[0].id as string); zones = (z ?? []).map((r) => r.zone as string).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
  }
  const { data: recs } = await supabase.from("fa_recipient").select("id, converter_id, name, email, min_severity, active").order("created_at");
  const { data: log } = await supabase.from("fa_notification").select("email, outcome, detail, at").order("at", { ascending: false }).limit(8);

  return (
    <FaShell ctx={ctx} title="Settings" sub="Limits, recommendations, email recipients and who can upload">
      <section className="fa-card">
        <h2>Converters</h2>
        <p className="fa-note">A converter is created automatically from the first report. Create it here first to set its limits before any report arrives.</p>
        {converters.length > 0 && <p className="fa-note">{converters.map((c) => <span key={c.id} style={{ marginRight: 12 }}><Link href={`/furnace/settings?c=${c.id}`}><b>{c.name}</b></Link> ({c.code})</span>)}</p>}
        <ConverterForm />
      </section>

      {conv ? (
        <section className="fa-card">
          <h2>Limits and recommendations · {conv.name}</h2>
          <p className="fa-note">
            Thickness <b>below</b> the warning level is a Warning and below the critical level is Critical. A row can name one zone (for example “ChargePad-1A”), a section (Tapside, Trunnion, Charge Pad, Slag line) or * for every zone; the most specific row wins.
            Saving creates a new version and the earlier ones are kept. Every scan, old or new, is judged with the current version.
            {limits.version ? ` Active: version ${limits.version.version}, saved ${fmtDateTime(limits.version.created_at)}${limits.version.note ? ` (${limits.version.note})` : ""}.` : " No limits are set yet."}
          </p>
          <LimitsEditor key={`${conv.id}:${limits.version?.id ?? "none"}`} converterId={conv.id} initial={limits.rows} zones={zones} sections={[...SECTIONS]} />
          {history.length > 1 && <p className="fa-note" style={{ marginTop: 14 }}>Earlier versions: {history.filter((h) => !h.active).map((h) => `v${h.version} (${fmtDateTime(h.created_at)}${h.note ? `, ${h.note}` : ""})`).join(" · ")}</p>}
        </section>
      ) : null}

      <section className="fa-card">
        <h2>Email recipients</h2>
        <p className="fa-note">After a report is saved with warnings or critical zones, these addresses are emailed the findings and recommendations. “Converter: all” receives every converter.</p>
        <RecipientsEditor converters={converters.map((c) => ({ id: c.id, name: c.name }))} initial={(recs ?? []) as { id: string; converter_id: string | null; name: string; email: string; min_severity: "warning" | "critical"; active: boolean }[]} />
        {(log ?? []).length > 0 && <p className="fa-note" style={{ marginTop: 12 }}>Last emails: {(log ?? []).map((l) => `${l.email} ${l.outcome === "sent" ? "sent" : l.outcome === "skipped_no_key" ? "not sent (email not set up)" : `failed${l.detail ? ` (${l.detail})` : ""}`}`).join(" · ")}</p>}
      </section>

      <section className="fa-card">
        <h2>Who can upload</h2>
        <p className="fa-note">Everyone given the app on the platform access screen can view. Give a role here to let them upload reports (analyst) or manage settings (administrator). Platform administrators are always administrators.</p>
        <RolesForm />
      </section>
    </FaShell>
  );
}
