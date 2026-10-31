import { createClient } from "@/lib/supabase/server";
import { AREA_CODE } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string; name?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: areaName } = await supabase.rpc("public_area_name", { p_code: AREA_CODE });
  const area = (areaName as string | null) ?? AREA_CODE.toUpperCase();
  const scopeError = sp.reason === "scope" ? `${sp.name ?? "This account"} is not scoped to ${area}. Access is granted per area by the administrator.` : null;
  return (
    <AuthShell>
      <LoginForm initialError={scopeError} area={area} />
    </AuthShell>
  );
}
