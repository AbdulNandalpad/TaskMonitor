export type Role = "area_admin" | "manager" | "field_user" | "viewer";

export const MANAGER_ROLES: Role[] = ["area_admin", "manager"];
/** Form settings is open to every signed-in role for now (agreed with the client on 31 Oct 2026). Tighten here and in form_save(). */
export const FORM_EDIT_ROLES: Role[] = ["area_admin", "manager", "field_user", "viewer"];

export const ROLE_LABEL: Record<Role, string> = {
  area_admin: "Area admin",
  manager: "Manager",
  field_user: "Field user",
  viewer: "Viewer",
};

export const isManagerRole = (r: Role) => MANAGER_ROLES.includes(r);
