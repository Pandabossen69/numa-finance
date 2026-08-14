import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { formatCountSv } from "@/domain/finance";
import { sanitizeMoneyDescription, type CurrencyCode } from "@/domain/money";
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
        ? `${cycle.startLabelSv} → ${cycle.endLabelSv}`
        : "Ingen cykel ännu";
  const daysLeftLabel = formatCountSv(cycle.daysLeft, "dag", "dagar");
  const modeEyebrow = isBridge
    ? "Tills nästa intäkt"
    : isEmpty
      ? "Ingen cykel"
      : "Cykel";
  const heroMeta = isBridge
    ? hasSaldo
      ? `${daysLeftLabel} kvar`
      : "Ange saldo på Hem"
    : isEmpty
      ? "Lägg in intäkter i Plan"
      : cycle.isActive
        ? `${daysLeftLabel} kvar`
        : "Lägg in intäkter i Plan";

  const spendPool =
    data.monthSpendingMinor + Math.max(0, cycle.remainingFreeMinor);
  const monthSpendProgress =
    data.monthSpendingMinor > 0 && spendPool > 0
      ? Math.min(1, data.monthSpendingMinor / spendPool)
      : null;

  return (
    <div className="mx-auto max-w-lg space-y-9">
      <header className="animate-rise">
        <h1 className="numa-page-title">Analys</h1>
      </header>

      <section
        className="animate-rise-delay-1 space-y-2.5"
        aria-labelledby="analys-hero"
      >
        <p className="numa-section-title">{modeEyebrow}</p>
        <h2
          id="analys-hero"
          className="text-lg font-semibold tracking-tight text-[var(--numa-ink)]"
        >
          {cycleTitle}
        </h2>
        {isBridge && !hasSaldo ? (
          <p className="text-base font-medium text-[var(--numa-muted)]">
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
        {!(isBridge && !hasSaldo) ? (
          <p className="text-sm text-[var(--numa-muted)]">{heroMeta}</p>
        ) : null}
      </section>

      <section
        className="animate-rise-delay-2 animate-scale-in space-y-0"
        aria-label="Cykelns siffror"
      >
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
              <MetricRow
                label="Saldo"
                value={
                  <span className="text-sm text-[var(--numa-faint)]">—</span>
                }
                hint="Ange på Hem eller fota SMS"
              />
            )}
            <MetricRow
              label="Kvar idag"
              amountMinor={hasSaldo ? cycle.perDayMinor : 0}
              currency={currency}
              tone={hasSaldo && cycle.perDayMinor > 0 ? "positive" : undefined}
            />
          </>
        ) : isCycle ? (
          <>
            <MetricRow
              label="Intäkter"
              amountMinor={cycle.incomeMinor}
              currency={currency}
              tone="positive"
            />
            <MetricRow
              label="Utgifter"
              amountMinor={cycle.expenseMinor}
              currency={currency}
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
              label="Spenderat"
              amountMinor={data.cycleSpendingMinor}
              currency={currency}
            />
            <MetricRow
              label="Kvar idag"
              amountMinor={cycle.perDayMinor}
              currency={currency}
              tone={cycle.perDayMinor > 0 ? "positive" : undefined}
            />
          </>
        ) : null}
      </section>

      {!isEmpty ? (
        <section className="animate-rise-delay-2 space-y-4">
          <hr className="numa-divider" />
          <LineList
            title={isBridge ? "Kommande intäkter" : "Intäkter"}
            empty={isBridge ? "Inga kommande." : "Inga i cykeln."}
            lines={cycle.incomes}
            currency={currency}
            totalMinor={cycle.incomeMinor}
          />
          <LineList
            title={isBridge ? "Kommande utgifter" : "Utgifter"}
            empty={isBridge ? "Inga kommande." : "Inga i cykeln."}
            lines={cycle.expenses}
            currency={currency}
            totalMinor={cycle.expenseMinor}
          />
        </section>
      ) : null}

      <section className="animate-rise-delay-3 space-y-5">
        <hr className="numa-divider" />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="numa-section-title">Denna månad</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {data.monthLabelSv}
            </h2>
          </div>
          <Link
            href="/plan"
            prefetch
            className="shrink-0 pb-0.5 text-xs font-semibold text-[var(--numa-accent)]"
          >
            Plan →
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
            title="Intäkter"
            empty="Inga intäkter inlagda."
            lines={month.incomes}
            currency={currency}
            totalMinor={month.incomeMinor}
          />
          <LineList
            title="Utgifter"
            empty="Inga utgifter inlagda."
            lines={month.expenses}
            currency={currency}
            totalMinor={month.expenseMinor}
          />
        </div>
      </section>

      <section className="animate-rise-delay-3 space-y-5">
        <hr className="numa-divider" />
        <h2 className="text-lg font-semibold tracking-tight">Konto</h2>
        <div className="space-y-0">
          {hasSaldo ? (
            <MetricRow
              label="Saldo"
              amountMinor={data.calculatedBalanceMinor!}
              currency={currency}
              hint={data.verificationLabel ?? undefined}
            />
          ) : (
            <MetricRow
              label="Saldo"
              hint="Ange på Hem eller fota SMS"
            />
          )}
          <MetricRow
            label="Denna månad"
            amountMinor={data.monthSpendingMinor}
            currency={currency}
          />
          <MetricRow
            label="Idag"
            amountMinor={data.todaySpendingMinor}
            currency={currency}
          />
        </div>
        {monthSpendProgress != null ? (
          <div className="numa-progress animate-bar" aria-hidden>
            <span
              style={{ width: `${Math.max(8, monthSpendProgress * 100)}%` }}
            />
          </div>
        ) : null}
      </section>

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
              Lägg till →
            </Link>
          </p>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
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

      <section className="animate-rise-delay-3 space-y-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Senaste</h2>
          <Link
            href="/transaktioner"
            prefetch
            className="text-xs font-semibold text-[var(--numa-accent)]"
          >
            Alla →
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-sm text-[var(--numa-faint)]">Inga rörelser ännu</p>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
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
                      {sanitizeMoneyDescription(tx.description)}
                    </p>
                    {tx.category ? (
                      <p className="mt-0.5 text-xs text-[var(--numa-faint)]">
                        {tx.category}
                      </p>
                    ) : null}
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
        <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-3 px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                  {sanitizeMoneyDescription(line.name)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--numa-faint)]">
                  {sanitizeMoneyDescription(line.detail)}
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
