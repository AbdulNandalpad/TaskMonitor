"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle } from "@/components/Icons";
import { AuthShell } from "@/components/AuthShell";

/** First login: the seeded password must be replaced (min 8 characters). */
export default function PasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("pw")), again = String(f.get("again"));
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== again) return setError("The two passwords do not match.");
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (err) { setError(err.message); setBusy(false); return; }
    const { data } = await supabase.auth.getUser();
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", data.user!.id);
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell>
      <form className="login-card" onSubmit={submit}>
        <div className="card-hd"><h2>Choose a new password</h2><p>Your first sign-in uses a temporary password. Set your own to continue.</p></div>
        <div className="field"><label htmlFor="pw">New password</label><input id="pw" name="pw" type="password" autoComplete="new-password" minLength={8} required /></div>
        <div className="field"><label htmlFor="again">Repeat new password</label><input id="again" name="again" type="password" autoComplete="new-password" required /></div>
        {error && <div className="errbox" role="alert"><AlertCircle /><span>{error}</span></div>}
        <button className="btn primary block" type="submit" disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
      </form>
    </AuthShell>
  );
}
