import { createClient } from "@/lib/supabase/server";
import { AREA_CODE } from "@/lib/auth";
import { Logo } from "@/components/Icons";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string; name?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: areaName } = await supabase.rpc("public_area_name", { p_code: AREA_CODE });
  const area = (areaName as string | null) ?? AREA_CODE.toUpperCase();
  const scopeError = sp.reason === "scope" ? `${sp.name ?? "This account"} is not scoped to ${area}. Access is granted per area by the administrator.` : null;
  return (
    <div className="login-wrap">
      <div className="signin">
        <div className="brand">
          <div className="mark"><Logo /></div>
          <div>
            <h1>Task Monitor</h1>
            <span>Create tasks, record by voice, prove with photos, report in one click</span>
          </div>
          <span className="areatag"><span className="dot" />Area · {area}</span>
        </div>
        <LoginForm initialError={scopeError} />
      </div>
    </div>
  );
}
