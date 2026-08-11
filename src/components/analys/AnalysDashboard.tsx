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

  return (
    <div className="space-y-8">
      <header className="animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight">Analys</h1>
        <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-[var(--numa-muted)]">
          Hur siffrorna räknas — cykel, månad och rörelser.
        </p>
      </header>

      <section className="animate-rise-delay-1 space-y-5 border-b border-[var(--numa-border)] pb-8">
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-[var(--numa-faint)]">
            {cycle.livingMode === "bridge"
              ? "Tills nästa intäkt"
              : "Aktiv inkomstcykel"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {cycle.livingMode === "bridge" && cycle.startLabelSv
              ? `Nu → ${cycle.startLabelSv}`
              : cycle.startLabelSv && cycle.endLabelSv
                ? `${cycle.startLabelSv} → ${cycle.endLabelSv}${cycle.endInferred ? " (beräknad)" : ""}`
                : "Ingen cykel ännu"}
          </h2>
          <p className="mt-1 text-sm text-[var(--numa-muted)]">
            {cycle.livingMode === "bridge"
              ? `${cycle.daysLeft} dagar kvar · Hem använder kontosaldo`
              : cycle.isActive
                ? `${cycle.daysLeft} dagar kvar till nästa månads sista intäkt`
                : "Lägg in intäkter med datum i Plan för att starta cykeln."}
          </p>
        </div>

        {cycle.livingMode === "bridge" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat
              label="Saldo"
              amountMinor={cycle.remainingFreeMinor}
              currency={currency}
              tone={cycle.remainingFreeMinor >= 0 ? "positive" : "danger"}
            />
            <Stat
              label="Kvar per dag"
              amountMinor={cycle.perDayMinor}
              currency={currency}
              tone={cycle.perDayMinor > 0 ? "positive" : undefined}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Intäkter i cykeln"
                amountMinor={cycle.incomeMinor}
                currency={currency}
                tone="positive"
              />
              <Stat
                label="Utgifter i cykeln"
                amountMinor={cycle.expenseMinor}
                currency={currency}
              />
              <Stat
                label="Planerat fritt"
                amountMinor={cycle.freeToSpendMinor}
                currency={currency}
                tone={cycle.freeToSpendMinor >= 0 ? "positive" : "danger"}
              />
              <Stat
                label="Kvar totalt"
                amountMinor={cycle.remainingFreeMinor}
                currency={currency}
                tone={cycle.remainingFreeMinor >= 0 ? "positive" : "danger"}
              />
            </div>

            <div className="grid gap-3 border-t border-[var(--numa-border)] pt-4 sm:grid-cols-3">
              <Stat
                label="Sparande"
                amountMinor={cycle.savingsMinor}
                currency={currency}
              />
              <Stat
                label="Spenderat i cykeln"
                amountMinor={data.cycleSpendingMinor}
                currency={currency}
              />
              <Stat
                label="Kvar per dag"
                amountMinor={cycle.perDayMinor}
                currency={currency}
                tone={cycle.perDayMinor > 0 ? "positive" : undefined}
              />
            </div>
          </>
        )}
      </section>

      <section className="animate-rise-delay-2 numa-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold tracking-tight">Så räknas det</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--numa-muted)]">
          {data.formula.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {cycle.livingMode !== "bridge" ? (
          <p className="text-sm text-[var(--numa-muted)]">
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

      <section className="animate-rise-delay-2 grid gap-4 lg:grid-cols-2">
        <LineCard
          title={
            cycle.livingMode === "bridge"
              ? "Kommande intäkter (räknas när de landar)"
              : "Intäkter i cykeln"
          }
          empty="Inga intäkter i cykeln."
          lines={cycle.incomes}
          currency={currency}
          totalMinor={cycle.incomeMinor}
        />
        <LineCard
          title={
            cycle.livingMode === "bridge"
              ? "Utgifter i kommande period"
              : "Utgifter i cykeln"
          }
          empty="Inga utgifter förfaller i cykeln."
          lines={cycle.expenses}
          currency={currency}
          totalMinor={cycle.expenseMinor}
        />
      </section>

      <section className="animate-rise-delay-2 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Kalendermånad · {data.monthLabelSv}
          </h2>
          <Link
            href="/plan"
            prefetch
            className="text-xs font-semibold text-[var(--numa-accent)]"
          >
            Öppna Plan →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Intäkter"
            amountMinor={month.incomeMinor}
            currency={currency}
            tone="positive"
          />
          <Stat
            label="Fasta utgifter"
            amountMinor={month.expenseMinor}
            currency={currency}
          />
          <Stat
            label="Sparande"
            amountMinor={month.savingsMinor}
            currency={currency}
          />
          <Stat
            label="Månadssaldo"
            amountMinor={month.freeToSpendMinor}
            currency={currency}
            tone={month.freeToSpendMinor >= 0 ? "positive" : "danger"}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <LineCard
            title="Intäkter denna månad"
            empty="Inga intäkter inlagda."
            lines={month.incomes}
            currency={currency}
            totalMinor={month.incomeMinor}
          />
          <LineCard
            title="Fasta utgifter"
            empty="Inga fasta utgifter."
            lines={month.expenses}
            currency={currency}
            totalMinor={month.expenseMinor}
          />
        </div>
      </section>

      <section className="animate-rise-delay-3 space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Konto & rörelser</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.calculatedBalanceMinor != null ? (
            <Stat
              label="Saldo"
              amountMinor={data.calculatedBalanceMinor}
              currency={currency}
              hint={data.verificationLabel ?? "Beräknat"}
            />
          ) : (
            <div className="numa-panel p-4">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
                Saldo
              </p>
              <p className="mt-2 text-sm text-[var(--numa-muted)]">
                {data.hasBankTruth ? "Saknas" : "Ange på Hem eller fota bank-SMS"}
              </p>
            </div>
          )}
          <Stat
            label="Spenderat denna månad"
            amountMinor={data.monthSpendingMinor}
            currency={currency}
            hint="Från bankrörelser"
          />
          <Stat
            label="Spenderat idag"
            amountMinor={data.todaySpendingMinor}
            currency={currency}
          />
        </div>
      </section>

      <section className="animate-rise-delay-3 grid gap-4 md:grid-cols-2">
        <div className="numa-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Mål</h2>
            <Link href="/plan" prefetch className="text-xs font-semibold text-[var(--numa-accent)]">
              Plan
            </Link>
          </div>
          {data.goals.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--numa-muted)]">
              Inga mål ännu.{" "}
              <Link href="/plan" prefetch className="font-semibold text-[var(--numa-accent)]">
                Lägg till i Plan →
              </Link>
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.goals.map((goal) => (
                <li
                  key={goal.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--numa-border)] pb-3 last:border-0"
                >
                  <span className="text-sm text-[var(--numa-muted)]">{goal.name}</span>
                  <MoneyDisplay
                    amountMinor={goal.amountMinor}
                    currency={currency}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="numa-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Senaste rörelser</h2>
            <Link
              href="/transaktioner"
              prefetch
              className="text-xs font-semibold text-[var(--numa-accent)]"
            >
              Se alla →
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--numa-faint)]">
              Inga rörelser ännu
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.recent.map((tx) => {
                const signed =
                  tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
                return (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--numa-border)] pb-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {tx.description}
                      </p>
                      <p className="text-xs text-[var(--numa-faint)]">
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
        </div>
      </section>
    </div>
  );
}

function Stat({
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
        : "";
  return (
    <div className="border-b border-[var(--numa-border)] py-4">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--numa-faint)]">
        {label}
      </p>
      <div className={`mt-2 ${amountClass}`}>
        <MoneyDisplay amountMinor={amountMinor} currency={currency} size="md" />
      </div>
      {hint ? (
        <p className="mt-1.5 text-xs leading-snug text-[var(--numa-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

function LineCard({
  title,
  empty,
  lines,
  currency,
  totalMinor,
}: {
  title: string;
  empty: string;
  lines: AnalysLine[];
  currency: CurrencyCode;
  totalMinor: number;
}) {
  return (
    <div className="numa-panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <MoneyDisplay amountMinor={totalMinor} currency={currency} size="sm" />
      </div>
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--numa-faint)]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-3 border-b border-[var(--numa-border)] pb-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="text-xs text-[var(--numa-faint)]">{line.detail}</p>
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
