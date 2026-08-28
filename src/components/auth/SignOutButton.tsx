"use client";

import { signOutAction } from "@/features/auth/actions";
import { clearClientSessionMemory } from "@/features/home/clear-session-memory";

export function SignOutButton({
  className,
  children = "Logga ut",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <form
      action={async () => {
        clearClientSessionMemory();
        await signOutAction();
      }}
    >
      <button
        type="submit"
        className={
          className ??
          "flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-[var(--numa-danger)] transition hover:bg-[var(--numa-danger-soft)]/70"
        }
      >
        {children}
      </button>
    </form>
  );
}
