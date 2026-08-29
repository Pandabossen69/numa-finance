"use client";

import { signOutAction } from "@/features/auth/actions";
import { clearClientSessionCaches } from "@/features/home/last-snapshot";

export function SignOutForm({ children }: { children: React.ReactNode }) {
  return (
    <form
      action={signOutAction}
      onSubmit={() => {
        clearClientSessionCaches();
      }}
    >
      {children}
    </form>
  );
}

export function SignOutButton() {
  return (
    <SignOutForm>
      <button
        type="submit"
        className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-[var(--numa-danger)] transition hover:bg-[var(--numa-danger-soft)]/70"
      >
        Logga ut
      </button>
    </SignOutForm>
  );
}
