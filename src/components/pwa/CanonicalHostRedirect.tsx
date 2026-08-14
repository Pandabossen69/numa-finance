"use client";

import { useEffect } from "react";
import {
  PRODUCTION_ORIGIN,
  shouldRedirectToProduction,
} from "@/lib/site";

/**
 * Safety net if middleware missed a temporary Vercel host (e.g. old SW).
 * Sends the installed phone app to the stable production URL.
 */
export function CanonicalHostRedirect() {
  useEffect(() => {
    try {
      const { hostname, pathname, search, hash } = window.location;
      const params = new URLSearchParams(search);
      if (!shouldRedirectToProduction(hostname, params)) return;
      const dest = `${PRODUCTION_ORIGIN}${pathname}${search}${hash}`;
      window.location.replace(dest);
    } catch {
      // ignore
    }
  }, []);

  return null;
}
