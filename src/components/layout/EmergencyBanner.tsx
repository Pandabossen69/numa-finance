"use client";

/** Fixed escape hatch — visible even when <main> RSC is empty. */
export function EmergencyBanner() {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 99999,
        background: "#1f6f5b",
        color: "#ffffff",
        padding: "10px 14px",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <a href="/mer" style={{ color: "#fff", textDecoration: "underline" }}>
        Mer-meny
      </a>
      <span style={{ opacity: 0.7 }}>·</span>
      <a href="/idag" style={{ color: "#fff", textDecoration: "underline" }}>
        Hem
      </a>
      <span style={{ opacity: 0.7 }}>·</span>
      <a href="/laga" style={{ color: "#fff", textDecoration: "underline" }}>
        Tom skärm? Laga appen
      </a>
    </div>
  );
}
