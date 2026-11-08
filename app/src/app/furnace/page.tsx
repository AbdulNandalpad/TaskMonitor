import Link from "next/link";
import { FaShell, StatusBadge } from "@/components/fa/FaShell";
import { activeLimits, fmtDateTime, listConverters, loadScan, recentScans, statusCounts } from "@/lib/fa/data";
import { evaluate } from "@/lib/fa/evaluate";
import { requireFa } from "@/lib/fa/guard";

export const dynamic = "force-dynamic";

/** Dashboard: per converter, the latest scan, how many zones are critical / warning / OK, and the zones that need attention. */
export default async function FurnaceHome() {
  const ctx = await requireFa();
  const { supabase } = ctx;
  const [converters, scans] = await Promise.all([listConverters(supabase), recentScans(supabase, 30)]);
  // zones are judged with each converter's current limits
  const limByConv = new Map(await Promise.all(converters.map(async (c) => [c.id, await activeLimits(supabase, c.id)] as const)));
  const counts = await statusCounts(supabase, scans, new Map([...limByConv].map(([id, l]) => [id, l.rows])));

  const cards = await Promise.all(converters.map(async (c) => {
    const mine = scans.filter((s) => s.converter_id === c.id);
    const latest = mine[0] ?? null;
    const lim = limByConv.get(c.id)!;
    let attention: { zone: string; section: string; avg: number; min: number; status: "critical" | "warning" | "ok" | "unset"; recs: string[] }[] = [];
    if (latest) {
      const full = await loadScan(supabase, latest.id);
      attention = (full?.readings ?? []).map((r) => { const e = evaluate(r, lim.rows); return { zone: r.zone, section: r.section, avg: r.avg_mm, min: r.min_mm, status: e.status, recs: e.recommendations }; })
        .filter((r) => r.status === "critical" || r.status === "warning")
        .sort((a, b) => (a.status === b.status ? a.min - b.min : a.status === "critical" ? -1 : 1)).slice(0, 8);
    }
    return { c, mine, latest, lim, attention };
  }));

  return (
    <FaShell ctx={ctx} title="Dashboard" sub="Converter lining scans, judged against the limits kept for each converter"
      actions={ctx.canEdit ? <Link className="fa-btn primary" href="/furnace/upload">Upload report</Link> : undefined}>
      {!converters.length && (
        <div className="fa-card fa-empty">
          <b>No scans yet</b>
          {ctx.canEdit ? <>Upload the first vendor report PDF to start. <br /><Link className="fa-btn primary" style={{ marginTop: 12 }} href="/furnace/upload">Upload report</Link></> : "Nothing has been uploaded yet. An analyst will add the first report."}
        </div>
      )}
      {cards.map(({ c, mine, latest, lim, attention }) => {
        const k = latest ? counts.get(latest.id) : null;
        return (
          <section key={c.id} className="fa-card">
            <h2>{c.name}</h2>
            <p className="fa-note">{latest ? <>Latest scan: heat {latest.heat}, measurement {latest.meas_no}, {fmtDateTime(latest.scanned_at)} · <Link href={`/furnace/scans/${latest.id}`}>open</Link></> : "No scans for this converter yet."}</p>
            {!lim.version && (
              <div className="fa-banner">No limits are set for this converter yet, so zones show “No limit” instead of OK, Warning or Critical.{" "}
                {ctx.isAdmin ? <Link href={`/furnace/settings?c=${c.id}`}>Set the limits</Link> : "Ask an administrator to set them."}</div>
            )}
            {k && (
              <div className="fa-grid">
                <div className="fa-stat critical"><b>{k.critical}</b><span>Critical zones</span></div>
                <div className="fa-stat warning"><b>{k.warning}</b><span>Warning zones</span></div>
                <div className="fa-stat ok"><b>{k.ok}</b><span>OK zones</span></div>
                {k.unset > 0 && <div className="fa-stat unset"><b>{k.unset}</b><span>No limit</span></div>}
              </div>
            )}
            {attention.length > 0 && (
              <>
                <h3>Needs attention</h3>
                <div className="fa-tablewrap"><table className="fa-tbl">
                  <thead><tr><th>Zone</th><th className="n">Average</th><th className="n">Minimum</th><th>Status</th><th>Recommendation</th></tr></thead>
                  <tbody>{attention.map((a) => (
                    <tr key={a.zone} className={a.status}><td><b>{a.zone}</b><small>{a.section}</small></td><td className="n">{a.avg} mm</td><td className="n">{a.min} mm</td>
                      <td><StatusBadge status={a.status} /></td><td>{a.recs.length ? a.recs.join(" ") : <small>No recommendation set</small>}</td></tr>
                  ))}</tbody>
                </table></div>
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
