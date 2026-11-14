"use client";

/** Opens the browser print dialog; choose "Save as PDF" as the destination there. */
export function FaPrint({ label = "Export to PDF" }: { label?: string }) {
  return <button type="button" className="fa-btn" onClick={() => window.print()}>{label}</button>;
}
