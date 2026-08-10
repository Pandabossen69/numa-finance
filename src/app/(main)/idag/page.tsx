"use client";

import { IdagHome } from "@/components/idag/IdagHome";

const ink = "#132019";
const muted = "#5a6b61";

/** Client Hem — paints immediately; data loads inside IdagHome. */
export default function IdagPage() {
  return (
    <div style={{ color: ink, fontFamily: "system-ui, sans-serif", paddingTop: 4 }}>
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.65rem",
            fontWeight: 700,
            color: ink,
          }}
        >
          Hem
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: muted }}>
          Koll på budget, mål och varje köp
        </p>
      </header>
      <IdagHome />
    </div>
  );
}
