import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { HUES, initials, stats } from "@/lib/format";
import { navOf } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/roles";
import { Bar, Screen } from "@/components/Screen";
import { Assign, Chev, FormIcon, Pdf, Plus, SignOut, Xl, People } from "@/components/Icons";
import { MicButton } from "@/components/VoiceSheet";
import { BellButton } from "@/components/BellButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const ctx = await requireCtx();
  const { list, sections, persons, tasks } = await loadBoard(ctx);
  const all = stats(tasks);
  const me = persons.find((p) => p.user_id === ctx.userId);
  const mine = stats(tasks.filter((t) => me && t.responsible_person_id === me.id));
  const hours = tasks.reduce((a, t) => a + (Number(t.values.planned_hours) || 0), 0);
  const menu = [
    { href: "/tasks/new", icon: <Plus />, label: "Create task", hue: 1 },
    { href: "/import/tasks", icon: <Xl />, label: "Upload tasks (Excel)", hue: 3 },
    { href: "/workforce", icon: <People />, label: "Workforce", hue: 2 },
    { href: "/assign", icon: <Assign />, label: `Assign tasks${all.un ? ` · ${all.un}` : ""}`, hue: 5 },
    ...(list ? [{ href: `/report/${list.id}`, icon: <Pdf />, label: "PDF report", hue: 0 }] : []),
    { href: "/form", icon: <FormIcon />, label: "Form settings", hue: 6 },
  ];
  return (
    <Screen
      title={ctx.area.name}
      sub={`${ctx.profile.display_name} · ${ROLE_LABEL[ctx.role]}`}
      wide
      nav={navOf(ctx, list?.id)}
      actions={
        <span className="m-only appbar-acts">
          <BellButton open={all.open} unassigned={all.un} />
          <form action="/api/auth/logout" method="post"><button className="iconbtn" type="submit" aria-label="Sign out"><SignOut /></button></form>
        </span>
      }
    >
      {!list ? (
        <div className="card empty"><b>No task list yet</b><span>{ctx.isManager ? "Upload tasks from Excel or create the first task." : "A manager has not set up this area yet."}</span></div>
      ) : (
        <div className="dash">
          <div className="dash-main">
            <div className="card hero o1">
              <div className="top">
                <div><h3>Shutdown task list</h3><div className="when">{list.name} · {hours} h planned · {sections.length} sections</div></div>
                <div className="bigpct num">{all.pct}%<small>{all.done} of {all.n} tasks complete</small></div>
              </div>
              <div style={{ marginTop: 12 }}><Bar {...all} /></div>
              <div className="legend"><span className="g">Completed</span><span className="p">In progress</span><span className="o">Not started</span></div>
            </div>
            <div className="tiles o2">
              <div className="tile good"><div className="v num">{all.done}</div><div className="l">Completed</div></div>
              <div className="tile warn"><div className="v num">{all.prog}</div><div className="l">In progress</div></div>
              <div className="tile bad"><div className="v num">{all.open}</div><div className="l">Not started</div></div>
            </div>
            <div className="sec o4">Sections</div>
            <div className="card arealist o4">
              {sections.map((s, i) => {
                const st = stats(tasks.filter((t) => t.section_id === s.id));
                return (
                  <Link key={s.id} className="area" href={`/sections/${s.id}`}>
                    <span className="ai" style={{ background: HUES[i % HUES.length] }}>{initials(s.name)}</span>
                    <span className="nm">{s.name}</span>
                    <span className="pct num">{st.pct}%</span>
                    <span className="cnt">{st.n} tasks · {st.done} done · {st.open} not started</span>
                    {st.pct < 50 ? <span className="flag">Behind</span> : null}
                    <Bar {...st} />
                    <Chev />
                  </Link>
                );
              })}
            </div>
          </div>
          <aside className="dash-side">
            {ctx.isManager ? (
              <>
                <div className="sec o3">Menu</div>
                <div className="manage o3">
                  {menu.map((m) => (
                    <Link key={m.href} href={m.href}><span className="ic" style={{ background: HUES[m.hue] }}>{m.icon}</span><b>{m.label}</b></Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="card mytasks o3">
                <b>My tasks</b>
                <span>{mine.done} done · {mine.prog} in progress · {mine.open} not started</span>
                <div className="big num">{mine.n}</div>
              </div>
            )}
          </aside>
        </div>
      )}
      <MicButton tasks={tasks.map((t) => ({ id: t.id, seq: t.seq, title: String(t.values.work_description ?? "") }))} language={ctx.profile.language} />
    </Screen>
  );
}
