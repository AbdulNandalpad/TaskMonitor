import type { Ctx } from "./auth";
import { ROLE_LABEL } from "./roles";

/** What the desktop top bar needs from the signed-in context. */
export type NavInfo = { area: string; user: string; role: string; isManager: boolean; listId: string | null };

export const navOf = (ctx: Ctx, listId?: string | null): NavInfo => ({
  area: ctx.area.name,
  user: ctx.profile.display_name,
  role: ROLE_LABEL[ctx.role],
  isManager: ctx.isManager,
  listId: listId ?? null,
});
