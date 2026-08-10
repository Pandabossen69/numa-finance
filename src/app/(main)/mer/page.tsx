"use client";

import { isSupabaseConfigured } from "@/lib/supabase/config";

const ink = "#132019";
const muted = "#5a6b61";
const faint = "#8a9a91";
const accent = "#1f6f5b";
const border = "rgba(19,32,25,0.12)";

const links = [
  { href: "/konton", label: "Mina saldon" },
  { href: "/transaktioner", label: "Utgifter & rörelser" },
  { href: "/fota", label: "Fota kvitto / skärmbild" },
  { href: "/importera", label: "Importer" },
  { href: "/installningar", label: "Inställningar" },
  { href: "/laga", label: "Laga appen (rensa cache)" },
] as const;

/** Client Mer — no server RSC body. */
export default function MerPage() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <div style={{ color: ink, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.65rem",
            fontWeight: 700,
            color: ink,
          }}
        >
          Mer
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>
          Saldon, historik och snabb import.
        </p>
      </header>

      <a
        href="/laga"
        style={{
          display: "flex",
          minHeight: 56,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 16,
          background: accent,
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          textDecoration: "none",
          marginBottom: 24,
        }}
      >
        Laga appen nu
      </a>

      <nav style={{ borderTop: `1px solid ${border}`, marginBottom: 24 }}>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              display: "flex",
              minHeight: 56,
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 14,
              fontWeight: 600,
              color: ink,
              textDecoration: "none",
              borderBottom: `1px solid ${border}`,
            }}
          >
            {link.label}
            <span style={{ color: faint }} aria-hidden>
              →
            </span>
          </a>
        ))}
      </nav>

      <section>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: muted }}>
          Läge
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>
          {supabaseReady
            ? "Molnkonto aktivt — din data är privat per inloggning."
            : "Lokalt läge — koppla Supabase för flera konton."}
        </p>
      </section>
    </div>
  );
}
