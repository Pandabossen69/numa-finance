import { Suspense } from "react";
import { ReceiptCaptureFlow } from "@/components/capture/ReceiptCaptureFlow";
import { getTodaySnapshot } from "@/lib/store/repository";

const ink = "#132019";
const muted = "#5a6b61";
const accent = "#1f6f5b";

export default function FotaPage() {
  return (
    <div style={{ color: ink, paddingTop: 8, paddingBottom: 16 }}>
      <header style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: accent }}>
          Snabbt · kvitto eller skärmbild
        </p>
        <h1
          style={{
            margin: "4px 0 0",
            fontSize: "1.65rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: ink,
          }}
        >
          Fota och bekräfta
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            maxWidth: "36ch",
            fontSize: 15,
            lineHeight: 1.5,
            color: muted,
          }}
        >
          NUMA läser beloppet när det går — du godkänner alltid innan det
          sparas mot budgeten.
        </p>
      </header>

      <Suspense fallback={<FotaFallback />}>
        <FotaBody />
      </Suspense>
    </div>
  );
}

function FotaFallback() {
  return (
    <p style={{ fontSize: 14, color: muted }}>
      Förbereder kamera… Om det stannar: öppna Mer eller Laga appen.
    </p>
  );
}

async function FotaBody() {
  let snap;
  try {
    snap = await getTodaySnapshot();
  } catch (error) {
    console.error("[numa] fota snapshot failed", error);
    return (
      <div style={{ color: ink }}>
        <p style={{ fontSize: 14, color: muted }}>Kunde inte ladda.</p>
        <a
          href="/fota"
          style={{ display: "inline-block", marginTop: 12, color: accent }}
        >
          Försök igen
        </a>
      </div>
    );
  }

  if (!snap.primaryAccount) {
    return (
      <div style={{ color: ink }}>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: muted }}>
          Ange först hur mycket du har just nu — sedan kan du fota kvitton.
        </p>
        <a
          href="/idag"
          style={{
            display: "flex",
            minHeight: 56,
            marginTop: 16,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            background: accent,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Ange mitt saldo
        </a>
      </div>
    );
  }

  return (
    <ReceiptCaptureFlow
      accountId={snap.primaryAccount.id}
      safeToSpendTodayMinor={snap.safeToSpendTodayMinor}
      todaySpendingMinor={snap.todaySpendingMinor}
      currency={snap.currency}
    />
  );
}
