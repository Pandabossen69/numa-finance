"use client";

import { useEffect, useRef } from "react";

export type SubmitGuard = {
  /** True when this call owns the write. False means one is already running. */
  tryBegin: () => boolean;
  end: () => void;
  isRunning: () => boolean;
};

/** The lock itself, with no React in it, so it can be tested directly. */
export function createSubmitLock(): SubmitGuard {
  let inFlight = false;
  return {
    tryBegin: () => {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
    end: () => {
      inFlight = false;
    },
    isRunning: () => inFlight,
  };
}

/**
 * One in-flight write per form.
 *
 * A `useTransition` pending flag (or a `busy` state) only disables the button
 * on the next render, so a fast double-tap on a phone can fire the action
 * twice and duplicate money. The lock closes that window synchronously, in
 * the same tick as the tap.
 *
 * Pass the form's pending flag and the guard releases itself when the write
 * settles, so callers never have to unwind it by hand.
 */
export function useSubmitGuard(pending?: boolean): SubmitGuard {
  const guard = useRef<SubmitGuard | null>(null);
  if (!guard.current) guard.current = createSubmitLock();
  const lock = guard.current;

  useEffect(() => {
    if (pending === false) lock.end();
  }, [pending, lock]);

  return lock;
}
