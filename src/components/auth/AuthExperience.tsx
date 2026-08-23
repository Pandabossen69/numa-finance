"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction, signUpAction } from "@/features/auth/actions";
import {
  EMAIL_INVALID_MESSAGE,
  isPlausibleEmail,
  swedishEmailConstraintMessage,
} from "@/domain/identity/email";

type Screen = "welcome" | "login" | "signup-email" | "signup-password";

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
      router.replace("/idag");
      router.refresh();
    });
  }

  function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signUpAction({ email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/idag");
      router.refresh();
    });
  }

  return (
    <div className="auth-stage relative flex min-h-dvh flex-col overflow-hidden">
      <div className="auth-glow" aria-hidden />

      <div className="numa-shell relative z-10 flex flex-1 flex-col px-5 pt-[max(1.5rem,var(--numa-safe-top))] pb-[max(1.5rem,var(--numa-safe-bottom))]">
        {screen === "welcome" ? (
          <WelcomeScreen
            onStart={() => go("signup-email")}
            onLogin={() => go("login")}
          />
        ) : null}

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
            onCreateAccount={() => go("signup-email")}
          />
        ) : null}

        {screen === "signup-email" ? (
          <SignupEmailScreen
            email={email}
            error={error}
            onBack={() => go("welcome")}
            onEmail={setEmail}
            onContinue={() => {
              if (!isPlausibleEmail(email)) {
                setError(EMAIL_INVALID_MESSAGE);
                return;
              }
              go("signup-password");
            }}
            onLogin={() => go("login")}
          />
        ) : null}

        {screen === "signup-password" ? (
          <SignupPasswordScreen
            email={email}
            password={password}
            showPassword={showPassword}
            error={error}
            pending={pending}
            onBack={() => go("signup-email")}
            onPassword={setPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
            onSubmit={submitSignup}
          />
        ) : null}
      </div>
    </div>
  );
}

function WelcomeScreen({
  onStart,
  onLogin,
}: {
  onStart: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-end pb-10">
        <p className="text-[2.75rem] font-semibold leading-none tracking-[-0.05em]">
          NUMA
        </p>
        <p className="mt-5 max-w-[18ch] text-[1.35rem] font-medium leading-snug tracking-tight text-[var(--numa-ink)]">
          Håll koll på pengarna — enkelt varje dag.
        </p>
        <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Se vad som är ledigt, vad som är reserverat och hur mycket du kan
          spendera idag.
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
          onClick={onStart}
          className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white transition active:scale-[0.99]"
        >
          Kom igång
        </button>
        <button
          type="button"
          onClick={onLogin}
          className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] text-[15px] font-medium transition active:scale-[0.99]"
        >
          Jag har redan konto
        </button>
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
  onCreateAccount,
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
  onCreateAccount: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />
      <header className="mt-6 space-y-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">Logga in</h1>
        <p className="text-[15px] text-[var(--numa-muted)]">
          Välkommen tillbaka till NUMA.
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
          <p className="text-center text-sm text-[var(--numa-muted)]">
            Ny här?{" "}
            <button
              type="button"
              onClick={onCreateAccount}
              className="font-medium text-[var(--numa-accent)]"
            >
              Skapa konto
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}

function SignupEmailScreen({
  email,
  error,
  onBack,
  onEmail,
  onContinue,
  onLogin,
}: {
  email: string;
  error: string | null;
  onBack: () => void;
  onEmail: (v: string) => void;
  onContinue: () => void;
  onLogin: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />
      <StepDots current={1} total={2} />
      <header className="mt-6 space-y-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">
          Din e-post
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Vi använder den för att synka din ekonomi säkert mellan enheter.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onContinue();
        }}
        className="mt-8 flex flex-1 flex-col"
        noValidate
      >
        <Field
          label="E-post"
          type="email"
          autoComplete="email"
          value={email}
          onChange={onEmail}
          placeholder="namn@mail.com"
          autoFocus
        />
        {error ? <div className="mt-3"><ErrorText>{error}</ErrorText></div> : null}

        <div className="mt-auto space-y-4 pt-10">
          <PrimaryButton disabled={!email.trim()}>
            Fortsätt
          </PrimaryButton>
          <p className="text-center text-sm text-[var(--numa-muted)]">
            Har du konto?{" "}
            <button
              type="button"
              onClick={onLogin}
              className="font-medium text-[var(--numa-accent)]"
            >
              Logga in
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}

function SignupPasswordScreen({
  email,
  password,
  showPassword,
  error,
  pending,
  onBack,
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
  onPassword: (v: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const strongEnough = password.length >= 8;

  return (
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />
      <StepDots current={2} total={2} />
      <header className="mt-6 space-y-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">
          Välj lösenord
        </h1>
        <p className="text-[15px] text-[var(--numa-muted)]">
          För <span className="text-[var(--numa-ink)]">{email}</span>
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-8 flex flex-1 flex-col">
        <PasswordField
          label="Lösenord"
          autoComplete="new-password"
          value={password}
          show={showPassword}
          onChange={onPassword}
          onToggle={onTogglePassword}
          autoFocus
        />
        <p
          className={`mt-3 text-sm ${
            strongEnough ? "text-[var(--numa-positive)]" : "text-[var(--numa-faint)]"
          }`}
        >
          Minst 8 tecken
        </p>
        {error ? (
          <div className="mt-3">
            <ErrorText>{error}</ErrorText>
          </div>
        ) : null}

        <div className="mt-auto pt-10">
          <PrimaryButton disabled={pending || !strongEnough}>
            {pending ? "Skapar konto…" : "Skapa konto"}
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

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="mt-4 flex gap-1.5" aria-label={`Steg ${current} av ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1 rounded-full transition-all ${
            i + 1 === current
              ? "w-6 bg-[var(--numa-accent)]"
              : i + 1 < current
                ? "w-4 bg-[var(--numa-accent)]/50"
                : "w-4 bg-[var(--numa-border)]"
          }`}
        />
      ))}
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
          isEmail
            ? (e) => applySwedishEmailValidity(e.currentTarget)
            : undefined
        }
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 text-[16px] outline-none transition focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
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
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-surface)] px-4 pr-20 text-[16px] outline-none transition focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--numa-accent)]"
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
