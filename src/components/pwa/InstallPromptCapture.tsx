"use client";

import { useEffect } from "react";
import { beginInstallPromptCapture } from "@/lib/pwa/install-prompt";

// Capture as soon as this client module evaluates — BIP often fires before Mer.
if (typeof window !== "undefined") {
  beginInstallPromptCapture();
}

/** Root-shell listener. Renders nothing; never nags. */
export function InstallPromptCapture() {
  useEffect(() => beginInstallPromptCapture(), []);
  return null;
}
