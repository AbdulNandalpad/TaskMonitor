"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

/** Furnace Analysis navigation: a row of links that scrolls sideways on a phone. */
export function FaNav({ items }: { items: Item[] }) {
  const path = usePathname();
  const on = (href: string) => (href === "/furnace" ? path === "/furnace" : path.startsWith(href));
  return (
    <nav className="fa-nav" aria-label="Furnace Analysis">
      {items.map((it) => <Link key={it.href} href={it.href} aria-current={on(it.href) ? "page" : undefined}>{it.label}</Link>)}
    </nav>
  );
}
