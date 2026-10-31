"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isActivePath, navLinks, type NavInfo } from "@/lib/nav";
import { initials } from "@/lib/format";
import { NavIcon } from "./AppNav";
import { Burger, Close, SignOut } from "./Icons";

/**
 * Phone navigation: a burger button at the right end of the app bar opening a slide-in panel (user, links, sign out).
 * Closes on scrim tap, Escape and navigation; traps focus and locks body scroll while open. Hidden on desktop.
 */
export function MobileMenu(info: NavInfo) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => { setOpen(false); }, [path]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => [...(panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') ?? [])];
    focusables()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    const opener = btn.current;
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", key); opener?.focus(); };
  }, [open]);

  const { phone } = navLinks(info);
  return (
    <>
      <button ref={btn} className="iconbtn burger" type="button" aria-label="Menu" aria-expanded={open} aria-controls="mnav" onClick={() => setOpen(true)}>
        <Burger />
      </button>
      {open && (
        <div className="mnav-back" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="mnav" id="mnav" role="dialog" aria-modal="true" aria-label="Menu" ref={panel}>
            <div className="mnav-hd">
              <span className="avatar">{initials(info.user)}</span>
              <span className="who-txt"><b>{info.user}</b><small>{info.role}</small></span>
              <button className="iconbtn" type="button" onClick={close} aria-label="Close menu"><Close /></button>
            </div>
            <nav aria-label="Menu">
              {phone.map((it) => (
                <Link key={it.href} href={it.href} aria-current={isActivePath(path, it.href) ? "page" : undefined}><NavIcon name={it.icon} />{it.label}</Link>
              ))}
            </nav>
            <form className="mnav-foot" action="/api/auth/logout" method="post">
              <button className="btn block" type="submit"><SignOut />Sign out</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
