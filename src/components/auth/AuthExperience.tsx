"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearLoginBoot } from "@/components/auth/LoginBoot";
import { signInAction } from "@/features/auth/actions";
import { fetchHomeSnapshot } from "@/features/finance/home-snapshot-client";
import { hasPreviewEscape, withPreviewQuery } from "@/lib/site";
import { swedishEmailConstraintMessage } from "@/domain/identity/email";
import {
  bindSessionOwner,
  enableHomeLoginShell,
  invalidateHomeSessionPaint,
  rememberHomeSnapshot,
} from "@/features/home/last-snapshot";
import { BRAND_MARK } from "@/lib/brand-assets";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

/** Hem first — quiet Plan/Analys/Rörelser only after live money is ready. */
function kickPostLoginWarm() {
  void fetchHomeSnapshot().then((result) => {
    if (!result.ok) return;
    // Start quiet warm before confirm emit so keep-alive menu fallbacks
    // (afterHemBoot idle) see an inflight bundle instead of racing new IO.
    scheduleQuietMenuWarm({ restart: true, urgent: true });
    rememberHomeSnapshot(result.data);
  });
}

export function AuthExperience() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch("/kom-igang");
    router.prefetch("/idag");
  }, [router]);

  function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    clearLoginBoot();
    startTransition(async () => {
      const result = await signInAction({ email, password });
      if (!result.ok) {
        clearLoginBoot();
        setError(result.error);
        return;
      }
      // Wipe last-known only when the account actually changed — same-user
      // re-login must keep Plan/Analys caches so menus stay ~0ms (NextStep).
      // Hem money still needs a live confirm (#107) — but same-user last-known
      // paints as a provisional shell. Never paint "Loggar in i NUMA…" over
      // the snapshot fetch (Christian-bar ≤300ms / hard-fail multi-second).
      bindSessionOwner(result.userId);
      invalidateHomeSessionPaint();
      enableHomeLoginShell();
      kickPostLoginWarm();
      clearLoginBoot();
      const preview =
        typeof document !== "undefined" &&
        hasPreviewEscape(new URLSearchParams(window.location.search), document.cookie);
      // Soft replace — Hem shell/skeleton paints under AppShell immediately.
      router.replace(preview ? withPreviewQuery(result.nextPath) : result.nextPath);
    });
  }

  return (
    <div className="auth-stage" aria-busy={pending || undefined}>
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
          <form onSubmit={submitLogin} className="auth-form">
            <header className="auth-card-header">
              <h1 className="auth-login-title">Logga in</h1>
              <p className="auth-login-sub">Logga in med e-post och lösenord.</p>
            </header>

            <div className="auth-fields">
              <Field
                label="E-post"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                placeholder="namn@mail.com"
              />
              <PasswordField
                label="Lösenord"
                autoComplete="current-password"
                value={password}
                show={showPassword}
                onChange={setPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />
            </div>

            <div className="auth-error-slot" aria-live="polite">
              {error ? <p className="auth-error">{error}</p> : null}
            </div>

            <button
              type="submit"
              disabled={pending || !email || !password}
              className="auth-primary-button"
            >
              {pending ? "Loggar in…" : "Logga in"}
            </button>
            <p className="auth-access-note">
              Konto skapas av NUMA · använd uppgifterna du fått.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function applySwedishEmailValidity(input: HTMLInputElement) {
  input.setCustomValidity("");
  input.setCustomValidity(swedishEmailConstraintMessage(input.validity));
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const isEmail = type === "email";

  return (
    <label className="auth-label">
      <span className="auth-label-text">{label}</span>
      <input
        type={type}
        inputMode={isEmail ? "email" : undefined}
        value={value}
        onChange={(e) => {
          if (isEmail) applySwedishEmailValidity(e.currentTarget);
          onChange(e.target.value);
        }}
        onInvalid={
          isEmail ? (e) => applySwedishEmailValidity(e.currentTarget) : undefined
        }
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="auth-field"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  show,
  onChange,
  onToggle,
  autoComplete,
}: {
  label: string;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
  autoComplete?: string;
}) {
  return (
    <label className="auth-label">
      <span className="auth-label-text">{label}</span>
      <span className="auth-field-wrap">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          minLength={8}
          className="auth-field auth-field-password"
        />
        <button type="button" onClick={onToggle} className="auth-field-toggle">
          {show ? "Dölj" : "Visa"}
        </button>
      </span>
    </label>
  );
}
