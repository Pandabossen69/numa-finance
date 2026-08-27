"use client";

import { signOutAction } from "@/features/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="numa-press flex min-h-11 w-full items-center justify-start text-[15px] font-medium text-[var(--numa-danger)]"
      >
        Logga ut
      </button>
    </form>
  );
}
