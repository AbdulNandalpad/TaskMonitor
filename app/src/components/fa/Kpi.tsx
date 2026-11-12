"use client";
import { useState } from "react";

/** A key number: label and value always visible; the explaining detail opens on click so the tile stays clean. */
export function Kpi({ label, value, detail, vClass = "", dClass = "" }: { label: string; value: React.ReactNode; detail?: React.ReactNode; vClass?: string; dClass?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`fa-kpi${open ? " open" : ""}`}>
      <div className="l">{label}</div>
      <div className={`v ${vClass}`}>{value}</div>
      {detail ? (
        <>
          <button type="button" className="fa-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide" : "Details"}<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          {open && <div className={`s ${dClass}`}>{detail}</div>}
        </>
      ) : null}
    </div>
  );
}
