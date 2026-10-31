"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavInfo } from "@/lib/nav";
import { initials } from "@/lib/format";
import { Logo } from "./Logo";
import { Assign, Chev, FormIcon, Home, List, Pdf, People, Plus, SignOut, Xl } from "./Icons";

/**
 * Persistent top bar, desktop only (the phone keeps the per-screen app bar and the dashboard menu).
 * Managers: Dashboard · Workforce · Assign tasks · PDF report, "Create task" as the one primary button,
 * Upload tasks and Form settings under "More". Field users: Dashboard only.
 */
export function AppNav({ user, role, isManager, listId }: NavInfo) {
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

  const items = isManager
    ? [
        { href: "/", label: "Dashboard", icon: <Home /> },
        { href: "/tasks", label: "Tasks", icon: <List /> },
        { href: "/workforce", label: "Workforce", icon: <People /> },
        { href: "/assign", label: "Assign tasks", icon: <Assign /> },
        ...(listId ? [{ href: `/report/${listId}`, label: "PDF report", icon: <Pdf /> }] : []),
      ]
    : [{ href: "/", label: "Dashboard", icon: <Home /> }, { href: "/tasks", label: "Tasks", icon: <List /> }];
  const more = [
    { href: "/import/tasks", label: "Upload tasks (Excel)", icon: <Xl /> },
    { href: "/form", label: "Form settings", icon: <FormIcon /> },
  ];
  const active = (href: string) => (href === "/" ? path === "/" : href === "/tasks" ? path === "/tasks" : path.startsWith(href));
  const moreActive = more.some((m) => active(m.href));

  return (
    <header className="topnav">
      <div className="topnav-in">
        <Link href="/" className="brandlink" aria-label="Task Monitor home"><Logo size={32} /></Link>
        <nav aria-label="Main">
          {items.map((it) => (
            <Link key={it.href} href={it.href} aria-current={active(it.href) ? "page" : undefined}>{it.icon}<span>{it.label}</span></Link>
          ))}
          {isManager && (
            <div className="more" ref={moreRef}>
              <button type="button" className={`more-btn${moreActive ? " on" : ""}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
                More<Chev />
              </button>
              {open && (
                <div className="more-menu" role="menu">
                  {more.map((m) => (
                    <Link key={m.href} href={m.href} role="menuitem" aria-current={active(m.href) ? "page" : undefined}>{m.icon}{m.label}</Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
        {isManager && <Link className="btn primary cta" href="/tasks/new"><Plus />Create task</Link>}
        <div className="topnav-user" title={`${user} · ${role}`}>
          <span className="avatar sm">{initials(user)}</span>
          <span className="who-txt"><b>{user}</b><small>{role}</small></span>
        </div>
        <form action="/api/auth/logout" method="post"><button className="iconbtn" type="submit" aria-label="Sign out" title="Sign out"><SignOut /></button></form>
      </div>
    </header>
  );
}
