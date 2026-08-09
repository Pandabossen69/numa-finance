"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AuthStage,
  BackButton,
  ErrorText,
  Field,
  NoticeText,
  PrimaryButton,
} from "@/components/auth/AuthUi";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { LOGIN_PATH } from "@/features/auth/routes";

export function ForgotPasswordForm({
  initialEmail = "",
  initialError = null,
}: {
  initialEmail?: string;
  initialError?: string | null;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.status === "check-email") {
        setNotice(result.message);
      }
    });
  }

  return (
    <AuthStage>
      <div className="flex flex-1 flex-col">
        <BackButton href={LOGIN_PATH} />
        <header className="mt-6 space-y-2">
          <h1 className="text-[1.75rem] font-semibold tracking-tight">
            Glömt lösenord
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--numa-muted)]">
            Ange din e-postadress så skickar vi en länk där du väljer ett nytt
            lösenord.
          </p>
        </header>

        <form onSubmit={submit} className="mt-8 flex flex-1 flex-col">
          <div className="space-y-4">
            <Field
              label="E-post"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="namn@mail.com"
              autoFocus
            />
            {error ? <ErrorText>{error}</ErrorText> : null}
            {notice ? <NoticeText>{notice}</NoticeText> : null}
          </div>

          <div className="mt-auto space-y-4 pt-10">
            <PrimaryButton disabled={pending || !email.trim()}>
              {pending
                ? "Skickar…"
                : notice
                  ? "Skicka länken igen"
                  : "Skicka återställningslänk"}
            </PrimaryButton>
            <p className="text-center text-sm text-[var(--numa-muted)]">
              Kom du på lösenordet?{" "}
              <Link
                href={LOGIN_PATH}
                className="font-medium text-[var(--numa-accent)]"
              >
                Logga in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </AuthStage>
  );
}
