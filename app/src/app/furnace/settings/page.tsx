import Link from "next/link";
import { FaShell } from "@/components/fa/FaShell";
import { activeLimits, fmtDateTime, listConverters, rolesList } from "@/lib/fa/data";
import { requireFa } from "@/lib/fa/guard";
import { SECTIONS } from "@/lib/fa/zones";
import { ConverterForm, LimitsEditor, RecipientsEditor, RolesForm } from "./SettingsClient";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "limits", label: "Limits and recommendations" },
  { id: "recipients", label: "Email recipients" },
  { id: "people", label: "Who can upload" },
  { id: "converters", label: "Converters" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** Settings (administrators): one topic per tab. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ c?: string; tab?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireFa({ admin: true });
  const { supabase } = ctx;
  const converters = await listConverters(supabase);
  const conv = converters.find((c) => c.id === sp.c) ?? converters[0];
  const tab: Tab = (TABS.some((t) => t.id === sp.tab) ? sp.tab : conv ? "limits" : "converters") as Tab;
  const hrefTab = (t: Tab) => `/furnace/settings?tab=${t}${conv ? `&c=${conv.id}` : ""}`;

  let body: React.ReactNode = null;
  if (tab === "limits") {
    if (!conv) {
      body = <div className="fa-card fa-empty"><b>No converter yet</b>A converter is created from the first report, or add one under Converters to set its limits first.</div>;
    } else {
      const limits = await activeLimits(supabase, conv.id);
      const { data: h } = await supabase.from("fa_limit_version").select("id, version, note, created_at, active").eq("converter_id", conv.id).order("version", { ascending: false }).limit(10);
      const history = (h ?? []) as { id: string; version: number; note: string | null; created_at: string; active: boolean }[];
      const { data: last } = await supabase.from("fa_scan").select("id").eq("converter_id", conv.id).order("scanned_at", { ascending: false }).limit(1);
      let zones: string[] = [];
      if (last?.[0]) { const { data: z } = await supabase.from("fa_reading").select("zone").eq("scan_id", last[0].id as string); zones = (z ?? []).map((r) => r.zone as string).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
      body = (
        <>
          <section className="fa-card">
            <div className="fa-cardhead">
              <div>
                <h2>Limits and recommendations</h2>
                <p className="fa-note" style={{ margin: 0 }}>{limits.version ? `Active: version ${limits.version.version}, saved ${fmtDateTime(limits.version.created_at)}${limits.version.note ? ` (${limits.version.note})` : ""}.` : "No limits are set yet."}</p>
              </div>
              {converters.length > 1 && (
                <nav className="fa-tabs fa-tabs-inline" aria-label="Converter">{converters.map((c) => <Link key={c.id} href={`/furnace/settings?tab=limits&c=${c.id}`} aria-current={c.id === conv.id ? "page" : undefined}>{c.name}</Link>)}</nav>
              )}
            </div>
            <p className="fa-note">
              Thickness <b>below</b> the warning level is a Warning, and below the critical level it is Critical. A row can name one zone (for example “ChargePad-1A”), a section ({SECTIONS.join(", ")}) or * for every zone; the most specific row wins.
              Saving creates a new version and the earlier ones are kept. Every scan, old or new, is judged with the current version.
            </p>
            <LimitsEditor key={`${conv.id}:${limits.version?.id ?? "none"}`} converterId={conv.id} initial={limits.rows} zones={zones} sections={[...SECTIONS]} />
          </section>
          {history.length > 0 && (
            <section className="fa-card">
              <h3>Versions</h3>
              <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Limit versions"><table className="fa-tbl">
                <thead><tr><th>Version</th><th>Saved</th><th>Note</th><th>State</th></tr></thead>
                <tbody>{history.map((v) => <tr key={v.id}><td><b>v{v.version}</b></td><td>{fmtDateTime(v.created_at)}</td><td>{v.note || "–"}</td><td>{v.active ? <span className="fa-chip ok">Active</span> : <span className="fa-chip">Earlier</span>}</td></tr>)}</tbody>
              </table></div>
            </section>
          )}
        </>
      );
    }
  } else if (tab === "recipients") {
    const { data: recs } = await supabase.from("fa_recipient").select("id, converter_id, name, email, min_severity, active").order("created_at");
    const { data: log } = await supabase.from("fa_notification").select("email, outcome, detail, at").order("at", { ascending: false }).limit(8);
    body = (
      <>
        <section className="fa-card">
          <h2>Email recipients</h2>
          <p className="fa-note">After a report is saved with warnings or critical zones, these addresses are emailed the findings and recommendations. A recipient with no converter receives every converter.</p>
          <RecipientsEditor converters={converters.map((c) => ({ id: c.id, name: c.name }))} initial={(recs ?? []) as { id: string; converter_id: string | null; name: string; email: string; min_severity: "warning" | "critical"; active: boolean }[]} />
        </section>
        {(log ?? []).length > 0 && (
          <section className="fa-card">
            <h3>Last emails</h3>
            <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Last emails"><table className="fa-tbl">
              <thead><tr><th>When</th><th>To</th><th>Result</th></tr></thead>
              <tbody>{(log ?? []).map((l, i) => <tr key={i}><td>{fmtDateTime(l.at as string)}</td><td>{l.email as string}</td><td>{l.outcome === "sent" ? "Sent" : l.outcome === "skipped_no_key" ? "Not sent: email is not set up" : `Failed${l.detail ? `: ${l.detail}` : ""}`}</td></tr>)}</tbody>
            </table></div>
          </section>
        )}
      </>
    );
  } else if (tab === "people") {
    const roles = await rolesList(supabase);
    body = (
      <section className="fa-card">
        <h2>Who can upload</h2>
        <p className="fa-note">Everyone given the app on the platform access screen can view. Give a role here to let them upload reports (analyst) or manage settings (administrator). Platform administrators are always administrators.</p>
        {roles === null ? <p className="fa-note">The list of current role holders appears once the latest database update (0009) has been applied.</p> : roles.length > 0 && (
          <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="People with a role" style={{ marginBottom: 16 }}><table className="fa-tbl">
            <thead><tr><th>Name</th><th>User ID</th><th>Role</th></tr></thead>
            <tbody>{roles.map((r) => <tr key={r.login}><td><b>{r.display_name}</b></td><td>{r.login}</td><td><span className="fa-chip ready">{r.role === "admin" ? "Administrator" : r.role === "analyst" ? "Analyst" : "Viewer"}</span></td></tr>)}</tbody>
          </table></div>
        )}
        <RolesForm />
      </section>
    );
  } else {
    body = (
      <section className="fa-card">
        <h2>Converters</h2>
        <p className="fa-note">A converter is created automatically from the first report. Add one here first to set its limits before any report arrives, or rename an existing one (use its code).</p>
        {converters.length > 0 && (
          <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Converters" style={{ marginBottom: 16 }}><table className="fa-tbl">
            <thead><tr><th>Code</th><th>Name</th><th>Plant</th></tr></thead>
            <tbody>{converters.map((c) => <tr key={c.id}><td><b>{c.code}</b></td><td>{c.name}</td><td>{c.plant || "–"}</td></tr>)}</tbody>
          </table></div>
        )}
        <ConverterForm />
      </section>
    );
  }

  return (
    <FaShell ctx={ctx} title="Settings" sub="Limits, recommendations, email recipients and who can upload">
      <nav className="fa-tabs" aria-label="Settings sections">
        {TABS.map((t) => <Link key={t.id} href={hrefTab(t.id)} aria-current={t.id === tab ? "page" : undefined}>{t.label}</Link>)}
      </nav>
      {body}
    </FaShell>
  );
}
