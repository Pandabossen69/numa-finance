"use client";

/**
 * Always painted above page content with hardcoded colors.
 * CSS-variable failures / poisoned shells must not hide the escape hatch.
 */
export function ShellSafetyStrip() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: "1px solid rgba(19,32,25,0.12)",
        color: "#132019",
      }}
    >
      <a
        href="/idag"
        style={{
          fontSize: "1.35rem",
          fontWeight: 600,
          letterSpacing: "-0.04em",
          color: "#132019",
          textDecoration: "none",
        }}
      >
        NUMA
      </a>
      <a
        href="/laga"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#1f6f5b",
          textDecoration: "none",
        }}
      >
        Tom skärm? Tryck här
      </a>
    </div>
  );
}
