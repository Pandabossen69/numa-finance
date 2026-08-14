"use client";

import { signOutAction } from "@/features/auth/actions";

export function SignOutButton({
  variant = "row",
}: {
  variant?: "row" | "header" | "nav";
}) {
  const className =
    variant === "header"
      ? "min-h-9 rounded-full px-3 text-[13px] font-semibold text-[var(--numa-danger)] transition hover:bg-[var(--numa-danger-soft)]/70"
      : variant === "nav"
        ? "w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-[var(--numa-danger)] transition hover:bg-[var(--numa-danger-soft)]/70"
        : "flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-[var(--numa-danger)] transition hover:bg-[var(--numa-danger-soft)]/70";

  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        Logga ut
      </button>
    </form>
  );
}
