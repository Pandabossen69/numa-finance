"use client";

import { useEffect } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { BRAND_MARK } from "@/lib/brand-assets";

export const LOGIN_BOOT_TIMEOUT_MS = 12_000;
/** Christian-bar: never leave "Loggar in…" up for multi-seconds. */
export const LOGIN_BOOT_MAX_MS = 300;
const LOGIN_BOOT_HOST_ID = "numa-login-boot";

/**
 * Branded login boot — same auth-stage language as /logga-in.
 * Painted in the success turn so /idag (Hem) is not a blank white wait.
 */
export function LoginBoot({ announced = true }: { announced?: boolean }) {
  return (
    <div
      className="auth-stage auth-boot"
      role="status"
      aria-live={announced ? "polite" : undefined}
      aria-busy="true"
      aria-label="Loggar in i NUMA"
      aria-hidden={announced ? undefined : true}
      data-numa-login-boot="true"
    >
      <div className="auth-glow" aria-hidden />
      <div className="auth-boot-frame">
        <p className="auth-mark">
          <img
            className="auth-mark-icon"
            src={BRAND_MARK}
            alt=""
            width={40}
            height={40}
          />
          NUMA
        </p>
        <p className="auth-boot-title">Loggar in i NUMA…</p>
        <p className="auth-boot-sub">Ett ögonblick.</p>
      </div>
    </div>
  );
}

/** Clears the boot overlay when Hem or onboarding has something to show. */
export function LoginBootClear() {
  useEffect(() => {
    clearLoginBoot();
  }, []);
  return null;
}

let host: HTMLElement | null = null;
let root: Root | null = null;
let timeoutId = 0;

function ensureRoot() {
  if (typeof document === "undefined") return null;
  if (host && root) return root;
  host = document.getElementById(LOGIN_BOOT_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = LOGIN_BOOT_HOST_ID;
    document.body.appendChild(host);
  }
  root = createRoot(host);
  return root;
}

/**
 * Sync paint onto document.body so the branded screen survives AuthExperience
 * unmounting during router.replace("/idag" | "/kom-igang").
 */
export function paintLoginBoot() {
  if (typeof document === "undefined") return;
  const next = ensureRoot();
  if (!next) return;
  flushSync(() => {
    next.render(<LoginBoot />);
  });
  window.clearTimeout(timeoutId);
  timeoutId = window.setTimeout(() => {
    clearLoginBoot();
  }, LOGIN_BOOT_MAX_MS);
}

export function clearLoginBoot() {
  if (typeof window !== "undefined") window.clearTimeout(timeoutId);
  timeoutId = 0;
  if (root) {
    root.unmount();
    root = null;
  }
  host?.remove();
  host = null;
}
