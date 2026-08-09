"use client";

import { signOutAction } from "@/features/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[var(--numa-border)] text-sm font-medium"
      >
        Logga ut
      </button>
    </form>
  );
}
