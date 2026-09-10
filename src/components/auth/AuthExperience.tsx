"use client";

import { useEffect, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  LOGIN_BOOT_TIMEOUT_MS,
  LoginBoot,
  clearLoginBoot,
  paintLoginBoot,
} from "@/components/auth/LoginBoot";
import { signInAction } from "@/features/auth/actions";
import { getHomeSnapshotAction } from "@/features/finance/home-snapshot";
import { hasPreviewEscape, withPreviewQuery } from "@/lib/site";
import { swedishEmailConstraintMessage } from "@/domain/identity/email";
import {
  bindSessionOwner,
  rememberHomeSnapshot,
} from "@/features/home/last-snapshot";
import { BRAND_MARK } from "@/lib/brand-assets";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";

function kickPostLoginWarm() {
  scheduleQuietMenuWarm({ restart: true });
  void getHomeSnapshotAction().then((result) => {
    if (result.ok) rememberHomeSnapshot(result.data);
  });
}

export function AuthExperience() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch("/kom-igang");
    router.prefetch("/idag");
  }, [router]);

  useEffect(() => {
    if (!booting) return;
    const id = window.setTimeout(() => {
      setBooting(false);
      clearLoginBoot();
    }, LOGIN_BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [booting]);

  function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    clearLoginBoot();
    startTransition(async () => {
      const result = await signInAction({ email, password });
      if (!result.ok) {
        clearLoginBoot();
        setBooting(false);
        setError(result.error);
        return;
      }
      // Paint the branded boot screen in this turn — before navigation
      // so /idag (Hem) is not a blank white wait.
      flushSync(() => {
        setBooting(true);
      });
      paintLoginBoot();
      // Wipe last-known only when the account actually changed — same-user
      // re-login must keep Plan/Analys/Hem caches so menus stay ~0ms (NextStep).
      bindSessionOwner(result.userId);
      kickPostLoginWarm();
      const preview =
        typeof document !== "undefined" &&
        hasPreviewEscape(new URLSearchParams(window.location.search), document.cookie);
      // Soft replace without refresh — avoid a force-dynamic RSC round-trip
      // while the branded boot overlay is up.
      router.replace(preview ? withPreviewQuery(result.nextPath) : result.nextPath);
    });
  }

  return (
    <div className="auth-stage" aria-busy={booting || pending || undefined}>
      {booting ? <LoginBoot announced={false} /> : null}
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
