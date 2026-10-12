import type { ReactNode } from "react";
import { BRAND_MARK } from "@/lib/brand-assets";

export function AuthCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-stage">
      <div className="auth-glow" aria-hidden />
      <div className="auth-frame">
        <div className="auth-hero">
          <p className="auth-mark">
            <img
              className="auth-mark-icon"
              src={BRAND_MARK}
              alt=""
              width={40}
              height={40}
            />
            NUMA
          </p>
          <p className="auth-welcome-line">Vad du kan använda idag.</p>
        </div>
        <div className="auth-card">
          <header className="auth-card-header">
            <h1 className="auth-login-title">{title}</h1>
            {sub ? <p className="auth-login-sub">{sub}</p> : null}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
