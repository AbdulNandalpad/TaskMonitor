"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavInfo } from "@/lib/nav";
import { initials } from "@/lib/format";
import { Logo } from "./Logo";
import { Assign, FormIcon, Home, Pdf, People, Plus, SignOut, Xl } from "./Icons";

/** Persistent top bar, shown on desktop only (the phone keeps the per-screen app bar). */
export function AppNav({ user, role, isManager, listId }: NavInfo) {
  const path = usePathname();
  const items = isManager
    ? [
        { href: "/", label: "Dashboard", icon: <Home /> },
        { href: "/tasks/new", label: "Create task", icon: <Plus /> },
        { href: "/import/tasks", label: "Upload tasks", icon: <Xl /> },
        { href: "/workforce", label: "Workforce", icon: <People /> },
        { href: "/assign", label: "Assign tasks", icon: <Assign /> },
        ...(listId ? [{ href: `/report/${listId}`, label: "PDF report", icon: <Pdf /> }] : []),
        { href: "/form", label: "Form settings", icon: <FormIcon /> },
      ]
    : [{ href: "/", label: "Dashboard", icon: <Home /> }];
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <header className="topnav">
      <div className="topnav-in">
        <Link href="/" className="brandlink" aria-label="Task Monitor home"><Logo size={32} /></Link>
        <nav aria-label="Main">
          {items.map((it) => (
            <Link key={it.href} href={it.href} aria-current={active(it.href) ? "page" : undefined}>{it.icon}<span>{it.label}</span></Link>
          ))}
        </nav>
        <div className="topnav-user">
          <span className="avatar sm">{initials(user)}</span>
          <span className="who-txt"><b>{user}</b><small>{role}</small></span>
        </div>
        <form action="/api/auth/logout" method="post"><button className="iconbtn" type="submit" aria-label="Sign out" title="Sign out"><SignOut /></button></form>
      </div>
    </header>
  );
}
