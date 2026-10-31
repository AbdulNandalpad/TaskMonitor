"use client";
import { useToast } from "./Toast";
import { Bell } from "./Icons";

export function BellButton({ open, unassigned }: { open: number; unassigned: number }) {
  const toast = useToast();
  return (
    <button className="iconbtn" type="button" aria-label="Notifications" onClick={() => toast(`${open} tasks not started · ${unassigned} unassigned`)}>
      <Bell />
    </button>
  );
}
