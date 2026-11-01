import type { Ctx } from "./auth";
import type { Person, Section, Task, TaskList } from "./types";

export type Board = { list: TaskList | null; sections: Section[]; persons: Person[]; tasks: Task[] };

/** One task list per area for now; everything the screens need in four queries. */
export async function loadBoard(ctx: Ctx): Promise<Board> {
  const { supabase, area } = ctx;
  const { data: lists } = await supabase
    .from("task_list").select("id, name, form_id, planned_hours, starts_at, ends_at").eq("area_id", area.id).order("name").limit(1);
  const list = (lists?.[0] as TaskList | undefined) ?? null;
  if (!list) return { list: null, sections: [], persons: [], tasks: [] };
  const [sections, persons, tasks] = await Promise.all([
    supabase.from("section").select("id, name, position, head_person_id").eq("task_list_id", list.id).order("position"),
    supabase.from("person").select("id, name, role_title, kind, user_id, section_id, phone, vendor_name, team_size")
      .eq("area_id", area.id).eq("active", true).order("created_at").order("name"),
    supabase.from("task_current")
      .select("id, seq, section_id, status, progress, responsible_person_id, version, values, changed_by, changed_at, source")
      .eq("task_list_id", list.id).order("seq").limit(5000),
  ]);
  return {
    list,
    sections: (sections.data ?? []) as Section[],
    persons: (persons.data ?? []) as Person[],
    tasks: (tasks.data ?? []) as Task[],
  };
}

export const taskTitle = (t: Task) => (t.values.work_description as string) ?? "";
