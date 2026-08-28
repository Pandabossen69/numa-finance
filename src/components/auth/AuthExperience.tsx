"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/features/auth/actions";
import { swedishEmailConstraintMessage } from "@/domain/identity/email";

type Screen = "welcome" | "login";

export function AuthExperience() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch("/kom-igang");
    router.prefetch("/idag");
  }, [router]);

  function go(next: Screen) {
    setError(null);
    setScreen(next);
  }

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

      <div className="relative z-10 mx-auto flex w-full flex-1 flex-col justify-center px-4 py-[max(1.25rem,var(--numa-safe-top))] pb-[max(1.25rem,var(--numa-safe-bottom))] sm:px-6">
        {screen === "welcome" ? <WelcomeScreen onLogin={() => go("login")} /> : null}

        {screen === "login" ? (
          <LoginScreen
            email={email}
            password={password}
            showPassword={showPassword}
            error={error}
            pending={pending}
            onBack={() => go("welcome")}
            onEmail={setEmail}
            onPassword={setPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
            onSubmit={submitLogin}
          />
        ) : null}
      </div>
    </div>
  );
}

function WelcomeScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="auth-card auth-welcome mx-auto w-full">
      <div className="auth-card-copy auth-welcome-copy">
        <p className="auth-mark">NUMA</p>
        <p className="auth-welcome-line">
          Se vad du kan använda idag — och vad som behöver ligga kvar.
        </p>
      </div>
      <div className="auth-card-action">
        <button
          type="button"
          onClick={onLogin}
          className="auth-primary-button"
        >
          Logga in
        </button>
        <p className="auth-access-note">
          Konto skapas av NUMA · använd uppgifterna du fått.
        </p>
      </div>
    </div>
  );
}

function LoginScreen({
  email,
  password,
  showPassword,
  error,
  pending,
  onBack,
  onEmail,
  onPassword,
  onTogglePassword,
  onSubmit,
}: {
  email: string;
  password: string;
  showPassword: boolean;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="auth-card mx-auto w-full">
      <div className="auth-card-copy">
        <BackButton onClick={onBack} />
        <p className="auth-mark mt-6 md:mt-0">NUMA</p>
        <header className="mt-4 space-y-2">
          <h1 className="auth-login-title">Logga in</h1>
          <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
            Logga in med e-post och lösenord.
          </p>
        </header>
      </div>

      <form onSubmit={onSubmit} className="auth-card-action flex flex-col">
        <div className="space-y-5">
          <Field
            label="E-post"
            type="email"
            autoComplete="email"
            value={email}
            onChange={onEmail}
            placeholder="namn@mail.com"
          />
          <PasswordField
            label="Lösenord"
            autoComplete="current-password"
            value={password}
            show={showPassword}
            onChange={onPassword}
            onToggle={onTogglePassword}
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
        </div>

        <div className="mt-8 space-y-4">
          <PrimaryButton disabled={pending || !email || !password}>
            {pending ? "Loggar in…" : "Logga in"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-[var(--numa-muted)] transition hover:text-[var(--numa-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2"
      aria-label="Tillbaka"
    >
      <span aria-hidden className="text-lg leading-none">
        ←
      </span>
      Tillbaka
    </button>
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
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
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
        autoFocus={autoFocus}
        required
        className="min-h-14 w-full rounded-full border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] transition outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/18"
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
  autoFocus,
}: {
  label: string;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
  autoComplete?: string;
  autoFocus?: boolean;
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
          autoFocus={autoFocus}
          required
          minLength={8}
          className="min-h-14 w-full rounded-full border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 pr-20 text-[16px] transition outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/18"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-1/2 right-2 -translate-y-1/2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-2 text-sm font-medium text-[var(--numa-accent)] transition hover:text-[var(--numa-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)]"
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
  type = "submit",
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="auth-primary-button"
    >
      {children}
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-danger)_12%,transparent)] px-3 py-2.5 text-sm leading-relaxed text-[var(--numa-danger)]"
      role="alert"
    >
      {children}
    </p>
  );
}
