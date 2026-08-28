"use client";

import { useState, useTransition } from "react";
import { createUserAction } from "@/features/admin/actions";
import { CREATE_USER_SUCCESS_SV } from "@/features/admin/create-user";
import {
  EMAIL_INVALID_MESSAGE,
  isPlausibleEmail,
  swedishEmailConstraintMessage,
} from "@/domain/identity/email";

export function CreateUserForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    password: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!isPlausibleEmail(form.email)) {
      setError(EMAIL_INVALID_MESSAGE);
      return;
    }
    startTransition(async () => {
      const result = await createUserAction({
        email: form.email,
        password: form.password,
        displayName: form.displayName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(`${CREATE_USER_SUCCESS_SV} (${result.email})`);
      setForm({ email: "", displayName: "", password: "" });
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field
        label="E-post"
        type="email"
        autoComplete="off"
        value={form.email}
        onChange={(v) => setForm((f) => ({ ...f, email: v }))}
        placeholder="namn@mail.com"
        required
      />
      <Field
        label="Visningsnamn (valfritt)"
        type="text"
        autoComplete="off"
        value={form.displayName}
        onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
        placeholder="t.ex. Jordan"
      />
      <PasswordField
        label="Lösenord"
        value={form.password}
        show={showPassword}
        onChange={(v) => setForm((f) => ({ ...f, password: v }))}
        onToggle={() => setShowPassword((v) => !v)}
      />
      <p className="text-[12px] leading-relaxed text-[var(--numa-faint)]">
        Du sätter lösenordet och skickar inloggningen till personen. Första
        inloggningen börjar med saldo — inte en tom Hem.
      </p>
      {error ? (
        <p
          className="rounded-2xl bg-[color-mix(in_srgb,var(--numa-danger)_12%,transparent)] px-3 py-2.5 text-sm leading-relaxed text-[var(--numa-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="break-words rounded-2xl bg-[color-mix(in_srgb,var(--numa-positive)_14%,transparent)] px-3 py-2.5 text-sm leading-relaxed text-[var(--numa-positive)]"
          role="status"
        >
          {success}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !form.email.trim() || form.password.length < 8}
        className="flex min-h-14 w-full items-center justify-center rounded-[1.25rem] bg-[var(--numa-accent)] text-[15px] font-semibold text-white transition hover:bg-[var(--numa-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)] focus-visible:ring-offset-2 enabled:active:scale-[0.99] disabled:opacity-45"
      >
        {pending ? "Skapar…" : "Skapa användare"}
      </button>
    </form>
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
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
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
        required={required}
        className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 text-[16px] text-[var(--numa-ink)] transition outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
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
}: {
  label: string;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
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
          autoComplete="new-password"
          required
          minLength={8}
          className="min-h-14 w-full rounded-[1.15rem] border border-[var(--numa-border)] bg-[var(--numa-bg)] px-4 pr-20 text-[16px] text-[var(--numa-ink)] transition outline-none focus:border-[var(--numa-accent)] focus:ring-2 focus:ring-[var(--numa-accent)]/25"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-1/2 right-2 -translate-y-1/2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-medium text-[var(--numa-accent)] transition hover:text-[var(--numa-accent-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--numa-accent)]"
        >
          {show ? "Dölj" : "Visa"}
        </button>
      </div>
      <p
        className={`mt-2 text-sm ${
          value.length >= 8 ? "text-[var(--numa-positive)]" : "text-[var(--numa-faint)]"
        }`}
      >
        Minst 8 tecken
      </p>
    </label>
  );
}
