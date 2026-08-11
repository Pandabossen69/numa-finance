import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import type { CurrencyCode } from "@/domain/money";
import type { AnalysLine, AnalysSnapshot } from "@/features/finance/load-analys";

export function AnalysDashboard({
  data,
  error,
}: {
  data: AnalysSnapshot | null;
  error?: string | null;
}) {
  if (error || !data) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <Link
          href="/idag"
          prefetch
          className="text-sm font-semibold text-[var(--numa-accent)]"
        >
          Tillbaka till Hem →
        </Link>
      </div>
    );
  }

  const { currency, cycle, month } = data;
  const isBridge = cycle.livingMode === "bridge";
  const isEmpty = cycle.livingMode === "empty";
  const isCycle = cycle.livingMode === "cycle";
  const hasSaldo = data.hasBankTruth && data.calculatedBalanceMinor != null;
  const heroMinor = isBridge && !hasSaldo ? 0 : cycle.remainingFreeMinor;
  const heroOk = hasSaldo || isCycle ? heroMinor >= 0 : false;
  const cycleTitle =
    isBridge && cycle.startLabelSv
      ? `Nu → ${cycle.startLabelSv}`
      : cycle.startLabelSv && cycle.endLabelSv
        ? `${cycle.startLabelSv} → ${cycle.endLabelSv}${cycle.endInferred ? " (beräknad)" : ""}`
        : "Ingen cykel ännu";
  const cycleSupport = isBridge
    ? hasSaldo
      ? `${cycle.daysLeft} dagar kvar · Hem använder kontosaldo`
      : `${cycle.daysLeft} dagar kvar · ange saldo för kvar per dag`
    : isEmpty
      ? "Lägg in intäkter med datum i Plan för att starta cykeln."
      : cycle.isActive
        ? `${cycle.daysLeft} dagar kvar till nästa månads sista intäkt`
        : "Lägg in intäkter med datum i Plan för att starta cykeln.";
  const modeEyebrow = isBridge
    ? "Tills nästa intäkt"
    : isEmpty
      ? "Ingen cykel"
      : "Aktiv inkomstcykel";
  const heroCaption = isBridge
    ? hasSaldo
      ? "Saldo kvar"
      : "Saldo saknas"
    : isEmpty
      ? "Ingen pool ännu"
      : "Kvar totalt";

  return (
    <div className="mx-auto max-w-lg space-y-10">
      <header className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--numa-ink)]">
          Analys
        </h1>
        <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Hur siffrorna räknas — cykel, månad och rörelser.
        </p>
      </header>

      {/* Hero: one composition, no card */}
      <section className="animate-rise-delay-1 space-y-3" aria-labelledby="analys-hero">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
          {modeEyebrow}
        </p>
        <h2
          id="analys-hero"
          className="text-xl font-semibold tracking-tight text-[var(--numa-ink)]"
        >
          {cycleTitle}
        </h2>
        {isBridge && !hasSaldo ? (
          <p className="text-lg font-semibold text-[var(--numa-muted)]">
            Ange saldo på Hem
          </p>
        ) : (
          <div
            className={
              heroOk
                ? "money-hero text-[var(--numa-ink)]"
                : "money-hero text-[var(--numa-muted)]"
            }
          >
            <MoneyDisplay
              amountMinor={heroMinor}
              currency={currency}
              size="xl"
            />
          </div>
        )}
        <p className="text-sm text-[var(--numa-muted)]">
          {heroCaption} · {cycleSupport}
        </p>
      </section>

      {/* Cycle metrics — calm rows, not a dashboard grid */}
      <section className="animate-rise-delay-2 space-y-0" aria-label="Cykelns siffror">
        {isBridge ? (
          <>
            {hasSaldo ? (
              <MetricRow
                label="Saldo"
                amountMinor={cycle.remainingFreeMinor}
                currency={currency}
                tone={cycle.remainingFreeMinor >= 0 ? "positive" : "danger"}
                hint={data.verificationLabel ?? undefined}
              />
            ) : (
              <div className="flex items-baseline justify-between gap-4 border-b border-[var(--numa-border)] py-3.5">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--numa-muted)]">Saldo</p>
                  <p className="mt-0.5 text-xs text-[var(--numa-faint)]">
                    Ange på Hem eller fota bank-SMS
                  </p>
                </div>
                <span className="shrink-0 text-sm text-[var(--numa-faint)]">—</span>
              </div>
            )}
            <MetricRow
              label="Kvar per dag"
              amountMinor={hasSaldo ? cycle.perDayMinor : 0}
              currency={currency}
              tone={hasSaldo && cycle.perDayMinor > 0 ? "positive" : undefined}
              hint={hasSaldo ? undefined : "Kräver saldo först"}
            />
          </>
        ) : isCycle ? (
          <>
            <MetricRow
              label="Intäkter i cykeln"
              amountMinor={cycle.incomeMinor}
              currency={currency}
              tone="positive"
            />
            <MetricRow
              label="Utgifter i cykeln"
              amountMinor={cycle.expenseMinor}
              currency={currency}
            />
            <MetricRow
              label="Planerat fritt"
              amountMinor={cycle.freeToSpendMinor}
              currency={currency}
              tone={cycle.freeToSpendMinor >= 0 ? "positive" : "danger"}
            />
            <MetricRow
              label="Kvar totalt"
              amountMinor={cycle.remainingFreeMinor}
              currency={currency}
              tone={cycle.remainingFreeMinor >= 0 ? "positive" : "danger"}
            />
            <MetricRow
              label="Sparande"
              amountMinor={cycle.savingsMinor}
              currency={currency}
            />
            <MetricRow
              label="Spenderat i cykeln"
              amountMinor={data.cycleSpendingMinor}
              currency={currency}
            />
            <MetricRow
              label="Kvar per dag"
              amountMinor={cycle.perDayMinor}
              currency={currency}
              tone={cycle.perDayMinor > 0 ? "positive" : undefined}
            />
          </>
        ) : null}
      </section>

      {/* Formula — text only, no panel */}
      <section className="animate-rise-delay-2 space-y-3 border-t border-[var(--numa-border)] pt-8">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--numa-ink)]">
          Så räknas det
        </h2>
        <ol className="list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-[var(--numa-muted)]">
          {data.formula.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {isCycle ? (
          <p className="text-sm leading-relaxed text-[var(--numa-muted)]">
            Exempel: planerat fritt{" "}
            <span className="font-semibold text-[var(--numa-ink)]">
              <MoneyDisplay
                amountMinor={cycle.freeToSpendMinor}
                currency={currency}
                size="sm"
              />
            </span>{" "}
            − spenderat{" "}
            <span className="font-semibold text-[var(--numa-ink)]">
              <MoneyDisplay
                amountMinor={data.cycleSpendingMinor}
                currency={currency}
                size="sm"
              />
            </span>{" "}
            = kvar{" "}
            <span className="font-semibold text-[var(--numa-ink)]">
              <MoneyDisplay
                amountMinor={cycle.remainingFreeMinor}
                currency={currency}
                size="sm"
              />
            </span>
            , delat på {cycle.daysLeft} dagar.
          </p>
        ) : null}
      </section>

      {/* Cycle line items — lists are interaction containers */}
      {!isEmpty ? (
        <section className="animate-rise-delay-2 space-y-4">
          <LineList
            title={isBridge ? "Kommande intäkter" : "Intäkter i cykeln"}
            subtitle={isBridge ? "Räknas när de landar" : undefined}
            empty={
              isBridge ? "Inga kommande intäkter." : "Inga intäkter i cykeln."
            }
            lines={cycle.incomes}
            currency={currency}
            totalMinor={cycle.incomeMinor}
          />
          <LineList
            title={
              isBridge ? "Utgifter i kommande period" : "Utgifter i cykeln"
            }
            empty={
              isBridge
                ? "Inga utgifter i kommande period."
                : "Inga utgifter förfaller i cykeln."
            }
            lines={cycle.expenses}
            currency={currency}
            totalMinor={cycle.expenseMinor}
          />
        </section>
      ) : null}

      {/* Calendar month — one job */}
      <section className="animate-rise-delay-3 space-y-5 border-t border-[var(--numa-border)] pt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
              Kalendermånad
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {data.monthLabelSv}
            </h2>
          </div>
          <Link
            href="/plan"
            prefetch
            className="shrink-0 pb-0.5 text-xs font-semibold text-[var(--numa-accent)]"
          >
            Öppna Plan →
          </Link>
        </div>

        <div className="space-y-0">
          <MetricRow
            label="Intäkter"
            amountMinor={month.incomeMinor}
            currency={currency}
            tone="positive"
          />
          <MetricRow
            label="Utgifter"
            amountMinor={month.expenseMinor}
            currency={currency}
            hint="Fasta + engång"
          />
          <MetricRow
            label="Sparande"
            amountMinor={month.savingsMinor}
            currency={currency}
          />
          <MetricRow
            label="Månadssaldo"
            amountMinor={month.freeToSpendMinor}
            currency={currency}
            tone={month.freeToSpendMinor >= 0 ? "positive" : "danger"}
          />
        </div>

        <div className="space-y-4">
          <LineList
            title="Intäkter denna månad"
            empty="Inga intäkter inlagda."
            lines={month.incomes}
            currency={currency}
            totalMinor={month.incomeMinor}
          />
          <LineList
            title="Utgifter denna månad"
            empty="Inga utgifter inlagda."
            lines={month.expenses}
            currency={currency}
            totalMinor={month.expenseMinor}
          />
        </div>
      </section>

      {/* Account & movements */}
      <section className="animate-rise-delay-3 space-y-5 border-t border-[var(--numa-border)] pt-8">
        <h2 className="text-lg font-semibold tracking-tight">Konto & rörelser</h2>
        <div className="space-y-0">
          {hasSaldo ? (
            <MetricRow
              label="Saldo"
              amountMinor={data.calculatedBalanceMinor!}
              currency={currency}
              hint={data.verificationLabel ?? "Beräknat"}
            />
          ) : (
            <div className="flex items-baseline justify-between gap-4 border-b border-[var(--numa-border)] py-3.5">
              <div className="min-w-0">
                <p className="text-sm text-[var(--numa-muted)]">Saldo</p>
                <p className="mt-0.5 text-xs text-[var(--numa-faint)]">
                  {data.hasBankTruth
                    ? "Saknas"
                    : "Ange på Hem eller fota bank-SMS"}
                </p>
              </div>
              <span className="shrink-0 text-sm text-[var(--numa-faint)]">—</span>
            </div>
          )}
          <MetricRow
            label="Spenderat denna månad"
            amountMinor={data.monthSpendingMinor}
            currency={currency}
            hint="Kalendermånad · bankrörelser"
          />
          <MetricRow
            label="Spenderat idag"
            amountMinor={data.todaySpendingMinor}
            currency={currency}
            hint="Kalenderdag"
          />
        </div>
      </section>

      {/* Goals — interactive list */}
      <section className="animate-rise-delay-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Mål</h2>
          <Link
            href="/plan"
            prefetch
            className="text-xs font-semibold text-[var(--numa-accent)]"
          >
            Plan →
          </Link>
        </div>
        {data.goals.length === 0 ? (
          <p className="text-sm text-[var(--numa-muted)]">
            Inga mål ännu.{" "}
            <Link
              href="/plan"
              prefetch
              className="font-semibold text-[var(--numa-accent)]"
            >
              Lägg till i Plan →
            </Link>
          </p>
        ) : (
          <ul className="numa-panel divide-y divide-[var(--numa-border)] overflow-hidden">
            {data.goals.map((goal) => (
              <li
                key={goal.id}
                className="flex items-center justify-between gap-3 px-4 py-3.5"
              >
                <span className="truncate text-sm text-[var(--numa-muted)]">
                  {goal.name}
                </span>
                <MoneyDisplay
                  amountMinor={goal.amountMinor}
                  currency={currency}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent movements — interactive list */}
      <section className="animate-rise-delay-3 space-y-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Senaste rörelser
          </h2>
          <Link
            href="/transaktioner"
            prefetch
            className="text-xs font-semibold text-[var(--numa-accent)]"
          >
            Se alla →
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-sm text-[var(--numa-faint)]">Inga rörelser ännu</p>
        ) : (
          <ul className="numa-panel divide-y divide-[var(--numa-border)] overflow-hidden">
            {data.recent.map((tx) => {
              const signed =
                tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
              return (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                      {tx.description}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--numa-faint)]">
                      {tx.category ?? tx.transactionType}
                    </p>
                  </div>
                  <MoneyDisplay
                    amountMinor={signed}
                    currency={tx.currency}
                    size="sm"
                    tone="signed"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricRow({
  label,
  amountMinor,
  currency,
  hint,
  tone,
}: {
  label: string;
  amountMinor: number;
  currency: CurrencyCode;
  hint?: string;
  tone?: "positive" | "danger";
}) {
  const amountClass =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "danger"
        ? "text-[var(--numa-danger)]"
        : "text-[var(--numa-ink)]";

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--numa-border)] py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-[var(--numa-muted)]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-[var(--numa-faint)]">{hint}</p>
        ) : null}
      </div>
      <div className={`shrink-0 ${amountClass}`}>
        <MoneyDisplay amountMinor={amountMinor} currency={currency} size="md" />
      </div>
    </div>
  );
}

function LineList({
  title,
  subtitle,
  empty,
  lines,
  currency,
  totalMinor,
}: {
  title: string;
  subtitle?: string;
  empty: string;
  lines: AnalysLine[];
  currency: CurrencyCode;
  totalMinor: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-[var(--numa-ink)]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--numa-faint)]">{subtitle}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-[var(--numa-muted)]">
          <MoneyDisplay amountMinor={totalMinor} currency={currency} size="sm" />
        </div>
      </div>
      {lines.length === 0 ? (
        <p className="px-0.5 text-sm text-[var(--numa-faint)]">{empty}</p>
      ) : (
        <ul className="numa-panel divide-y divide-[var(--numa-border)] overflow-hidden">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                  {line.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--numa-faint)]">
                  {line.detail}
                </p>
              </div>
              <MoneyDisplay
                amountMinor={line.amountMinor}
                currency={currency}
                size="sm"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
