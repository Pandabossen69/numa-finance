import { Suspense } from "react";
import { withTimeout } from "@/lib/async";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listObservations } from "@/lib/store/repository";

const links = [
  { href: "/konton", label: "Mina saldon" },
  { href: "/transaktioner", label: "Utgifter & rörelser" },
  { href: "/fota", label: "Fota kvitto / skärmbild" },
  { href: "/importera", label: "Importer" },
  { href: "/installningar", label: "Inställningar" },
  { href: "/laga", label: "Laga appen (rensa cache)" },
] as const;

const ink = "#132019";
const muted = "#5a6b61";
const faint = "#8a9a91";
const accent = "#1f6f5b";
const border = "rgba(19,32,25,0.12)";

/** Static-first Mer — must paint even if CSS/RSC data fails. */
export default function MerPage() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <div style={{ color: ink }}>
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.65rem",
            fontWeight: 600,
            letterSpacing: "-0.04em",
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
          fontWeight: 600,
          textDecoration: "none",
          marginBottom: 24,
        }}
      >
        Laga appen nu
      </a>

      <nav
        style={{
          borderTop: `1px solid ${border}`,
          borderBottom: `1px solid ${border}`,
          marginBottom: 24,
        }}
      >
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
              fontWeight: 500,
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
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: muted }}>
          Läge
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>
          {supabaseReady
            ? "Molnkonto aktivt — din data är privat per inloggning."
            : "Lokalt läge (en användare) — koppla Supabase för flera konton."}
        </p>
        <Suspense
          fallback={
            <p style={{ margin: "8px 0 0", fontSize: 14, color: faint }}>…</p>
          }
        >
          <ObservationCount />
        </Suspense>
      </section>
    </div>
  );
}

async function ObservationCount() {
  let observationCount = 0;
  try {
    const observations = await withTimeout(
      listObservations(),
      4_000,
      "listObservations",
    );
    observationCount = observations.length;
  } catch (error) {
    console.error("[numa] mer observations failed", error);
    return (
      <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>
        Sparade bilder: kunde inte hämtas just nu.
      </p>
    );
  }

  return (
    <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>
      Sparade bilder: {observationCount}
    </p>
  );
}
