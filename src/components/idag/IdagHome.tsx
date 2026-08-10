"use client";

import { useEffect, useState } from "react";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { DayPulseHero } from "@/components/idag/DayPulseHero";
import { IdagQuickActions } from "@/components/idag/IdagQuickActions";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import {
  getHomeSnapshotAction,
  type HomeSnapshot,
} from "@/features/finance/home-snapshot";
import { hoursSince } from "@/domain/finance";
import { calculateDayPulse } from "@/domain/gamification";
import { formatMoney, money } from "@/domain/money";

const ink = "#132019";
const muted = "#5a6b61";
const faint = "#8a9a91";
const accent = "#1f6f5b";

function coerceMinor(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/**
 * Client-loaded Hem. Server RSC for getTodaySnapshot was blanking /idag
 * while Mer (static) worked — keep first paint independent of Supabase.
 */
export function IdagHome() {
  const [snap, setSnap] = useState<HomeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getHomeSnapshotAction();
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          setLoading(false);
          return;
        }
        setSnap(result.data);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Kunde inte ladda");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ color: ink }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          Hämtar din ekonomi…
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: muted }}>
          Tar det lång tid: använd Mer-meny i listen ovan.
        </p>
      </div>
    );
  }

  if (error || !snap) {
    return (
      <div style={{ color: ink }}>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Kunde inte ladda</p>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>
          {error ?? "Okänt fel"}
        </p>
        <a
          href="/laga"
          style={{
            display: "inline-block",
            marginTop: 16,
            color: accent,
            fontWeight: 600,
          }}
        >
          Laga appen →
        </a>
      </div>
    );
  }

  if (!snap.primaryAccountId) {
    return (
      <div style={{ color: ink }}>
        <p style={{ margin: 0, fontSize: 14, color: muted }}>Din ekonomi · steg 1</p>
        <h2
          style={{
            margin: "12px 0 0",
            fontSize: "1.7rem",
            fontWeight: 600,
          }}
        >
          Vad har du just nu?
        </h2>
        <p
          style={{
            margin: "8px 0 16px",
            maxWidth: "36ch",
            fontSize: 15,
            lineHeight: 1.5,
            color: muted,
          }}
        >
          Ange ditt saldo. Sedan kan du sätta mål, fota kvitton och se om du har
          råd — hela tiden.
        </p>
        <CreateAccountForm />
      </div>
    );
  }

  return <IdagLoaded snap={snap} accountId={snap.primaryAccountId} />;
}

