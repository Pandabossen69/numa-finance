"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { swedishEmailConstraintMessage } from "@/domain/identity/email";

function applySwedishEmailValidity(input: HTMLInputElement) {
  input.setCustomValidity("");
  input.setCustomValidity(swedishEmailConstraintMessage(input.validity));
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
    });
  }

  return (
    <AuthCard title="Glömt lösenord" sub="Vi skickar en länk om adressen finns hos NUMA.">
      <form onSubmit={submit} className="auth-form">
        <div className="auth-fields">
          <label className="auth-label">
            <span className="auth-label-text">E-post</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                applySwedishEmailValidity(event.currentTarget);
                setEmail(event.target.value);
              }}
              onInvalid={(event) => applySwedishEmailValidity(event.currentTarget)}
              placeholder="namn@mail.com"
              required
              className="auth-field"
            />
          </label>
        </div>
        <div className="auth-error-slot" aria-live="polite">
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          {message ? <p className="auth-login-sub">{message}</p> : null}
        </div>
        <button
          type="submit"
          disabled={pending || !email.trim()}
          className="auth-primary-button"
        >
          {pending ? "Skickar…" : "Skicka länk"}
        </button>
        <p className="auth-access-note">
          <Link href="/logga-in" className="auth-text-link">
            Tillbaka till Logga in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
