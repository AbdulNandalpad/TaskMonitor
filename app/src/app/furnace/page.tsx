import Link from "next/link";
import { Donut, ZoneRange, ZoneRangeLegend } from "@/components/fa/Charts";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, fmtDate, fmtDateTime, latestScansByConverter, listConverters, loadScan, statusCounts, zoneMatrix } from "@/lib/fa/data";
import { evaluate, type Status } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";
import { sectionOrder } from "@/lib/fa/zones";

export const dynamic = "force-dynamic";

const FILTERS = ["critical", "warning", "ok", "unset"] as const;
const MCLS: Record<Status, string> = { critical: "m-crit", warning: "m-warn", ok: "m-ok", unset: "m-unset" };

/** Dashboard: per converter, what needs attention first, then the status split, every zone against its limits, and how each zone moved scan by scan. */
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
    const rank = (s: Status) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
    const shown = (filter ? zones.filter((z) => z.status === filter) : zones.filter((z) => z.status === "critical" || z.status === "warning")).sort((a, b) => rank(a.status) - rank(b.status) || a.min - b.min);
    const history = [...mine].reverse().slice(-10); // oldest first
    const matrix = history.length > 1 ? await zoneMatrix(supabase, history, lim.rows) : null;
    return { c, mine, latest, lim, zones, shown: filter ? shown : shown.slice(0, 10), history, matrix };
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
      {cards.map(({ c, mine, latest, lim, zones, shown, history, matrix }) => {
        const k = latest ? counts.get(latest.id) : null;
        const low = zones.length ? zones.reduce((m, z) => (z.min < m.min ? z : m), zones[0]) : null;
        const meanAvg = zones.length ? Math.round(zones.reduce((a, z) => a + z.avg, 0) / zones.length) : null;
        const days = latest ? Math.max(0, Math.floor((Date.now() - Date.parse(latest.scanned_at)) / 86400000)) : null;
        return (
          <section key={c.id} className="fa-card">
            <h2>{c.name}</h2>
            <p className="fa-note">{latest ? <>Latest scan: heat {latest.heat}, measurement {latest.meas_no}, {fmtDateTime(latest.scanned_at)} · <Link href={`/furnace/scans/${latest.id}`}>open</Link></> : "No scans for this converter yet."}</p>
            {!lim.version && (
              <div className="fa-banner">No limits are set for this converter yet, so zones show “No limit” instead of OK, Warning or Critical.{" "}
                {ctx.isAdmin ? <Link href={`/furnace/settings?c=${c.id}`}>Set the limits</Link> : "Ask an administrator to set them."}</div>
            )}
            {k && low && (
              <div className="fa-twocol">
                <Donut counts={k} title={`Status of the ${zones.length} zones, heat ${latest!.heat}`} hrefFor={(s) => (filter === s ? "/furnace" : `/furnace?s=${s}`)} selected={filter} />
                <div className="fa-kpis" style={{ margin: 0, alignContent: "center" }}>
                  <div className="fa-kpi"><div className="l">Lowest minimum</div><div className="v">{low.min} mm</div><div className="s">{low.zone}</div></div>
                  <div className="fa-kpi"><div className="l">Mean of averages</div><div className="v">{meanAvg} mm</div><div className="s">{zones.length} zones</div></div>
                  <div className="fa-kpi"><div className="l">Last scan</div><div className="v">{days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} ago`}</div><div className="s">{fmtDate(latest!.scanned_at)}</div></div>
                </div>
              </div>
            )}

            {(shown.length > 0 || filter) && (
              <div className="fa-section">
                <h3>{filter ? `Zones that are ${{ critical: "critical", warning: "warning", ok: "OK", unset: "without a limit" }[filter]}` : "Needs attention"}{filter && <> · <Link href="/furnace">show the attention list</Link></>}</h3>
                {shown.length === 0 ? <p className="fa-note">No zones in this status.</p> : (
                  <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Zones that need attention"><table className="fa-tbl">
                    <thead><tr><th>Zone</th><th className="n">Average (mm)</th><th className="n">Minimum (mm)</th><th>Status</th><th>Recommendation</th></tr></thead>
                    <tbody>{shown.map((a) => (
                      <tr key={a.zone} className={a.status}><td><b>{a.zone}</b><small>{a.section}</small></td><td className="n">{a.avg}</td><td className="n">{a.min}</td>
                        <td><StatusBadge status={a.status} /></td><td>{a.recs.length ? a.recs.map((t, i) => <div key={i}>{t}</div>) : <small>{a.status === "ok" || a.status === "unset" ? "" : "No recommendation set"}</small>}</td></tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>
            )}

            {zones.length > 0 && (
              <div className="fa-section">
                <h3>Every zone against its limits</h3>
                <ZoneRangeLegend />
                <ZoneRange items={zones.map((z) => ({ zone: z.zone, section: z.section, min: z.min, avg: z.avg, status: z.status, warn: z.warn, crit: z.crit }))} />
              </div>
            )}

            {matrix && (
              <div className="fa-section">
                <h3>Minimum thickness by zone, scan by scan</h3>
                <p className="fa-note">Each cell is the minimum thickness (mm) of that zone in that scan, coloured by its status against the current limits.</p>
                <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Minimum thickness of every zone in each recent scan">
                  <table className="fa-tbl fa-matrix">
                    <thead><tr><th scope="col">Zone</th>{history.map((s) => <th key={s.id} scope="col" className="n"><Link href={`/furnace/scans/${s.id}`}>{fmtDate(s.scanned_at).replace(/ 20\d\d$/, "")}</Link><small>heat {s.heat}</small></th>)}</tr></thead>
                    <tbody>{matrix.zones.map((z, i) => (
                      <MatrixRows key={z.zone} z={z} first={i === 0 || matrix.zones[i - 1].section !== z.section} cols={history.length}>
                        {history.map((s) => { const cell = matrix.cells.get(`${s.id}|${z.zone}`); return <td key={s.id} className={`n ${cell ? MCLS[cell.status] : ""}`}>{cell ? cell.min : "–"}</td>; })}
                      </MatrixRows>
                    ))}</tbody>
                  </table>
                </div>
                <div className="fa-legend"><span><i className="m-crit" />Critical</span><span><i className="m-warn" />Warning</span><span><i className="m-ok" />OK</span><span><i className="m-unset" />No limit</span></div>
              </div>
            )}

            {mine.length > 0 && (
              <div className="fa-section">
                <h3>Recent scans</h3>
                <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Recent scans"><table className="fa-tbl">
                  <thead><tr><th>Date</th><th>Heat</th><th className="n">Meas.</th><th className="n">Critical</th><th className="n">Warning</th><th className="n">OK</th><th><span className="sr-only">Open</span></th></tr></thead>
                  <tbody>{mine.slice(0, 8).map((s) => { const x = counts.get(s.id); return (
                    <tr key={s.id}><td>{fmtDateTime(s.scanned_at)}</td><td>{s.heat}</td><td className="n">{s.meas_no}</td><td className="n">{x?.critical ?? 0}</td><td className="n">{x?.warning ?? 0}</td><td className="n">{x?.ok ?? 0}</td>
                      <td className="n"><Link href={`/furnace/scans/${s.id}`}>Open →</Link></td></tr>); })}</tbody>
                </table></div>
              </div>
            )}
          </section>
        );
      })}
    </FaShell>
  );
}

/** A zone row of the grid, with its section heading above the first zone of each section. */
function MatrixRows({ z, first, cols, children }: { z: { zone: string; section: string }; first: boolean; cols: number; children: React.ReactNode }) {
  return (
    <>
      {first && <tr className="fa-sec"><th scope="colgroup" colSpan={cols + 1}>{z.section}</th></tr>}
      <tr><th scope="row">{z.zone}</th>{children}</tr>
    </>
  );
}
