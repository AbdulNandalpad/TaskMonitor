"use client";

/** Opens the browser print dialog; "Save as PDF" there gives the PDF. */
export function FaPrint({ label = "Print / Save as PDF" }: { label?: string }) {
  return <button type="button" className="fa-btn" onClick={() => window.print()}>{label}</button>;
}
