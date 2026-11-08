import type { Ctx } from "./auth";
import { ROLE_LABEL } from "./roles";

/** What the navigation needs from the signed-in context. `unassigned` is shown on "Assign tasks" when known. */
export type NavInfo = { area: string; user: string; role: string; isManager: boolean; listId: string | null; unassigned?: number; multiApp?: boolean };

export const navOf = (ctx: Ctx, listId?: string | null, unassigned?: number): NavInfo => ({
  area: ctx.area.name,
  user: ctx.profile.display_name,
  role: ROLE_LABEL[ctx.role],
  isManager: ctx.isManager,
  listId: listId ?? null,
  unassigned,
  multiApp: ctx.multiApp,
});

export type NavIconName = "home" | "list" | "plus" | "xl" | "people" | "assign" | "pdf" | "form" | "apps";
export type NavItem = { href: string; label: string; icon: NavIconName };

/**
 * The single nav definition. Desktop bar: `primary` links, `create` as the primary button, `more` in a dropdown.
 * Phone panel: `phone` (everything, in one list). Field users only get Dashboard and Tasks.
 */
export function navLinks(n: NavInfo) {
  const dashboard: NavItem = { href: "/", label: "Dashboard", icon: "home" };
  const tasks: NavItem = { href: "/tasks", label: "Tasks", icon: "list" };
  const create: NavItem = { href: "/tasks/new", label: "Create task", icon: "plus" };
  const upload: NavItem = { href: "/import/tasks", label: "Upload tasks (Excel)", icon: "xl" };
  const workforce: NavItem = { href: "/workforce", label: "Workforce", icon: "people" };
  const assign: NavItem = { href: "/assign", label: "Assign tasks", icon: "assign" };
  const assignCount: NavItem = { ...assign, label: `Assign tasks${n.unassigned ? ` · ${n.unassigned}` : ""}` };
  const report: NavItem[] = n.listId ? [{ href: `/report/${n.listId}`, label: "PDF report", icon: "pdf" }] : [];
  const form: NavItem = { href: "/form", label: "Form settings", icon: "form" };
  const apps: NavItem[] = n.multiApp ? [{ href: "/apps", label: "All apps", icon: "apps" }] : [];
  if (!n.isManager) return { primary: [dashboard, tasks], create: null as NavItem | null, more: [] as NavItem[], phone: [dashboard, tasks, ...apps], apps };
  return {
    primary: [dashboard, tasks, workforce, assign, ...report],
    create: create as NavItem | null,
    more: [upload, form],
    phone: [dashboard, tasks, create, upload, workforce, assignCount, ...report, form, ...apps],
    apps,
  };
}

export const isActivePath = (path: string, href: string) =>
  href === "/" ? path === "/" : href === "/tasks" ? path === "/tasks" : path.startsWith(href);