function IdagLoaded({
  snap,
  accountId,
}: {
  snap: HomeSnapshot;
  accountId: string;
}) {
  const currency = snap.currency;
  const safeToday = coerceMinor(snap.safeToSpendTodayMinor);
  const spentToday = coerceMinor(snap.todaySpendingMinor);
  const reserved = coerceMinor(snap.reservedMinor);
  const buffer = coerceMinor(snap.bufferMinor);
  const calculated =
    snap.calculatedBalanceMinor == null
      ? null
      : coerceMinor(snap.calculatedBalanceMinor);
  const week = coerceMinor(snap.safeToSpendWeekMinor);

  const pulse = calculateDayPulse({
    safeToSpendToday: money(safeToday, currency),
    spentToday: money(spentToday, currency),
  });

  const stale =
    !snap.checkpointVerifiedAt ||
    hoursSince(snap.checkpointVerifiedAt) > 48;

  const goals = snap.goals;
  const roomToday = safeToday - spentToday;
  const free = coerceMinor(snap.freeMinor);
  const affordLine =
    roomToday < 0
      ? "Du har använt mer än dagens trygga nivå."
      : roomToday === 0
        ? "Du ligger exakt på dagens trygga nivå."
        : `Du har ungefär ${formatMoney(money(roomToday, currency))} kvar att använda tryggt idag.`;

  const savingLine =
    free > 0
      ? `${formatMoney(money(free, currency))} är ledigt efter mål och buffert.`
      : goals.length > 0 || reserved > 0 || buffer > 0
        ? "Allt ledigt är reserverat till mål och buffert just nu."
        : "Lägg till mål under Plan så syns hur mycket du sparar.";

  return (
    <div style={{ color: ink }}>
      <DayPulseHero pulse={pulse} currency={currency} />

      <section
        style={{
          marginTop: 20,
          borderRadius: 22,
          border: "1px solid rgba(19,32,25,0.12)",
          background: "#fbfcfb",
          padding: 16,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: faint,
          }}
        >
          Har du råd?
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5 }}>
          {affordLine}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>{savingLine}</p>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>
          Baserat på saldo, plan och {snap.daysUntilIncome} dagar till nästa
          inkomst.
        </p>
      </section>

      <div style={{ marginTop: 20 }}>
        <IdagQuickActions
          accountId={accountId}
          verificationLabel={snap.verificationLabel}
          stale={stale}
        />
      </div>

      <section style={{ marginTop: 28 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: faint,
          }}
        >
          Saldo
        </p>
        <div style={{ marginTop: 8 }}>
          {calculated != null ? (
            <MoneyDisplay amountMinor={calculated} currency={currency} size="xl" />
          ) : (
            <span style={{ fontSize: 30, fontWeight: 600 }}>—</span>
          )}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: muted }}>
          {snap.verificationLabel
            ? `Uppdaterat ${snap.verificationLabel.toLowerCase()}`
            : "Uppdatera saldot så siffrorna stämmer"}
        </p>
      </section>

      <section
        style={{
          marginTop: 28,
          paddingTop: 24,
          borderTop: "1px solid rgba(19,32,25,0.12)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: faint,
              }}
            >
              Tryggt idag
            </p>
            <div style={{ marginTop: 8 }}>
              <MoneyDisplay amountMinor={safeToday} currency={currency} size="lg" />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 12, color: faint }}>denna vecka</p>
            <div style={{ marginTop: 4 }}>
              <MoneyDisplay amountMinor={week} currency={currency} size="md" compact />
            </div>
          </div>
        </div>
        {reserved > 0 || buffer > 0 ? (
          <p style={{ margin: "12px 0 0", fontSize: 14, color: muted }}>
            {formatMoney(money(reserved + buffer, currency))} är redan
            reserverat i planen.
          </p>
        ) : null}
      </section>

      <section
        style={{
          marginTop: 28,
          paddingTop: 24,
          borderTop: "1px solid rgba(19,32,25,0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: faint,
            }}
          >
            Dina mål
          </p>
          <a href="/plan" style={{ fontSize: 14, color: accent }}>
            Hantera
          </a>
        </div>
        {goals.length === 0 ? (
          <div style={{ marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: muted }}>
              Sätt ett sparmål — då syns det här och räknas in i vad som är
              ledigt.
            </p>
            <a
              href="/plan"
              style={{
                display: "inline-block",
                marginTop: 8,
                fontSize: 14,
                fontWeight: 500,
                color: accent,
              }}
            >
              Lägg till mål →
            </a>
          </div>
        ) : (
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {goals.map((g) => (
              <li
                key={g.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(19,32,25,0.12)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {g.name}
                </p>
                <span style={{ fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
                  {formatMoney(money(coerceMinor(g.amountMinor), g.currency))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        style={{
          marginTop: 28,
          paddingTop: 24,
          borderTop: "1px solid rgba(19,32,25,0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: faint,
            }}
          >
            Senaste köp
          </p>
          <a href="/transaktioner" style={{ fontSize: 14, color: accent }}>
            Alla
          </a>
        </div>
        {snap.recent.length === 0 ? (
          <div style={{ marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: 14, color: muted }}>
              Inga köp ännu. Fota ett kvitto när du betalar.
            </p>
            <a
              href="/fota"
              style={{
                display: "inline-block",
                marginTop: 8,
                fontSize: 14,
                fontWeight: 500,
                color: accent,
              }}
            >
              Fota kvitto →
            </a>
          </div>
        ) : (
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {snap.recent.map((tx) => (
              <li
                key={tx.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: "1px solid rgba(19,32,25,0.12)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tx.description}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: faint }}>
                    {tx.category ?? typeLabel(tx.transactionType)}
                  </p>
                </div>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    flexShrink: 0,
                    color: tx.direction === "debit" ? ink : "#1b6b45",
                  }}
                >
                  {tx.direction === "debit" ? "−" : "+"}
                  {formatMoney(money(coerceMinor(tx.amountMinor), tx.currency))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function typeLabel(type: string): string {
  switch (type) {
    case "expense":
      return "Utgift";
    case "income":
      return "Inkomst";
    case "transfer":
      return "Flytt";
    case "cash_withdrawal":
      return "Kontant";
    default:
      return "Köp";
  }
}
