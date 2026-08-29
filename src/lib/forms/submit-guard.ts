"use client";

import { useEffect, useRef } from "react";

export type SubmitGuard = {
  /** True when this call owns the write. False means one is already running. */
  tryBegin: () => boolean;
  end: () => void;
  isRunning: () => boolean;
};

/**
 * One in-flight write per form.
 *
 * A `useTransition` pending flag (or a `busy` state) only disables the button
 * on the next render, so a fast double-tap on a phone can fire the action
 * twice and duplicate money. The ref closes that window synchronously, in the
 * same tick as the tap.
 *
 * Pass the form's pending flag and the guard releases itself when the write
 * settles, so callers never have to unwind it by hand.
 */
export function useSubmitGuard(pending?: boolean): SubmitGuard {
  const inFlight = useRef(false);
  const guard = useRef<SubmitGuard>({
    tryBegin: () => {
      if (inFlight.current) return false;
      inFlight.current = true;
      return true;
    },
    end: () => {
      inFlight.current = false;
    },
    isRunning: () => inFlight.current,
  });

  useEffect(() => {
    if (pending === false) guard.current.end();
  }, [pending]);

  return guard.current;
}
