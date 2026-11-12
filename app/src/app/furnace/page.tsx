import Link from "next/link";
import { LineChart, StatusBar, ZoneRange, ZoneRangeLegend, COLOR } from "@/components/fa/Charts";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, buildMatrix, fmtDate, fmtDateTime, latestScansByConverter, listConverters, readingsOf, statusCounts, summarise } from "@/lib/fa/data";
import { counts as countOf, evaluate, type Status } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";
import { sectionOrder } from "@/lib/fa/zones";

export const dynamic = "force-dynamic";

const FILTERS = ["critical", "warning", "ok", "unset"] as const;
const MCLS: Record<Status, string> = { critical: "m-crit", warning: "m-warn", ok: "m-ok", unset: "m-unset" };
const WORD: Record<Status, string> = { critical: "critical", warning: "warning", ok: "OK", unset: "without a limit" };
const sg = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * Dashboard for one converter: the status split and the numbers that matter first, then what needs attention beside the
 * campaign trend, every zone against its limits, and how each zone moved scan by scan.
 */
export default async function FurnaceHome({ searchParams }: { searchParams: Promise<{ s?: string; c?: string }> }) {
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(sp.s ?? "") ? (sp.s as Status) : null;
  const ctx = await requireFa();
  const { supabase } = ctx;
  const converters = await listConverters(supabase);
  const conv = converters.find((c) => c.id === sp.c) ?? converters[0] ?? null;

  const actions = (
    <>
      {conv && <Link className="fa-btn" href={`/furnace/compare?c=${conv.id}`}>Compare heats</Link>}
      {ctx.canEdit && <Link className="fa-btn primary" href="/furnace/upload">Upload report</Link>}
    </>
  );
  if (!conv) {
    return (
      <FaShell ctx={ctx} title="Dashboard" sub="Converter lining scans, judged against the limits kept for each converter" actions={actions}>
        <div className="fa-card fa-empty">
          <b>No scans yet</b>
          {ctx.canEdit ? <>Upload the first vendor report PDF to start.<br /><Link className="fa-btn primary" style={{ marginTop: 12 }} href="/furnace/upload">Upload report</Link></> : "Nothing has been uploaded yet. An analyst will add the first report."}
        </div>
      </FaShell>
    );
  }

  const [scansDesc, lim] = await Promise.all([latestScansByConverter(supabase, [conv], 12), activeLimits(supabase, conv.id)]);
  const latest = scansDesc[0] ?? null;
  const history = [...scansDesc].reverse(); // oldest first, at most 12
  const rows = await readingsOf(supabase, history.map((s) => s.id));
  const byScan = (id: string) => rows.filter((r) => r.scan_id === id);
  const counts = await statusCounts(supabase, scansDesc, new Map([[conv.id, lim.rows]]));

  const zones = latest ? byScan(latest.id).map((r) => {
    const e = evaluate({ zone: r.zone, avg_mm: r.avg_mm, min_mm: r.min_mm }, lim.rows);
    return { zone: r.zone, section: r.section, avg: r.avg_mm, min: r.min_mm, status: e.status, recs: e.recommendations, warn: e.min.limit?.warn_below ?? null, crit: e.min.limit?.critical_below ?? null };
  }).sort((a, b) => sectionOrder(a.section) - sectionOrder(b.section) || a.zone.localeCompare(b.zone, undefined, { numeric: true })) : [];
  const k = latest ? (counts.get(latest.id) ?? countOf(zones.map((z) => z.status))) : null;
  const rank = (s: Status) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
  const attentionAll = zones.filter((z) => z.status === "critical" || z.status === "warning").sort((a, b) => rank(a.status) - rank(b.status) || a.min - b.min);
  const shown = filter ? zones.filter((z) => z.status === filter).sort((a, b) => a.min - b.min) : attentionAll.slice(0, 8);

  const sumNow = latest ? summarise(byScan(latest.id)) : null;
  const sumPrev = history.length > 1 ? summarise(byScan(history[history.length - 2].id)) : null;
  const prevScan = history.length > 1 ? history[history.length - 2] : null;
  const prevMinBy = new Map(prevScan ? byScan(prevScan.id).map((r) => [r.zone, r.min_mm]) : []);
  const drops = zones.map((z) => ({ zone: z.zone, d: prevMinBy.has(z.zone) ? z.min - (prevMinBy.get(z.zone) as number) : 0 })).sort((a, b) => a.d - b.d);
  const days = latest ? Math.max(0, Math.floor((Date.now() - Date.parse(latest.scanned_at)) / 86400000)) : null;

  const trendLow = history.map((s) => ({ t: Date.parse(s.scanned_at), v: summarise(byScan(s.id))?.lowMin ?? 0 })).filter((p) => p.v > 0);
  const trendAvg = history.map((s) => ({ t: Date.parse(s.scanned_at), v: Math.round(summarise(byScan(s.id))?.meanAvg ?? 0) })).filter((p) => p.v > 0);
  const matrixScans = history.slice(-10);
  const matrix = matrixScans.length > 1 ? buildMatrix(rows.filter((r) => matrixScans.some((s) => s.id === r.scan_id)), lim.rows) : null;
  const href = (s: Status) => `/furnace?${conv.id !== converters[0].id ? `c=${conv.id}&` : ""}s=${s}`;
  const home = conv.id !== converters[0].id ? `/furnace?c=${conv.id}` : "/furnace";

  return (
    <FaShell ctx={ctx} title="Dashboard" sub="Converter lining scans, judged against the limits kept for each converter" actions={actions}>
      {converters.length > 1 && (
        <nav className="fa-tabs" aria-label="Converter">
          {converters.map((c) => <Link key={c.id} href={`/furnace?c=${c.id}`} aria-current={c.id === conv.id ? "page" : undefined}>{c.name}</Link>)}
        </nav>
      )}

      <section className="fa-card fa-hero">
        <div className="fa-cardhead">
          <div>
            <h2>{conv.name}</h2>
            <p className="fa-note" style={{ margin: 0 }}>
              {latest ? <>Heat {latest.heat} · measurement {latest.meas_no} · {fmtDateTime(latest.scanned_at)} · {days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}</> : "No scans for this converter yet."}
            </p>
          </div>
          {latest && <Link className="fa-btn sm" href={`/furnace/scans/${latest.id}`}>Open scan</Link>}
        </div>
        {!lim.version && (
          <div className="fa-banner" style={{ marginTop: 12 }}>No limits are set for this converter yet, so zones show “No limit” instead of OK, Warning or Critical.{" "}
            {ctx.isAdmin ? <Link href={`/furnace/settings?c=${conv.id}`}>Set the limits</Link> : "Ask an administrator to set them."}</div>
        )}
        {k && sumNow && (
          <>
            <StatusBar counts={k} hrefFor={(s) => (filter === s ? home : href(s))} selected={filter} />
            <div className="fa-kpis" style={{ marginBottom: 0 }}>
              <div className="fa-kpi"><div className="l">Lowest minimum</div><div className="v">{sumNow.lowMin} mm</div><div className="s">{sumNow.lowZone}{sumPrev ? ` · ${sg(sumNow.lowMin - sumPrev.lowMin)} mm since heat ${prevScan!.heat}` : ""}</div></div>
              <div className="fa-kpi"><div className="l">Mean of averages</div><div className="v">{Math.round(sumNow.meanAvg)} mm</div><div className={`s ${sumPrev ? (sumNow.meanAvg < sumPrev.meanAvg ? "fa-down" : "fa-up") : ""}`}>{sumPrev ? `${sg(Math.round(sumNow.meanAvg - sumPrev.meanAvg))} mm since heat ${prevScan!.heat}` : `${zones.length} zones`}</div></div>
              <div className="fa-kpi"><div className="l">Biggest drop in a minimum</div><div className={`v ${drops[0] && drops[0].d < 0 ? "fa-down" : ""}`}>{drops[0] && prevScan ? `${sg(drops[0].d)} mm` : "–"}</div><div className="s">{drops[0] && prevScan ? drops[0].zone : "first scan"}</div></div>
              <div className="fa-kpi"><div className="l">Zones needing attention</div><div className="v">{attentionAll.length} of {zones.length}</div><div className="s">{k.critical} critical, {k.warning} warning</div></div>
            </div>
          </>
        )}
      </section>

      {latest && (
        <div className="fa-twocol fa-wide-left">
          <section className="fa-card" style={{ marginBottom: 0 }}>
            <div className="fa-cardhead">
              <h3 style={{ margin: 0 }}>{filter ? `Zones that are ${WORD[filter]}` : "Needs attention"}</h3>
              {filter && <Link className="fa-btn sm" href={home}>Show attention list</Link>}
            </div>
            {shown.length === 0 ? <p className="fa-note">{filter ? "No zones in this status." : "No zone needs attention."}</p> : (
              <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Zones that need attention"><table className="fa-tbl fa-stack">
                <thead><tr><th>Zone</th><th className="n">Min (mm)</th><th className="n">Avg (mm)</th><th>Status</th><th>Recommendation</th></tr></thead>
                <tbody>{shown.map((a) => (
                  <tr key={a.zone} className={a.status}><td className="nw"><b>{a.zone}</b><small>{a.section}</small></td><td className="n" data-label="Minimum (mm)">{a.min}</td><td className="n" data-label="Average (mm)">{a.avg}</td>
                    <td data-label="Status"><StatusBadge status={a.status} /></td><td>{a.recs.length ? a.recs.map((t, i) => <div key={i}>{t}</div>) : <small>{a.status === "critical" || a.status === "warning" ? "No recommendation set" : ""}</small>}</td></tr>
                ))}</tbody>
              </table></div>
            )}
            {!filter && attentionAll.length > shown.length && <p className="fa-note" style={{ marginBottom: 0 }}>Showing the {shown.length} lowest of {attentionAll.length}. <Link href={href("warning")}>Show all warnings</Link></p>}
          </section>

          <section className="fa-card" style={{ marginBottom: 0 }}>
            <h3>Campaign trend</h3>
            <p className="fa-note">Lowest minimum and mean of averages over the last {history.length} scans.</p>
            {trendLow.length > 1 ? (
              <>
                <div className="fa-legend"><span><i style={{ background: COLOR.b }} />Lowest minimum</span><span><i style={{ background: COLOR.a }} />Mean of averages</span></div>
                <LineChart title="Lowest minimum and mean of averages over the last scans" height={300} width={520}
                  series={[{ label: "Mean of averages", color: COLOR.a, points: trendAvg }, { label: "Lowest minimum", color: COLOR.b, points: trendLow }]} />
              </>
            ) : <p className="fa-note">A trend needs at least two scans.</p>}
          </section>
        </div>
      )}

      {zones.length > 0 && (
        <section className="fa-card fa-section">
          <h3>Every zone against its limits</h3>
          <p className="fa-note">Each row is one zone of heat {latest!.heat}. The filled dot is its minimum thickness, the hollow dot its average; the bands behind are its limits.</p>
          <ZoneRangeLegend />
          <ZoneRange items={zones.map((z) => ({ zone: z.zone, section: z.section, min: z.min, avg: z.avg, status: z.status, warn: z.warn, crit: z.crit }))} />
        </section>
      )}

      {matrix && (
        <section className="fa-card">
          <h3>Minimum thickness by zone, scan by scan</h3>
          <p className="fa-note">Each cell is the minimum thickness (mm) of that zone in that scan, coloured by its status against the current limits.</p>
          <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Minimum thickness of every zone in each recent scan">
            <table className="fa-tbl fa-matrix">
              <thead><tr><th scope="col">Zone</th>{matrixScans.map((s) => <th key={s.id} scope="col" className="n"><Link href={`/furnace/scans/${s.id}`}>{fmtDate(s.scanned_at).replace(/ 20\d\d$/, "")}</Link><small>heat {s.heat}</small></th>)}</tr></thead>
              <tbody>{matrix.zones.map((z, i) => (
                <MatrixRows key={z.zone} z={z} first={i === 0 || matrix.zones[i - 1].section !== z.section} cols={matrixScans.length}>
                  {matrixScans.map((s) => { const cell = matrix.cells.get(`${s.id}|${z.zone}`); return <td key={s.id} className={`n ${cell ? MCLS[cell.status] : ""}`}>{cell ? cell.min : "–"}</td>; })}
                </MatrixRows>
              ))}</tbody>
            </table>
          </div>
          <div className="fa-legend"><span><i className="m-crit" />Critical</span><span><i className="m-warn" />Warning</span><span><i className="m-ok" />OK</span><span><i className="m-unset" />No limit</span></div>
        </section>
      )}

      {scansDesc.length > 0 && (
        <section className="fa-card">
          <h3>Recent scans</h3>
          <div className="fa-tablewrap" tabIndex={0} role="region" aria-label="Recent scans"><table className="fa-tbl fa-stack">
            <thead><tr><th>Date</th><th>Heat</th><th className="n">Meas.</th><th className="n">Critical</th><th className="n">Warning</th><th className="n">OK</th><th><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{scansDesc.slice(0, 8).map((s) => { const x = counts.get(s.id); return (
              <tr key={s.id}><td><b>{fmtDateTime(s.scanned_at)}</b></td><td data-label="Heat">{s.heat}</td><td className="n" data-label="Measurement">{s.meas_no}</td><td className="n" data-label="Critical">{x?.critical ?? 0}</td><td className="n" data-label="Warning">{x?.warning ?? 0}</td><td className="n" data-label="OK">{x?.ok ?? 0}</td>
                <td className="n"><Link href={`/furnace/scans/${s.id}`}>Open →</Link></td></tr>); })}</tbody>
          </table></div>
        </section>
      )}
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
