"use client";

import { signOutAction } from "@/features/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-[var(--numa-danger)] transition hover:bg-[var(--numa-danger-soft)]/70"
      >
        Logga ut
      </button>
    </form>
  );
}
