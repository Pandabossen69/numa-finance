"use client";

import { useState, useTransition } from "react";
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
    <div className="auth-stage relative flex min-h-dvh flex-col overflow-hidden">
      <div className="auth-glow" aria-hidden />

      <div className="numa-shell relative z-10 flex flex-1 flex-col px-5 pt-[max(1.5rem,var(--numa-safe-top))] pb-[max(1.5rem,var(--numa-safe-bottom))]">
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
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-end pb-10">
        <p className="text-[2.75rem] leading-none font-semibold tracking-[-0.05em]">
          NUMA
        </p>
        <p className="mt-5 max-w-[18ch] text-[1.35rem] leading-snug font-medium tracking-tight text-[var(--numa-ink)]">
          Håll koll på pengarna — enkelt varje dag.
        </p>
        <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Se vad som är ledigt, vad som är reserverat och hur mycket du kan spendera idag.
        </p>
        <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-[var(--numa-faint)]">
          Alla konton använder samma app-länk:{" "}
          <span className="font-semibold text-[var(--numa-muted)]">
            numa-finance.vercel.app
          </span>
          . Lägg till på hemskärmen därifrån.
        </p>
      </div>

      <div className="space-y-3" style={{ animationDelay: "80ms" }}>
        <button
          type="button"
          onClick={onLogin}
          className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white transition active:scale-[0.99]"
        >
          Logga in
        </button>
        <p className="px-2 text-center text-[13px] leading-relaxed text-[var(--numa-faint)]">
          Konto skapas av NUMA. Har du fått e-post och lösenord, logga in här.
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
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />
      <header className="mt-6 space-y-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Logga in</h1>
        <p className="text-[15px] text-[var(--numa-muted)]">
          Logga in med e-post och lösenord.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-8 flex flex-1 flex-col">
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

        <div className="mt-auto space-y-4 pt-10">
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
      className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-[var(--numa-muted)]"
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
        className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-[16px] transition outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
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
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 pr-20 text-[16px] transition outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-1/2 right-2 inline-flex min-h-11 -translate-y-1/2 items-center rounded-lg px-2 text-sm font-medium text-[var(--numa-accent)]"
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
      className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white transition enabled:active:scale-[0.99] disabled:opacity-45"
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
