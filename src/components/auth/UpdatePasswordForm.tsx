"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AuthStage,
  ErrorText,
  NoticeText,
  PasswordField,
  PrimaryButton,
} from "@/components/auth/AuthUi";
import { updatePasswordAction } from "@/features/auth/actions";
import { AUTH_COPY } from "@/features/auth/messages";
import {
  HOME_PATH,
  PASSWORD_RESET_REQUEST_PATH,
} from "@/features/auth/routes";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

type LinkState = "checking" | "ready" | "missing" | "unconfigured";

export function UpdatePasswordForm() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [linkState, setLinkState] = useState<LinkState>(
    configured ? "checking" : "unconfigured",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!configured) return;

    let active = true;
    // Constructing the browser client also consumes recovery tokens that
    // Supabase puts in the URL fragment, which never reaches the server.
    const supabase = createSupabaseBrowserClient();
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active && session) setLinkState("ready");
      },
    );

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) setLinkState(data.session ? "ready" : "missing");
      })
      .catch(() => {
        if (active) setLinkState("missing");
      });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [configured]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await updatePasswordAction({ password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(AUTH_COPY.passwordUpdated);
      router.replace(HOME_PATH);
      router.refresh();
    });
  }

  const strongEnough = password.length >= 8;

  return (
    <AuthStage>
      <div className="flex flex-1 flex-col">
        <header className="mt-6 space-y-2">
          <h1 className="text-[1.75rem] font-semibold tracking-tight">
            Välj nytt lösenord
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
            Skriv in ditt nya lösenord så loggar vi in dig direkt.
          </p>
        </header>

        {linkState === "checking" ? (
          <p className="mt-8 text-[15px] text-[var(--numa-muted)]">
            Kontrollerar länken…
          </p>
        ) : null}

        {linkState === "unconfigured" ? (
          <div className="mt-8">
            <ErrorText>{AUTH_COPY.notConfigured}</ErrorText>
          </div>
        ) : null}

        {linkState === "missing" ? (
          <div className="mt-8 flex flex-1 flex-col">
            <ErrorText>{AUTH_COPY.recoveryLinkExpired}</ErrorText>
            <div className="mt-auto pt-10">
              <Link
                href={PASSWORD_RESET_REQUEST_PATH}
                className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white transition active:scale-[0.99]"
              >
                Begär en ny länk
              </Link>
            </div>
          </div>
        ) : null}

        {linkState === "ready" ? (
          <form onSubmit={submit} className="mt-8 flex flex-1 flex-col">
            <PasswordField
              label="Nytt lösenord"
              autoComplete="new-password"
              value={password}
              show={showPassword}
              onChange={setPassword}
              onToggle={() => setShowPassword((v) => !v)}
              autoFocus
            />
            <p
              className={`mt-3 text-sm ${
                strongEnough
                  ? "text-[var(--numa-positive)]"
                  : "text-[var(--numa-faint)]"
              }`}
            >
              Minst 8 tecken
            </p>
            {error ? (
              <div className="mt-3">
                <ErrorText>{error}</ErrorText>
              </div>
            ) : null}
            {notice ? (
              <div className="mt-3">
                <NoticeText>{notice}</NoticeText>
              </div>
            ) : null}

            <div className="mt-auto pt-10">
              <PrimaryButton disabled={pending || !strongEnough}>
                {pending ? "Sparar…" : "Spara nytt lösenord"}
              </PrimaryButton>
            </div>
          </form>
        ) : null}
      </div>
    </AuthStage>
  );
}
