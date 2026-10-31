"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "@/components/Icons";

export function LoginForm({ initialError, area }: { initialError: string | null; area: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: f.get("login"), password: f.get("password") }),
      });
      const j = await res.json();
      if (j.ok) { router.push(j.next); router.refresh(); return; }
      if (j.scope) { router.replace(`/login?reason=scope&name=${encodeURIComponent(j.name)}`); router.refresh(); return; }
      setError(j.error ?? "User ID or password is incorrect.");
    } catch {
      setError("Could not reach the server. Check the connection and try again.");
    }
    setBusy(false);
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <div className="card-hd"><span className="eyebrow">{area}</span><h2>Sign in</h2></div>
      <div className="field"><label htmlFor="uid">User ID</label><input id="uid" name="login" autoComplete="username" autoCapitalize="none" required /></div>
      <div className="field"><label htmlFor="pwd">Password</label><input id="pwd" name="password" type="password" autoComplete="current-password" required /></div>
      {error && <div className="errbox" role="alert"><AlertCircle /><span>{error}</span></div>}
      <button className="btn primary block" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
