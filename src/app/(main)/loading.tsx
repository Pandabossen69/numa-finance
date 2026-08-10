"use client";

export default function MainLoading() {
  return (
    <div
      style={{
        color: "#132019",
        fontFamily: "system-ui, sans-serif",
        paddingTop: 8,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Laddar…</h2>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "#5a6b61" }}>
        Om det stannar här: tryck Laga i den gröna listen.
      </p>
      <a
        href="/laga"
        style={{
          display: "inline-flex",
          marginTop: 16,
          minHeight: 48,
          alignItems: "center",
          padding: "0 16px",
          borderRadius: 16,
          background: "#1f6f5b",
          color: "#fff",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Laga appen nu
      </a>
    </div>
  );
}
