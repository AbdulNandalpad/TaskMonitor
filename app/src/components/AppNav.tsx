"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isActivePath, navLinks, type NavIconName, type NavInfo } from "@/lib/nav";
import { initials } from "@/lib/format";
import { Logo } from "./Logo";
import { Assign, Chev, FormIcon, Grid, Home, List, Pdf, People, Plus, SignOut, Xl } from "./Icons";

export function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case "home": return <Home />;
    case "list": return <List />;
    case "plus": return <Plus />;
    case "xl": return <Xl />;
    case "people": return <People />;
    case "assign": return <Assign />;
    case "pdf": return <Pdf />;
    case "form": return <FormIcon />;
    case "apps": return <Grid />;
  }
}

/**
 * Persistent top bar, desktop only (the phone has the burger menu in its app bar). Managers: Dashboard · Tasks ·
 * Workforce · Assign tasks · PDF report, "Create task" as the one primary button, Upload tasks and Form settings
 * under "More". Field users: Dashboard · Tasks. The link set comes from lib/nav.ts, shared with the phone panel.
 */
export function AppNav(info: NavInfo) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!moreRef.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [open]);
  useEffect(() => { setOpen(false); }, [path]);

  const { primary, create, more, apps } = navLinks(info);
  const active = (href: string) => isActivePath(path, href);
  const moreActive = more.some((m) => active(m.href));

  return (
    <header className="topnav">
      <div className="topnav-in">
        <Link href="/" className="brandlink" aria-label="Task Monitor home"><Logo size={32} /></Link>
        <nav aria-label="Main">
          {primary.map((it) => (
            <Link key={it.href} href={it.href} aria-current={active(it.href) ? "page" : undefined}><NavIcon name={it.icon} /><span>{it.label}</span></Link>
          ))}
          {more.length > 0 && (
            <div className="more" ref={moreRef}>
              <button type="button" className={`more-btn${moreActive ? " on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
                More<Chev />
              </button>
              {open && (
                <div className="more-menu" role="menu">
                  {more.map((m) => (
                    <Link key={m.href} href={m.href} role="menuitem" aria-current={active(m.href) ? "page" : undefined}><NavIcon name={m.icon} />{m.label}</Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
        {create && <Link className="btn primary cta" href={create.href}><Plus />{create.label}</Link>}
        {apps.length > 0 && <Link className="iconbtn" href="/apps" aria-label="All apps" title="All apps"><Grid /></Link>}
        <div className="topnav-user" title={`${info.user} · ${info.role}`}>
          <span className="avatar sm">{initials(info.user)}</span>
          <span className="who-txt"><b>{info.user}</b><small>{info.role}</small></span>
        </div>
        <form action="/api/auth/logout" method="post"><button className="iconbtn" type="submit" aria-label="Sign out" title="Sign out"><SignOut /></button></form>
      </div>
    </header>
  );
}
