"use client";
import { useEffect, type ReactNode } from "react";
import { Close } from "./Icons";

export function Sheet({ title, onClose, children, label }: { title: string; onClose: () => void; children: ReactNode; label?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={label ?? title}>
        <div className="grab" />
        <div className="hd">
          <h3>{title}</h3>
          <button className="iconbtn" type="button" onClick={onClose} aria-label="Close"><Close /></button>
        </div>
        <div style={{ display: "grid", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}
