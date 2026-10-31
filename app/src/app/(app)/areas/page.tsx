import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AREA_CODE, AREA_COOKIE, requireCtx } from "@/lib/auth";
import { HUES } from "@/lib/format";
import { navOf } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/roles";
import { Screen } from "@/components/Screen";
import { UnitIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

async function choose(formData: FormData) {
  "use server";
  const ctx = await requireCtx({ allowNoArea: true });
  const id = String(formData.get("area"));
  // only areas the user is a member of are selectable
  if (!ctx.memberships.some((m) => m.area.id === id)) redirect("/areas");
  (await cookies()).set(AREA_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
  redirect("/");
}

export default async function AreasPage() {
  const ctx = await requireCtx({ allowNoArea: true });
  const mine = new Set(ctx.memberships.map((m) => m.area.id));
  // other areas exist but are locked for this user; the list of all areas is not readable under RLS, so show the user's own plus this deployment's
  const areas = ctx.memberships.map((m) => ({ ...m.area, role: m.role }));
  return (
    <Screen
      title="Choose an area"
      sub={`${ctx.profile.display_name} · ${ROLE_LABEL[ctx.role]}`}
      short
      nav={{ ...navOf(ctx), isManager: false }}
    >
      <div className="note">Your account is scoped to more than one area. Single‑area accounts skip this screen.</div>
      <div className="unitlist">
        {areas.map((a, i) => (
          <form key={a.id} action={choose}>
            <input type="hidden" name="area" value={a.id} />
            <button className="unit" type="submit" disabled={!mine.has(a.id)}>
              <span className="ui" style={{ background: HUES[i === 0 ? 0 : 2] }}><UnitIcon /></span>
              <b>{a.name}</b>
              <span className={`chip ${a.code === AREA_CODE ? "good" : "info"}`}>{a.code === AREA_CODE ? "Live" : "Open"}</span>
              <small>{ROLE_LABEL[a.role]}</small>
            </button>
          </form>
        ))}
      </div>
    </Screen>
  );
}
