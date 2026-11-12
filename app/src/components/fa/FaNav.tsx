"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONS: Record<string, React.ReactNode> = {
  "/furnace/settings": <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  "/furnace/upload": <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  "/furnace": <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  "/furnace/compare": <><path d="M8 3 4 7l4 4M4 7h12M16 21l4-4-4-4M20 17H8" /></>,
  "/furnace/trends": <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
};

/** Furnace Analysis navigation: a sidebar list on a wide screen, a row that scrolls sideways on a phone. */
export function FaNav({ items }: { items: Item[] }) {
  const path = usePathname();
  const on = (href: string) => (href === "/furnace" ? path === "/furnace" : path.startsWith(href));
  return (
    <nav className="fa-nav" aria-label="Furnace Analysis">
      {items.map((it) => (
        <Link key={it.href} href={it.href} title={it.label} aria-current={on(it.href) ? "page" : undefined}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...P}>{ICONS[it.href]}</svg>
          <span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
