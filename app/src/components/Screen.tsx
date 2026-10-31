import Link from "next/link";
import type { ReactNode } from "react";
import { Back } from "./Icons";

/** App bar + scrolling body, as in the prototype. Max 480px for field screens, 960px for manager tables. */
export function Screen({
  title, sub, back, actions, wide, short, children,
}: {
  title: string; sub?: string; back?: string; actions?: ReactNode; wide?: boolean; short?: boolean; children: ReactNode;
}) {
  return (
    <div className={`shell${wide ? " wide" : ""}`}>
      <div className="appbar">
        {back && (
          <Link className="back" href={back} aria-label="Back"><Back /></Link>
        )}
        <div className="ttl">
          <h2>{title}</h2>
          {sub && <span>{sub}</span>}
        </div>
        {actions}
      </div>
      <div className={`body${short ? " short" : ""}`}>{children}</div>
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
