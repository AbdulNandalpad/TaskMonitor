import Link from "next/link";
import type { ReactNode } from "react";
import type { NavInfo } from "@/lib/nav";
import { Back } from "./Icons";
import { AppNav } from "./AppNav";
import { MobileMenu } from "./MobileMenu";
import { LogoMark } from "./Logo";

/**
 * App shell. On a phone: the per-screen app bar (sticky) over a scrolling body. On a desktop: a persistent top bar
 * (`nav`), then a page header and the content in a centred column, 920px for field screens or 1200px when `wide`.
 */
export function Screen({
  title, sub, subPhoneOnly, back, actions, wide, short, nav, children,
}: {
  title: string; sub?: string; subPhoneOnly?: boolean; back?: string; actions?: ReactNode; wide?: boolean; short?: boolean; nav?: NavInfo; children: ReactNode;
}) {
  return (
    <div className={`shell${wide ? " wide" : ""}`}>
      {nav && <AppNav {...nav} />}
      <div className="col">
        <div className="appbar">
          {back ? (
            <Link className="back" href={back} aria-label="Back"><Back /></Link>
          ) : nav ? (
            <span className="appbar-mark m-only"><LogoMark size={34} /></span>
          ) : null}
          <div className="ttl">
            <h2>{title}</h2>
            {sub && <span className={subPhoneOnly ? "m-only" : undefined}>{sub}</span>}
          </div>
          {actions}
          {nav && <MobileMenu {...nav} />}
        </div>
        <div className={`body${short ? " short" : ""}`}>{children}</div>
      </div>
    </div>
  );
}

export function Bar({ done, prog, open, n }: { done: number; prog: number; open: number; n: number }) {
  const t = n || 1;
  return (
    <div className="bar">
      <i className="g" style={{ width: `${(done / t) * 100}%` }} />
      <i className="p" style={{ width: `${(prog / t) * 100}%` }} />
      <i className="o" style={{ width: `${(open / t) * 100}%` }} />
    </div>
  );
}
