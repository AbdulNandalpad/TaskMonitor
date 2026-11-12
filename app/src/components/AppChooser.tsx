import Link from "next/link";
import { LogoMark } from "./Logo";
import { Arrow, Grid, SignOut } from "./Icons";
import { FaLogoMark } from "./fa/FaLogo";
import type { AppInfo } from "@/lib/apps";

const HUE: Record<string, string> = { task_monitor: "#4f46e5", furnace_analysis: "#f97316" };
const FALLBACK = ["#06b6d4", "#16a34a", "#db2777", "#7c3aed"];

/** The app chooser: one tile per app the user was given. Shown only to people who have more than one (everyone else goes straight in). */
export function AppChooser({ user, apps, admin }: { user: string; apps: AppInfo[]; admin: boolean }) {
  return (
    <main className="launch">
      <header className="launch-hd">
        <span className="launch-brand"><LogoMark size={30} /><b>Apps</b></span>
        <span className="launch-user">{user}</span>
        <form action="/api/auth/logout" method="post"><button className="iconbtn" type="submit" aria-label="Sign out" title="Sign out"><SignOut /></button></form>
      </header>
      <section className="launch-body">
        <h1>Choose an app</h1>
        <p className="note">You have access to {apps.length} apps. Pick the one you want to open.</p>
        <div className="launch-grid">
          {apps.map((a, i) => (
            <Link key={a.code} href={a.home_path} className="launch-tile">
              {a.code === "task_monitor" ? <LogoMark size={52} className="lt-mark" />
                : a.code === "furnace_analysis" ? <FaLogoMark size={52} className="lt-mark" />
                : <span className="lt-ic" style={{ background: HUE[a.code] ?? FALLBACK[i % FALLBACK.length] }}><Grid /></span>}
              <b>{a.name}</b>
              {a.description ? <small>{a.description}</small> : null}
              <span className="lt-go">Open<Arrow /></span>
            </Link>
          ))}
        </div>
        {admin && <p style={{ marginTop: 24 }}><Link className="btn" href="/admin/access">Manage who can open which app</Link></p>}
      </section>
    </main>
  );
}
