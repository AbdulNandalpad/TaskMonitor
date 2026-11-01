export type Status = "not_started" | "in_progress" | "completed";

/** Labels, chip colours and the prototype's short keys (open / prog / done) used by the CSS. */
export const STATUS: Record<Status, { label: string; chip: "bad" | "warn" | "good"; key: "open" | "prog" | "done" }> = {
  not_started: { label: "Not started", chip: "bad", key: "open" },
  in_progress: { label: "In progress", chip: "warn", key: "prog" },
  completed: { label: "Completed", chip: "good", key: "done" },
};
export const STATUS_ORDER: Status[] = ["not_started", "in_progress", "completed"];

export type Person = {
  id: string;
  name: string;
  role_title: string | null;
  kind: "employee" | "vendor_team";
  user_id: string | null;
  section_id: string | null;
  phone: string | null;
  vendor_name: string | null;
  team_size: number | null;
};
export type Section = { id: string; name: string; position: number; head_person_id: string | null };
export type TaskValues = {
  work_description?: string;
  planned_hours?: number | null;
  manpower?: number | null;
  vendor?: string;
  remarks?: string;
  photo_on_completion?: boolean;
  [k: string]: unknown;
};
export type Task = {
  id: string;
  seq: number;
  section_id: string | null;
  status: Status;
  progress: number;
  responsible_person_id: string | null;
  version: number;
  values: TaskValues;
  changed_by: string | null;
  changed_at: string;
  source: string;
};
export type TaskList = { id: string; name: string; form_id: string | null; planned_hours: number | null; starts_at: string | null; ends_at: string | null };
