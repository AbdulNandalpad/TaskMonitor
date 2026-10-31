"use client";
import { Pdf } from "./Icons";

/** "Download PDF" opens the browser print dialog (Save as PDF); headless rendering comes later. */
export function PrintButton() {
  return (
    <button className="btn primary" type="button" onClick={() => window.print()}><Pdf />Download PDF</button>
  );
}
