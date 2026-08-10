"use client";

import { useEffect } from "react";

/**
 * If main stays empty after paint (poisoned SW / failed RSC), hard-send to /laga.
 * Only runs once per session.
 */
export function BlankScreenGuard() {
  useEffect(() => {
    const key = "numa.blankGuard.v1";
    try {
      if (sessionStorage.getItem(key) === "1") return;
    } catch {
      // ignore
    }

    const timer = window.setTimeout(() => {
      const main = document.querySelector("main");
      if (!main) return;
      const text = (main.textContent ?? "").replace(/\s+/g, " ").trim();
      // Safety strip alone is ~20–40 chars; real pages are longer.
      // Empty / near-empty main means the route body failed.
      if (text.length >= 8) return;
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // ignore
      }
      window.location.replace(`/laga?from=blank&r=${Date.now()}`);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
