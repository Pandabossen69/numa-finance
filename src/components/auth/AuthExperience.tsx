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
    <div className="auth-stage relative flex min-h-dvh flex-col overflow-x-hidden">
      <div className="auth-glow" aria-hidden />

      <div className="auth-frame relative z-10">
        <div className="auth-hero">
          <p className="auth-mark">NUMA</p>
          <p className="auth-welcome-line">Vad du kan använda idag.</p>
        </div>

        <div className="auth-card mx-auto w-full">
          <form onSubmit={submitLogin} className="auth-card-action flex flex-col">
            <header className="space-y-2">
              <h1 className="auth-login-title">Logga in</h1>
              <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
                Logga in med e-post och lösenord.
              </p>
            </header>

            <div className="mt-7 space-y-5">
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
              {error ? <ErrorText>{error}</ErrorText> : null}
            </div>

            <div className="mt-8 space-y-4">
              <PrimaryButton disabled={pending || !email || !password}>
                {pending ? "Loggar in…" : "Logga in"}
              </PrimaryButton>
              <p className="auth-access-note">
                Konto skapas av NUMA · använd uppgifterna du fått.
              </p>
            </div>
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
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
        {label}
      </span>
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
    <label className="block">
      <span className="mb-2 block text-[13px] font-medium text-[var(--numa-muted)]">
        {label}
      </span>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          minLength={8}
          className="auth-field auth-field-password"
        />
        <button
          type="button"
          onClick={onToggle}
          className="auth-field-toggle"
        >
          {show ? "Dölj" : "Visa"}
        </button>
      </div>
    </label>
  );
}

function PrimaryButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={disabled} className="auth-primary-button">
      {children}
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="auth-error" role="alert">
      {children}
    </p>
  );
}
