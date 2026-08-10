import { IdagHome } from "@/components/idag/IdagHome";

const ink = "#132019";
const muted = "#5a6b61";

/**
 * Pure static server page — no async RSC. Data loads in IdagHome (client).
 * This is what Mer already did successfully; Hem was blanking on server snapshot.
 */
export default function IdagPage() {
  return (
    <div style={{ color: ink, paddingTop: 4 }}>
      <header style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.65rem",
            fontWeight: 600,
            letterSpacing: "-0.04em",
            color: ink,
          }}
        >
          NUMA
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: muted }}>
          Koll på budget, mål och varje köp
        </p>
      </header>
      <IdagHome />
    </div>
  );
}
