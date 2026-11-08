import Link from "next/link";
import { requireApp } from "@/lib/apps";
import { LogoMark } from "@/components/Logo";
import { Grid, SignOut } from "@/components/Icons";

export const dynamic = "force-dynamic";

/** Furnace Analysis home. Only people given the app get here; the app itself is built once the vendor report format is known. */
export default async function FurnaceHome() {
  const { profile, apps } = await requireApp("furnace_analysis");
  return (
    <main className="launch">
      <header className="launch-hd">
        <span className="launch-brand"><LogoMark size={30} /><b>Furnace Analysis</b></span>
        <span className="launch-user">{profile.display_name}</span>
        {apps.length > 1 && <Link className="iconbtn" href="/apps" aria-label="All apps" title="All apps"><Grid /></Link>}
        <form action="/api/auth/logout" method="post"><button className="iconbtn" type="submit" aria-label="Sign out" title="Sign out"><SignOut /></button></form>
      </header>
      <section className="launch-body">
        <h1>Furnace Analysis</h1>
        <p className="note">Vendor furnace reports, findings and reminders will live here. This app is being set up.</p>
      </section>
    </main>
  );
}
