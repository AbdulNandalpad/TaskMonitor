import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { loadBoard } from "@/lib/data";
import { initials, stats } from "@/lib/format";
import { navOf } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/roles";
import { Bar, Screen } from "@/components/Screen";
import { Assign, Chev, FormIcon, List, Pdf, Plus, SignOut, Xl, People } from "@/components/Icons";
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
  const secStats = sections.map((s) => ({ s, st: stats(tasks.filter((t) => t.section_id === s.id)) }));
  const behind = secStats.filter((x) => x.st.pct < 50);
  const menu = [
    { href: "/tasks/new", icon: <Plus />, label: "Create task" },
    { href: "/tasks", icon: <List />, label: "All tasks" },
    { href: "/import/tasks", icon: <Xl />, label: "Upload tasks (Excel)" },
    { href: "/workforce", icon: <People />, label: "Workforce" },
    { href: "/assign", icon: <Assign />, label: `Assign tasks${all.un ? ` · ${all.un}` : ""}` },
    ...(list ? [{ href: `/report/${list.id}`, icon: <Pdf />, label: "PDF report" }] : []),
    { href: "/form", icon: <FormIcon />, label: "Form settings" },
  ];
  const kpis: { href: string; label: string; n: number; cls?: string }[] = [
    { href: "/tasks", label: "All tasks", n: all.n },
    { href: "/tasks?status=completed", label: "Completed", n: all.done, cls: "good" },
    { href: "/tasks?status=in_progress", label: "In progress", n: all.prog, cls: "warn" },
    { href: "/tasks?status=not_started", label: "Not started", n: all.open, cls: "bad" },
  ];
  return (
    <Screen
      title={ctx.area.name}
      sub={`${ctx.profile.display_name} · ${ROLE_LABEL[ctx.role]}`}
      subPhoneOnly
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
            <div className="card summary o1">
              <div className="sum-hd">
                <div><h3>Shutdown task list</h3><div className="when">{list.name} · {hours} h planned · {sections.length} sections</div></div>
                <div className="bigpct num">{all.pct}%<small>{all.done} of {all.n} tasks complete</small></div>
              </div>
              <Bar {...all} />
            </div>
            <div className="kpis o2">
              {kpis.map((k) => (
                <Link key={k.href} className={`tile${k.cls ? ` ${k.cls}` : ""}`} href={k.href}>
                  <span className="l">{k.label}</span><span className="v num">{k.n}</span>
                </Link>
              ))}
            </div>
            {ctx.isManager && (
              <div className="m-only">
                <div className="sec o3">Menu</div>
                <div className="manage o3">
                  {menu.map((m) => (
                    <Link key={m.href} href={m.href}><span className="ic">{m.icon}</span><b>{m.label}</b></Link>
                  ))}
                </div>
              </div>
            )}
            <div className="sec o4">Sections</div>
            <div className="card sectable o4">
              <div className="srow head d-only" aria-hidden="true">
                <span /><span>Section</span><span className="n">Tasks</span><span className="n">Done</span><span className="n">Not started</span><span>Progress</span><span className="n">%</span><span />
              </div>
              {secStats.map(({ s, st }) => (
                <Link key={s.id} className="srow" href={`/sections/${s.id}`}>
                  <span className="ai">{initials(s.name)}</span>
                  <span className="nm">{s.name}<small className="m-only">{st.n} tasks · {st.done} done · {st.open} not started</small></span>
                  <span className="n num d-only">{st.n}</span>
                  <span className="n num d-only">{st.done}</span>
                  <span className="n num d-only">{st.open}</span>
                  <span className="pb"><Bar {...st} /></span>
                  <span className="pct n num">{st.pct}%{st.pct < 50 ? <span className="flag">Behind</span> : null}</span>
                  <Chev />
                </Link>
              ))}
            </div>
          </div>
          <aside className="dash-side">
            {ctx.isManager ? (
              <div className="card pad attention d-only o3">
                <h3>Needs attention</h3>
                {all.un ? (
                  <Link className="att" href="/assign"><b className="num">{all.un}</b><span>unassigned task{all.un === 1 ? "" : "s"}</span><Chev /></Link>
                ) : null}
                {behind.map(({ s, st }) => (
                  <Link key={s.id} className="att" href={`/sections/${s.id}`}><b className="num">{st.pct}%</b><span>{s.name} · Behind</span><Chev /></Link>
                ))}
                {!all.un && !behind.length ? <div className="note">Every task is assigned and no section is behind.</div> : null}
              </div>
            ) : (
              <Link className="card mytasks o3" href={me ? `/tasks?assignee=${me.id}` : "/tasks"}>
                <b>My tasks</b>
                <span>{mine.done} done · {mine.prog} in progress · {mine.open} not started</span>
                <div className="big num">{mine.n}</div>
              </Link>
            )}
          </aside>
        </div>
      )}
      <MicButton tasks={tasks.map((t) => ({ id: t.id, seq: t.seq, title: String(t.values.work_description ?? "") }))} language={ctx.profile.language} />
    </Screen>
  );
}
