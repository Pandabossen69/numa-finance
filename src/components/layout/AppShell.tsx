"use client";

import { BottomNav } from "@/components/layout/BottomNav";

const ink = "#132019";
const muted = "#5a6b61";
const accent = "#1f6f5b";
const border = "rgba(19,32,25,0.12)";

const QUICK = [
  { href: "/idag", label: "Hem" },
  { href: "/plan", label: "Plan" },
  { href: "/fota", label: "Fota" },
  { href: "/analys", label: "Analys" },
  { href: "/mer", label: "Mer" },
] as const;

/**
 * Client shell — paints its own menu with inline styles.
 * Server RSC under (main) was blanking while /laga (client) worked.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "min(100%, 28rem)",
        marginInline: "auto",
        minHeight: "100dvh",
        color: ink,
        fontFamily: "system-ui, sans-serif",
        background: "#eef2ef",
        position: "relative",
      }}
    >
      <div
        style={{
          padding:
            "max(1.25rem, env(safe-area-inset-top, 0px)) 1.25rem calc(5.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <a
            href="/idag"
            style={{
              fontSize: "1.35rem",
              fontWeight: 700,
              color: ink,
              textDecoration: "none",
            }}
          >
            NUMA
          </a>
          <a
            href="/laga"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: accent,
              textDecoration: "none",
            }}
          >
            Laga
          </a>
        </div>

        <nav
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 6,
            marginBottom: 20,
          }}
          aria-label="Snabbmeny"
        >
          {QUICK.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                minHeight: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                border: `1px solid ${border}`,
                background: "#fbfcfb",
                color: ink,
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <p style={{ margin: "0 0 16px", fontSize: 12, color: muted }}>
          Om sidan nedan är tom: tryck en knapp ovan eller Laga.
        </p>

        <div style={{ color: ink }}>{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}
