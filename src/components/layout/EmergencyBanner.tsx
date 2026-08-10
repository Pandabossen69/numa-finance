"use client";

/** Always-visible app chrome in root layout — works even if page RSC is empty. */
export function EmergencyBanner() {
  const link = {
    color: "#fff",
    textDecoration: "underline",
    fontWeight: 700,
  } as const;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 99999,
        background: "#1f6f5b",
        color: "#ffffff",
        padding: "12px 14px",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <a href="/idag" style={link}>
          Hem
        </a>
        <span style={{ opacity: 0.6 }}>·</span>
        <a href="/plan" style={link}>
          Plan
        </a>
        <span style={{ opacity: 0.6 }}>·</span>
        <a href="/fota" style={link}>
          Fota
        </a>
        <span style={{ opacity: 0.6 }}>·</span>
        <a href="/analys" style={link}>
          Analys
        </a>
        <span style={{ opacity: 0.6 }}>·</span>
        <a href="/mer" style={link}>
          Mer
        </a>
        <span style={{ opacity: 0.6 }}>·</span>
        <a href="/laga" style={link}>
          Laga
        </a>
      </div>
      <p
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: 11,
          fontWeight: 500,
          opacity: 0.9,
        }}
      >
        Ser du bara denna list? Tryck Laga, sedan en menyknapp.
      </p>
    </div>
  );
}
