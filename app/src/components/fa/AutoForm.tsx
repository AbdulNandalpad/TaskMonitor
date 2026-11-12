"use client";
import type { ReactNode } from "react";

/** A GET form that submits itself when a field changes, so choosing a heat or a zone needs no extra button. */
export function AutoForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form className={className} method="get" onChange={(e) => (e.currentTarget as HTMLFormElement).requestSubmit()}>
      {children}
      <noscript><button className="fa-btn primary" type="submit">Show</button></noscript>
    </form>
  );
}
