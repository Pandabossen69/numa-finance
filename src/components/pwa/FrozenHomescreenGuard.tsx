"use client";

import { useSyncExternalStore } from "react";
import { isStandaloneDisplay } from "@/lib/pwa/display";
import {
  isFrozenHomescreenHost,
  PRODUCTION_HOST,
  PRODUCTION_ORIGIN,
} from "@/lib/site";

function readBlockedHost(): string | null {
  try {
    if (!isStandaloneDisplay()) return null;
    const host = window.location.hostname;
    if (!isFrozenHomescreenHost(host)) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Home-screen icons installed from a Vercel preview URL never receive new
 * production deploys. Cross-origin redirect often opens Safari instead of
 * fixing the icon — so we block with clear reinstall steps instead.
 */
export function FrozenHomescreenGuard() {
  const blockedHost = useSyncExternalStore(
    () => () => {},
    readBlockedHost,
    () => null,
  );

  if (!blockedHost) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="numa-frozen-title"
      aria-describedby="numa-frozen-desc"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(5, 9, 11, 0.94)",
        color: "#e8f0ec",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "22rem", display: "grid", gap: 14 }}>
        <p
          id="numa-frozen-title"
          style={{ margin: 0, fontSize: "1.25rem", fontWeight: 650 }}
        >
          Hemskärmsappen pekar fel
        </p>
        <p
          id="numa-frozen-desc"
          style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#9aada3" }}
        >
          Den här ikonen öppnar en gammal Vercel-länk (
          <span style={{ color: "#c5d6cc", wordBreak: "break-all" }}>
            {blockedHost}
          </span>
          ). Safari kan visa rätt version, men den här appen uppdateras aldrig.
        </p>
        <ol
          style={{
            margin: 0,
            paddingLeft: "1.2rem",
            fontSize: 14,
            lineHeight: 1.55,
            color: "#c5d6cc",
          }}
        >
          <li>Ta bort NUMA-ikonen från hemskärmen</li>
          <li>
            Öppna Safari →{" "}
            <strong style={{ color: "#fff" }}>{PRODUCTION_HOST}</strong>
          </li>
          <li>Dela → Lägg till på hemskärmen</li>
        </ol>
        <a
          href={`${PRODUCTION_ORIGIN}/idag`}
          style={{
            display: "flex",
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            background: "#f0a15e",
            color: "#0a1216",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Öppna rätt länk i Safari
        </a>
      </div>
    </div>
  );
}
