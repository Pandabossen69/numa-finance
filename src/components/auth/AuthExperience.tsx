"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AuthStage,
  BackButton,
  ErrorText,
  Field,
  NoticeText,
  PasswordField,
  PrimaryButton,
  StepDots,
} from "@/components/auth/AuthUi";
import { signInAction, signUpAction } from "@/features/auth/actions";
import { AUTH_COPY } from "@/features/auth/messages";
import {
  HOME_PATH,
  PASSWORD_RESET_REQUEST_PATH,
} from "@/features/auth/routes";

type Screen =
  | "welcome"
  | "login"
  | "signup-email"
  | "signup-password"
  | "check-email";

export function AuthExperience({
  initialScreen = "welcome",
  initialError = null,
}: {
  initialScreen?: "welcome" | "login";
  initialError?: string | null;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
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
      router.replace(HOME_PATH);
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
      if (result.status === "check-email") {
        setNotice(result.message);
        setScreen("check-email");
        return;
      }
      router.replace(HOME_PATH);
      router.refresh();
    });
  }

  function goToPasswordReset() {
    const query = email.trim()
      ? `?epost=${encodeURIComponent(email.trim())}`
      : "";
    router.push(`${PASSWORD_RESET_REQUEST_PATH}${query}`);
  }

  return (
    <AuthStage>
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
          onForgotPassword={goToPasswordReset}
        />
      ) : null}

      {screen === "signup-email" ? (
        <SignupEmailScreen
          email={email}
          error={error}
          onBack={() => go("welcome")}
          onEmail={setEmail}
          onContinue={() => {
            if (!email.trim() || !email.includes("@")) {
              setError(AUTH_COPY.invalidEmail);
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

      {screen === "check-email" ? (
        <CheckEmailScreen
          email={email}
          message={notice ?? AUTH_COPY.confirmEmail}
          onLogin={() => go("login")}
        />
      ) : null}
    </AuthStage>
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
          Håll koll på pengarna — tryggt och enkelt.
        </p>
        <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-[var(--numa-muted)]">
          Se vad som är ledigt, vad som är reserverat och hur mycket du kan
          spendera idag.
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
  onForgotPassword,
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
  onForgotPassword: () => void;
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
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onForgotPassword}
              className="min-h-11 text-sm font-medium text-[var(--numa-accent)]"
            >
              Glömt lösenord?
            </button>
          </div>
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

      <div className="mt-8 flex flex-1 flex-col">
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
          <PrimaryButton
            type="button"
            disabled={!email.trim()}
            onClick={onContinue}
          >
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
      </div>
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

function CheckEmailScreen({
  email,
  message,
  onLogin,
}: {
  email: string;
  message: string;
  onLogin: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mt-6 space-y-2">
        <h1 className="text-[1.75rem] font-semibold tracking-tight">
          Kolla din e-post
        </h1>
        {email ? (
          <p className="text-[15px] text-[var(--numa-muted)]">
            Vi skickade ett mejl till{" "}
            <span className="text-[var(--numa-ink)]">{email}</span>
          </p>
        ) : null}
      </header>

      <div className="mt-6">
        <NoticeText>{message}</NoticeText>
      </div>

      <div className="mt-auto space-y-4 pt-10">
        <PrimaryButton type="button" onClick={onLogin}>
          Till inloggningen
        </PrimaryButton>
      </div>
    </div>
  );
}
