"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/features/auth/actions";
import { swedishEmailConstraintMessage } from "@/domain/identity/email";

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
    startTransition(async () => {
      const result = await signInAction({ email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(result.nextPath);
      router.refresh();
    });
  }

  return (
    <div className="auth-stage">
      <div className="auth-glow" aria-hidden />

      <div className="auth-frame">
        <div className="auth-hero">
          <p className="auth-mark">NUMA</p>
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
