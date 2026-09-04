"use client";

import { useEffect } from "react";
import {
  PREVIEW_COOKIE,
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
      if (!shouldRedirectToProduction(hostname, params, document.cookie)) {
        if (params.get("preview") === "1") {
          document.cookie = `${PREVIEW_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
        } else if (document.cookie.includes(`${PREVIEW_COOKIE}=1`)) {
          params.set("preview", "1");
          window.history.replaceState(null, "", `${pathname}?${params}${hash}`);
        }
        return;
      }
      const dest = `${PRODUCTION_ORIGIN}${pathname}${search}${hash}`;
      window.location.replace(dest);
    } catch {
      // ignore
    }
  }, []);

  return null;
}
