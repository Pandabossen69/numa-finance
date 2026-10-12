"use client";

import { useEffect, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import {
  LOGIN_BOOT_TIMEOUT_MS,
  LoginBoot,
  clearLoginBoot,
  paintLoginBoot,
} from "@/components/auth/LoginBoot";
import { completePasswordResetAction } from "@/features/auth/actions";
import {
  PASSWORD_RESET_RATE_LIMIT_MESSAGE,
  RECOVERY_LINK_INVALID_MESSAGE,
  validateNewPassword,
} from "@/features/auth/password-reset";
import { recoveryLinkFromLocation } from "@/features/auth/recovery-link";
import { publishBankMailPendingCount } from "@/features/imports/bank-mail-queue-refresh";
import { readHomeSnapshot } from "@/lib/numa/read-client";
import { hasPreviewEscape, withPreviewQuery } from "@/lib/site";
import {
  bindSessionOwner,
  invalidateHomeSessionPaint,
  rememberHomeSnapshot,
} from "@/features/home/last-snapshot";
import { scheduleQuietMenuWarm } from "@/lib/nav/quiet-menu-warm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "ready" | "invalid" | "rate-limit";

function kickPostLoginWarm() {
  scheduleQuietMenuWarm({ restart: true });
  void readHomeSnapshot().then((result) => {
    if (result.ok) {
      rememberHomeSnapshot(result.data);
      publishBankMailPendingCount(result.pendingBankMailCount);
    }
  });
}

export function NewPasswordScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Mode>(mode);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    router.prefetch("/idag");
    router.prefetch("/kom-igang");
  }, [router]);

  useEffect(() => {
    if (!booting) return;
    const id = window.setTimeout(() => {
      setBooting(false);
      clearLoginBoot();
    }, LOGIN_BOOT_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [booting]);

  useEffect(() => {
    if (mode !== "invalid") return;
    const link = recoveryLinkFromLocation(window.location.search, window.location.hash);
    if (link.kind !== "hash-session") return;
    let cancelled = false;
    let unsubscribe = () => {};
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (event === "PASSWORD_RECOVERY" || session) setPhase("ready");
      });
      unsubscribe = () => data.subscription.unsubscribe();
      void supabase.auth.getSession().then(({ data: sessionData }) => {
        if (!cancelled && sessionData.session) setPhase("ready");
      });
    } catch {
      return;
    }
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [mode]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const local = validateNewPassword(password, confirm);
    setError(local);
    if (local) return;
    clearLoginBoot();
    startTransition(async () => {
      const result = await completePasswordResetAction({ password, confirm });
      if (!result.ok) {
        clearLoginBoot();
        setBooting(false);
        setError(result.error);
        if (result.error === RECOVERY_LINK_INVALID_MESSAGE) setPhase("invalid");
        return;
      }
      flushSync(() => {
        setBooting(true);
      });
      paintLoginBoot();
      bindSessionOwner(result.userId);
      invalidateHomeSessionPaint();
      kickPostLoginWarm();
      const preview =
        typeof document !== "undefined" &&
        hasPreviewEscape(new URLSearchParams(window.location.search), document.cookie);
      router.replace(preview ? withPreviewQuery(result.nextPath) : result.nextPath);
    });
  }

  if (phase === "invalid" || phase === "rate-limit") {
    const text =
      phase === "rate-limit"
        ? PASSWORD_RESET_RATE_LIMIT_MESSAGE
        : RECOVERY_LINK_INVALID_MESSAGE;
    return (
      <AuthCard title="Ny länk behövs" sub={text}>
        <p className="auth-access-note">
          <Link href="/glomt-losenord" className="auth-text-link">
            Be om en ny länk
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <div aria-busy={booting || pending || undefined}>
      {booting ? <LoginBoot announced={false} /> : null}
      <AuthCard title="Nytt lösenord" sub="Välj ett lösenord med minst 8 tecken.">
        <form onSubmit={submit} className="auth-form">
          <div className="auth-fields">
            <PasswordField
              label="Nytt lösenord"
              value={password}
              show={show}
              autoComplete="new-password"
              onChange={setPassword}
              onToggle={() => setShow((value) => !value)}
            />
            <PasswordField
              label="Upprepa lösenord"
              value={confirm}
              show={show}
              autoComplete="new-password"
              onChange={setConfirm}
              onToggle={() => setShow((value) => !value)}
            />
          </div>
          <div className="auth-error-slot" aria-live="polite">
            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={pending || !password || !confirm}
            className="auth-primary-button"
          >
            {pending ? "Sparar…" : "Spara lösenord"}
          </button>
        </form>
      </AuthCard>
    </div>
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
  onChange: (value: string) => void;
  onToggle: () => void;
  autoComplete: string;
}) {
  return (
    <label className="auth-label">
      <span className="auth-label-text">{label}</span>
      <span className="auth-field-wrap">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
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
