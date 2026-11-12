import Link from "next/link";
import { Donut, ScanStatusBars, ZoneBars, ZoneBarsLegend } from "@/components/fa/Charts";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, fmtDate, fmtDateTime, latestScansByConverter, listConverters, loadScan, statusCounts } from "@/lib/fa/data";
import { evaluate, type Status } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";
import { sectionOrder } from "@/lib/fa/zones";

export const dynamic = "force-dynamic";

const FILTERS = ["critical", "warning", "ok", "unset"] as const;

/** Dashboard: per converter, the latest scan as charts (status split, minimum thickness per zone, status of every recent scan) and the zones that need attention. */
export default async function FurnaceHome({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(sp.s ?? "") ? (sp.s as Status) : null;
  const ctx = await requireFa();
  const { supabase } = ctx;
  const converters = await listConverters(supabase);
  // the newest scans of each converter, so a converter that has been quiet for a while still shows its latest
  const scans = (await latestScansByConverter(supabase, converters, 12)).sort((a, b) => b.scanned_at.localeCompare(a.scanned_at));
  // zones are judged with each converter's current limits
  const limByConv = new Map(await Promise.all(converters.map(async (c) => [c.id, await activeLimits(supabase, c.id)] as const)));
  const counts = await statusCounts(supabase, scans, new Map([...limByConv].map(([id, l]) => [id, l.rows])));

  const cards = await Promise.all(converters.map(async (c) => {
    const mine = scans.filter((s) => s.converter_id === c.id);
    const latest = mine[0] ?? null;
    const lim = limByConv.get(c.id)!;
    let zones: { zone: string; section: string; avg: number; min: number; status: Status; recs: string[]; warn: number | null; crit: number | null }[] = [];
    if (latest) {
      const full = await loadScan(supabase, latest.id);
      zones = (full?.readings ?? []).map((r) => {
        const e = evaluate(r, lim.rows);
        return { zone: r.zone, section: r.section, avg: r.avg_mm, min: r.min_mm, status: e.status, recs: e.recommendations, warn: e.min.limit?.warn_below ?? null, crit: e.min.limit?.critical_below ?? null };
      }).sort((a, b) => sectionOrder(a.section) - sectionOrder(b.section) || a.zone.localeCompare(b.zone, undefined, { numeric: true }));
    }
    const shown = (filter ? zones.filter((z) => z.status === filter) : zones.filter((z) => z.status === "critical" || z.status === "warning"))
      .sort((a, b) => (a.status === b.status ? a.min - b.min : a.status === "critical" ? -1 : a.status === "warning" && b.status !== "critical" ? -1 : 1));
    return { c, mine, latest, lim, zones, shown: filter ? shown : shown.slice(0, 10) };
  }));

  return (
    <FaShell ctx={ctx} title="Dashboard" sub="Converter lining scans, judged against the limits kept for each converter"
      actions={<>{converters.length > 0 && <Link className="fa-btn" href="/furnace/compare">Compare heats</Link>}{ctx.canEdit && <Link className="fa-btn primary" href="/furnace/upload">Upload report</Link>}</>}>
      {!converters.length && (
        <div className="fa-card fa-empty">
          <b>No scans yet</b>
          {ctx.canEdit ? <>Upload the first vendor report PDF to start. <br /><Link className="fa-btn primary" style={{ marginTop: 12 }} href="/furnace/upload">Upload report</Link></> : "Nothing has been uploaded yet. An analyst will add the first report."}
        </div>
      )}
      {cards.map(({ c, mine, latest, lim, zones, shown }) => {
        const k = latest ? counts.get(latest.id) : null;
        const history = [...mine].reverse().slice(-12).map((s) => ({ label: fmtDate(s.scanned_at).replace(/ 20\d\d$/, ""), heat: s.heat, ...(counts.get(s.id) ?? { critical: 0, warning: 0, ok: 0, unset: 0 }) }));
        return (
          <section key={c.id} className="fa-card">
            <h2>{c.name}</h2>
            <p className="fa-note">{latest ? <>Latest scan: heat {latest.heat}, measurement {latest.meas_no}, {fmtDateTime(latest.scanned_at)} · <Link href={`/furnace/scans/${latest.id}`}>open</Link></> : "No scans for this converter yet."}</p>
            {!lim.version && (
              <div className="fa-banner">No limits are set for this converter yet, so zones show “No limit” instead of OK, Warning or Critical.{" "}
                {ctx.isAdmin ? <Link href={`/furnace/settings?c=${c.id}`}>Set the limits</Link> : "Ask an administrator to set them."}</div>
            )}
            {k && (
              <>
                <div className="fa-twocol">
                  <Donut counts={k} title={`Status of the ${zones.length} zones, heat ${latest!.heat}`} hrefFor={(s) => (filter === s ? "/furnace" : `/furnace?s=${s}`)} selected={filter} />
                  <div className="fa-grid" style={{ alignContent: "center", margin: 0 }}>
                    <div className="fa-stat critical"><b>{k.critical}</b><span>Critical zones</span></div>
                    <div className="fa-stat warning"><b>{k.warning}</b><span>Warning zones</span></div>
                    <div className="fa-stat ok"><b>{k.ok}</b><span>OK zones</span></div>
                    {k.unset > 0 && <div className="fa-stat unset"><b>{k.unset}</b><span>No limit</span></div>}
                  </div>
                </div>

                <h3 style={{ marginTop: 20 }}>Minimum thickness by zone</h3>
                <ZoneBarsLegend />
                <ZoneBars items={zones.map((z) => ({ zone: z.zone, min: z.min, avg: z.avg, status: z.status, warn: z.warn, crit: z.crit }))} />

                {history.length > 1 && (
                  <>
                    <h3 style={{ marginTop: 20 }}>Zones by status, scan by scan</h3>
                    <ScanStatusBars scans={history} />
                  </>
                )}
              </>
            )}
            {(shown.length > 0 || filter) && (
              <>
                <h3 style={{ marginTop: 20 }}>{filter ? `Zones that are ${{ critical: "critical", warning: "warning", ok: "OK", unset: "without a limit" }[filter]}` : "Needs attention"}{filter && <> · <Link href="/furnace">show attention list</Link></>}</h3>
                {shown.length === 0 ? <p className="fa-note">None.</p> : (
                  <div className="fa-tablewrap"><table className="fa-tbl">
                    <thead><tr><th>Zone</th><th className="n">Average</th><th className="n">Minimum</th><th>Status</th><th>Recommendation</th></tr></thead>
                    <tbody>{shown.map((a) => (
                      <tr key={a.zone} className={a.status}><td><b>{a.zone}</b><small>{a.section}</small></td><td className="n">{a.avg} mm</td><td className="n">{a.min} mm</td>
                        <td><StatusBadge status={a.status} /></td><td>{a.recs.length ? a.recs.map((t, i) => <div key={i}>{t}</div>) : <small>{a.status === "ok" || a.status === "unset" ? "" : "No recommendation set"}</small>}</td></tr>
                    ))}</tbody>
                  </table></div>
                )}
              </>
            )}
            {mine.length > 0 && (
              <>
                <h3 style={{ marginTop: 18 }}>Recent scans</h3>
                <div className="fa-tablewrap"><table className="fa-tbl">
                  <thead><tr><th>Date</th><th>Heat</th><th className="n">Meas.</th><th className="n">Critical</th><th className="n">Warning</th><th className="n">OK</th><th></th></tr></thead>
                  <tbody>{mine.slice(0, 8).map((s) => { const x = counts.get(s.id); return (
                    <tr key={s.id}><td>{fmtDateTime(s.scanned_at)}</td><td>{s.heat}</td><td className="n">{s.meas_no}</td><td className="n">{x?.critical ?? 0}</td><td className="n">{x?.warning ?? 0}</td><td className="n">{x?.ok ?? 0}</td>
                      <td><Link className="fa-btn sm" href={`/furnace/scans/${s.id}`}>Open</Link></td></tr>); })}</tbody>
                </table></div>
              </>
            )}
          </section>
        );
      })}
    </FaShell>
  );
}
