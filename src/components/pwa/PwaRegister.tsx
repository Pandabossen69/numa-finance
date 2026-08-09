"use client";

import { useEffect } from "react";

/** Registers a minimal service worker for installability / offline shell. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures in unsupported environments.
    });
  }, []);

  return null;
}
