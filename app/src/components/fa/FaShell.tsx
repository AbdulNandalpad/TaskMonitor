import Link from "next/link";
import type { FaCtx } from "@/lib/fa/guard";
import { initials } from "@/lib/format";
import { Grid, SignOut } from "../Icons";
import { FaLogo } from "./FaLogo";
import { FaNav } from "./FaNav";

/** The frame of every Furnace Analysis page: logo, navigation, who is signed in, way back to all apps, sign out. */
export function FaShell({ ctx, title, sub, actions, children }: { ctx: FaCtx; title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  // in the order the app is used: set it up, upload a report, read the result, compare heats, follow a zone over time
  const items = [
    ...(ctx.isAdmin ? [{ href: "/furnace/settings", label: "Settings" }] : []),
    ...(ctx.canEdit ? [{ href: "/furnace/upload", label: "Upload report" }] : []),
    { href: "/furnace", label: "Dashboard" },
    { href: "/furnace/compare", label: "Compare" },
    { href: "/furnace/trends", label: "Trends" },
  ];
  return (
    <div className="fa-app">
      <header className="fa-top">
        <div className="fa-top-in">
          <Link href="/furnace" className="fa-brand" aria-label="Furnace Analysis home"><FaLogo size={34} /></Link>
          <FaNav items={items} />
          <span className="fa-who" title={ctx.name}><span className="fa-avatar">{initials(ctx.name)}</span><span className="fa-who-txt"><b>{ctx.name}</b><small>{ctx.isAdmin ? "Administrator" : ctx.canEdit ? "Analyst" : "Viewer"}</small></span></span>
          {ctx.multiApp && <Link className="iconbtn" href="/apps" aria-label="All apps" title="All apps"><Grid /></Link>}
          <form action="/api/auth/logout" method="post"><button className="iconbtn" type="submit" aria-label="Sign out" title="Sign out"><SignOut /></button></form>
        </div>
      </header>
      <main className="fa-main">
        <div className="fa-head">
          <div><h1>{title}</h1>{sub ? <p className="fa-sub">{sub}</p> : null}</div>
          {actions ? <div className="fa-actions">{actions}</div> : null}
        </div>
        {children}
      </main>
    </div>
  );
}

export function StatusBadge({ status }: { status: "ok" | "warning" | "critical" | "unset" }) {
  const label = { ok: "OK", warning: "Warning", critical: "Critical", unset: "No limit" }[status];
  const icon = { ok: "✓", warning: "!", critical: "✕", unset: "–" }[status];
  return <span className={`fa-st ${status}`}><i aria-hidden="true">{icon}</i>{label}</span>;
}
