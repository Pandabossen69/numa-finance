import Link from "next/link";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { formatCountSv } from "@/domain/finance";
import { sanitizeMoneyDescription, type CurrencyCode } from "@/domain/money";
import { SV } from "@/features/copy/labels-sv";
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
      <div className="numa-panel-strong animate-rise space-y-3 p-5">
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
      ? `Fram till ${cycle.startLabelSv}`
      : cycle.startLabelSv && cycle.endLabelSv
        ? `${cycle.startLabelSv} – ${cycle.endLabelSv}`
        : "Ingen period ännu";
  const daysLeftLabel = formatCountSv(cycle.daysLeft, "dag", "dagar");
  const modeEyebrow = isBridge
    ? "Tills nästa intäkt"
    : isEmpty
      ? "Ingen period"
      : SV.perioden;
  const heroLabel = isBridge ? SV.saldo : SV.kvarIPerioden;
  const heroMeta = isBridge
    ? hasSaldo
      ? daysLeftLabel
      : "Ange saldo på Hem"
    : isEmpty
      ? "Lägg in intäkter i Plan"
      : cycle.isActive
        ? daysLeftLabel
        : "Lägg in intäkter i Plan";

  const spendPool =
    data.monthSpendingMinor + Math.max(0, cycle.remainingFreeMinor);
  const monthSpendProgress =
    data.monthSpendingMinor > 0 && spendPool > 0
      ? Math.min(1, data.monthSpendingMinor / spendPool)
      : null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header className="animate-rise space-y-1">
        <h1 className="numa-page-title">Analys</h1>
        <p className="max-w-[36ch] text-sm text-[var(--numa-muted)]">
          Samma siffror som på Hem — här ser du hela perioden.
        </p>
      </header>

      <section
        className="numa-panel-strong animate-rise-delay-1 space-y-3 p-5"
        aria-labelledby="analys-hero"
      >
        <p className="numa-section-title">{modeEyebrow}</p>
        <h2
          id="analys-hero"
          className="text-base font-semibold tracking-tight text-[var(--numa-ink)]"
        >
          {cycleTitle}
        </h2>
        <p className="text-xs font-medium text-[var(--numa-faint)]">{heroLabel}</p>
        {isBridge && !hasSaldo ? (
          <p className="text-base font-medium text-[var(--numa-muted)]">
            Ange saldo på Hem
          </p>
        ) : (
          <div className={heroOk ? "text-[var(--numa-ink)]" : "text-[var(--numa-muted)]"}>
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

      {!isEmpty ? (
        <section className="animate-rise-delay-2 space-y-2">
          <p className="numa-section-title px-1">{SV.idag}</p>
          <div className="numa-panel-list px-4 py-1">
            <MetricRow
              label={SV.kvarIdag}
              amountMinor={isBridge && !hasSaldo ? 0 : cycle.remainingTodayMinor}
              currency={currency}
              tone={
                (!isBridge || hasSaldo) && cycle.remainingTodayMinor > 0
                  ? "positive"
                  : undefined
              }
              hint="Det du kan handla för just nu"
            />
            <MetricRow
              label={SV.dagsbudget}
              amountMinor={isBridge && !hasSaldo ? 0 : cycle.dayBudgetMinor}
              currency={currency}
              hint="Samma belopp hela dagen"
            />
            <MetricRow
              label={SV.spenderatIdag}
              amountMinor={data.todaySpendingMinor}
              currency={currency}
            />
          </div>
        </section>
      ) : null}

      <section className="animate-rise-delay-2 space-y-2" aria-label="Periodens siffror">
        {!isEmpty ? (
          <p className="numa-section-title px-1">{SV.perioden}</p>
        ) : null}
        <div className="numa-panel-list px-4 py-1">
          {isBridge ? (
            <>
              {hasSaldo ? (
                <MetricRow
                  label={SV.saldo}
                  amountMinor={cycle.remainingFreeMinor}
                  currency={currency}
                  tone={cycle.remainingFreeMinor >= 0 ? "positive" : "danger"}
                  hint={data.verificationLabel ?? undefined}
                />
              ) : (
                <MetricRow
                  label={SV.saldo}
                  value={
                    <span className="text-sm text-[var(--numa-faint)]">—</span>
                  }
                  hint="Ange på Hem eller fota SMS"
                />
              )}
            </>
          ) : isCycle ? (
            <>
              <MetricRow
                label={SV.intakter}
                amountMinor={cycle.incomeMinor}
                currency={currency}
                tone="positive"
              />
              <MetricRow
                label={SV.utgifter}
                amountMinor={cycle.expenseMinor}
                currency={currency}
                hint="Planerade i perioden"
              />
              <MetricRow
                label={SV.kvarIPerioden}
                amountMinor={cycle.remainingFreeMinor}
                currency={currency}
                tone={cycle.remainingFreeMinor >= 0 ? "positive" : "danger"}
              />
              <MetricRow
                label={SV.sparande}
                amountMinor={cycle.savingsMinor}
                currency={currency}
              />
              <MetricRow
                label={SV.spenderatIPerioden}
                amountMinor={data.cycleSpendingMinor}
                currency={currency}
              />
            </>
          ) : null}
        </div>
      </section>

      {!isEmpty ? (
        <section className="animate-rise-delay-2 space-y-4">
          <hr className="numa-divider" />
          <LineList
            title={isBridge ? "Kommande intäkter" : "Intäkter"}
            empty={isBridge ? "Inga kommande." : "Inga i perioden."}
            lines={cycle.incomes}
            currency={currency}
            totalMinor={cycle.incomeMinor}
          />
          <LineList
            title={isBridge ? "Kommande utgifter" : "Utgifter"}
            empty={isBridge ? "Inga kommande." : "Inga i perioden."}
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

        <div className="numa-panel-list px-4 py-1">
          <MetricRow
            label={SV.intakter}
            amountMinor={month.incomeMinor}
            currency={currency}
            tone="positive"
          />
          <MetricRow
            label={SV.utgifter}
            amountMinor={month.expenseMinor}
            currency={currency}
          />
          <MetricRow
            label={SV.sparande}
            amountMinor={month.savingsMinor}
            currency={currency}
          />
          <MetricRow
            label="Kvar i månaden (plan)"
            amountMinor={month.freeToSpendMinor}
            currency={currency}
            tone={month.freeToSpendMinor >= 0 ? "positive" : "danger"}
            hint="Planerat, före faktiska köp"
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
              label={SV.saldo}
              amountMinor={data.calculatedBalanceMinor!}
              currency={currency}
              hint={data.verificationLabel ?? undefined}
            />
          ) : (
            <MetricRow
              label={SV.saldo}
              hint="Ange på Hem eller fota SMS"
            />
          )}
          <MetricRow
            label="Spenderat denna månad"
            amountMinor={data.monthSpendingMinor}
            currency={currency}
          />
          <MetricRow
            label={SV.spenderatIdag}
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
