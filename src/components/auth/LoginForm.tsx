"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction, signUpAction } from "@/features/auth/actions";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        mode === "in"
          ? await signInAction({ email, password })
          : await signUpAction({ email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/idag");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2 rounded-2xl bg-[var(--numa-accent-soft)] p-1">
        <ModeButton active={mode === "in"} onClick={() => setMode("in")}>
          Logga in
        </ModeButton>
        <ModeButton active={mode === "up"} onClick={() => setMode("up")}>
          Skapa konto
        </ModeButton>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          E-post
        </span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-[var(--numa-faint)]">
          Lösenord
        </span>
        <input
          type="password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-12 w-full rounded-2xl border border-[var(--numa-border)] bg-transparent px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--numa-accent)]"
        />
      </label>

      {error ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Vänta…" : mode === "in" ? "Logga in" : "Skapa konto"}
      </button>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 flex-1 rounded-xl text-sm font-medium transition ${
        active
          ? "bg-[var(--numa-surface-solid)] text-[var(--numa-ink)] shadow-sm"
          : "text-[var(--numa-muted)]"
      }`}
    >
      {children}
    </button>
  );
}
