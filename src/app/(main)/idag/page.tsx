import { Suspense } from "react";
import { CreateAccountForm } from "@/components/accounts/CreateAccountForm";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { DayPulseHero } from "@/components/idag/DayPulseHero";
import { IdagQuickActions } from "@/components/idag/IdagQuickActions";
import { HardReloadLink } from "@/components/ui/HardReloadLink";
import { hoursSince, NEXT_INCOME_NAME } from "@/domain/finance";
import { calculateDayPulse } from "@/domain/gamification";
import { formatMoney, money } from "@/domain/money";
import { getTodaySnapshot, type TodaySnapshot } from "@/lib/store/repository";

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
 * Static chrome first — never wait on Supabase before painting something.
 * Blank /idag was caused by hung RSC with no visible fallback.
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

      <Suspense fallback={<IdagFallback />}>
        <IdagBody />
      </Suspense>
    </div>
  );
}

function IdagFallback() {
  return (
    <div style={{ color: ink }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
        Hämtar din ekonomi…
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: muted }}>
        Tar det mer än några sekunder: tryck Mer-meny eller Laga appen i listen
        högst upp.
      </p>
      <div
        style={{
          marginTop: 16,
          height: 112,
          borderRadius: 28,
          border: "1px solid rgba(19,32,25,0.12)",
          background: "#fbfcfb",
        }}
      />
    </div>
  );
}

function LoadFailed({ detail }: { detail?: string }) {
  return (
    <div style={{ color: ink }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Kunde inte ladda</p>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: muted }}>
        Något störde hämtningen. Ladda om eller laga appen.
      </p>
      {detail ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: faint, wordBreak: "break-word" }}>
          {detail}
        </p>
      ) : null}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <HardReloadLink
          href="/idag"
          className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--numa-accent)] text-sm font-semibold text-white"
        >
          Ladda om
        </HardReloadLink>
        <a
          href="/laga"
          style={{
            display: "flex",
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            border: "1px solid rgba(19,32,25,0.12)",
            color: ink,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Laga appen
        </a>
        <a href="/mer" style={{ color: accent, fontSize: 14, fontWeight: 500 }}>
          Gå till Mer-menyn →
        </a>
      </div>
    </div>
  );
}

async function IdagBody() {
  let snap: TodaySnapshot;
  try {
    snap = await getTodaySnapshot();
  } catch (error) {
    console.error("[numa] idag snapshot failed", error);
    return (
      <LoadFailed detail={error instanceof Error ? error.message : undefined} />
    );
  }

  try {
    return renderIdag(snap);
  } catch (error) {
    console.error("[numa] idag render failed", error);
    return (
      <LoadFailed detail={error instanceof Error ? error.message : undefined} />
    );
  }
}

function renderIdag(snap: TodaySnapshot) {
  if (!snap.primaryAccount) {
    return (
      <div style={{ color: ink }}>
        <p style={{ margin: 0, fontSize: 14, color: muted }}>Din ekonomi · steg 1</p>
        <h2
          style={{
            margin: "12px 0 0",
            fontSize: "1.7rem",
            fontWeight: 600,
            color: ink,
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
    !snap.checkpoint || hoursSince(snap.checkpoint.verifiedAt) > 48;

  const goals = (snap.planItems ?? []).filter(
    (p) => p.isActive && p.kind === "goal" && p.name !== NEXT_INCOME_NAME,
  );

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

  const recent = Array.isArray(snap.recentTransactions)
    ? snap.recentTransactions.slice(0, 6)
    : [];

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
        <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5, color: ink }}>
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
          accountId={snap.primaryAccount.id}
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
              <MoneyDisplay
                amountMinor={week}
                currency={currency}
                size="md"
                compact
              />
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
              Sätt ett sparmål eller planerat köp — då syns det här och räknas
              in i vad som är ledigt.
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
        {recent.length === 0 ? (
          <div style={{ marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: 14, color: muted }}>
              Inga köp ännu. Fota ett kvitto eller skärmbild när du betalar.
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
            {recent.map((tx) => (
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
                    color:
                      tx.direction === "debit" ? ink : "var(--numa-positive)",
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
