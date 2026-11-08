"use client";
import { useState } from "react";

type U = { login: string; display_name: string; active: boolean; apps: string[] };
type A = { code: string; name: string; enabled: boolean };

export function AccessClient({ apps, users }: { apps: A[]; users: U[] }) {
  const [rows, setRows] = useState(users);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function toggle(u: U, app: string, on: boolean) {
    const key = `${u.login}:${app}`;
    setBusy(key); setProblem(null);
    try {
      const res = await fetch("/api/admin/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: u.login, app, on }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setProblem(j.error ?? "Could not change access.");
      else setRows((r) => r.map((x) => (x.login === u.login ? { ...x, apps: on ? [...new Set([...x.apps, app])] : x.apps.filter((c) => c !== app) } : x)));
    } catch { setProblem("Could not reach the server."); }
    setBusy(null);
  }

  return (
    <>
      {problem && <div className="errbox" role="alert"><span>{problem}</span></div>}
      <div className="card access-card">
        <table className="access-tbl">
          <thead><tr><th>User</th>{apps.map((a) => <th key={a.code}>{a.name}{a.enabled ? "" : " (off)"}</th>)}</tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.login}>
                <td><b>{u.display_name}</b><small>{u.login}</small></td>
                {apps.map((a) => {
                  const on = u.apps.includes(a.code);
                  const key = `${u.login}:${a.code}`;
                  return (
                    <td key={a.code}>
                      <label className="switch-row">
                        <input type="checkbox" checked={on} disabled={busy === key} onChange={(e) => toggle(u, a.code, e.target.checked)} aria-label={`${a.name} for ${u.display_name}`} />
                        <span>{on ? "Yes" : "No"}</span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
