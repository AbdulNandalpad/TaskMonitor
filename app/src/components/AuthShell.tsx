import type { ReactNode } from "react";
import { LogoMark } from "./Logo";

/**
 * Sign-in / password layout: a brand panel on the gradient and the form card. Stacked on a phone (brand on top,
 * card at the bottom), split side by side on a desktop.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <section className="auth-brand" aria-label="Task Monitor">
        <div className="auth-lockup">
          <LogoMark size={64} tone="white" className="auth-mark" />
          <div>
            <h1>Task Monitor</h1>
            <p className="tagline">Create tasks, record by voice, prove with photos, report in one click</p>
          </div>
        </div>
      </section>
      <section className="auth-form">{children}</section>
    </div>
  );
}
