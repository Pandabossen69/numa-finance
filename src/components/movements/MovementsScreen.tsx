"use client";

import { useEffect, useMemo, useState } from "react";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import {
  getMovementsSnapshotAction,
  type MovementsSnapshot,
} from "@/features/finance/movements-snapshot";

type Filter = "all" | "expense" | "income" | "other";
type Period = "month" | "all";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Alla" },
  { id: "expense", label: "Utgifter" },
  { id: "income", label: "Intäkter" },
  { id: "other", label: "Övrigt" },
];

function typeLabel(type: string): string {
  switch (type) {
    case "expense":
      return "Utgift";
    case "income":
      return "Inkomst";
    case "transfer":
      return "Överföring";
    case "cash_withdrawal":
      return "Kontantuttag";
    case "refund":
      return "Återbetalning";
    default:
      return "Övrigt";
  }
}

function matchesFilter(
  tx: MovementsSnapshot["items"][number],
  filter: Filter,
): boolean {
  if (filter === "all") return true;
  if (filter === "expense") return tx.transactionType === "expense";
  if (filter === "income") return tx.transactionType === "income";
  return (
    tx.transactionType !== "expense" && tx.transactionType !== "income"
  );
}

function inCurrentMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export function MovementsScreen() {
  const [data, setData] = useState<MovementsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getMovementsSnapshotAction();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setData(result.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter((tx) => {
      if (!matchesFilter(tx, filter)) return false;
      if (period === "month" && !inCurrentMonth(tx.occurredAt)) return false;
      return true;
    });
  }, [data, filter, period]);

  if (loading) {
    return (
      <p className="text-sm text-[var(--numa-muted)]">Hämtar rörelser…</p>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-2">
        <p className="font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
      </div>
    );
  }

  const income =
    period === "month" ? data.monthIncomeMinor : data.allIncomeMinor;
  const expense =
    period === "month" ? data.monthExpenseMinor : data.allExpenseMinor;
  const net = period === "month" ? data.monthNetMinor : data.allNetMinor;
  const maxCategory = data.monthCategories[0]?.amountMinor || 1;

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <p className="text-sm font-medium text-[var(--numa-accent)]">
          Ekonomi · översikt
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Utgifter & intäkter
        </h1>
        <p className="mt-2 max-w-[40ch] text-sm text-[var(--numa-muted)]">
          Totalt in, totalt ut och vad som blir över — plus varje rörelse.
        </p>
      </header>

      <div className="animate-rise-delay-1 flex gap-2">
        <PeriodChip
          active={period === "month"}
          onClick={() => setPeriod("month")}
          label="Denna månad"
        />
        <PeriodChip
          active={period === "all"}
          onClick={() => setPeriod("all")}
          label="All tid"
        />
      </div>

      <section className="numa-panel-strong animate-rise-delay-1 grid gap-4 p-5 sm:grid-cols-3">
        <SummaryStat
          label="Intäkter"
          amountMinor={income}
          currency={data.currency}
          tone="positive"
        />
        <SummaryStat
          label="Utgifter"
          amountMinor={expense}
          currency={data.currency}
          tone="danger"
        />
        <SummaryStat
          label="Blir över"
          amountMinor={net}
          currency={data.currency}
          tone={net >= 0 ? "positive" : "danger"}
          signed
        />
      </section>

      <section className="animate-rise-delay-2 grid gap-3 sm:grid-cols-2">
        <div className="numa-panel p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            Saldo nu
          </p>
          <div className="mt-2">
            <MoneyDisplay
              amountMinor={data.balanceMinor}
              currency={data.currency}
              size="md"
            />
          </div>
          <p className="mt-2 text-xs text-[var(--numa-muted)]">
            {data.hasBankTruth
              ? "Från bank-SMS / beräkning"
              : "Väntar på första bank-SMS"}
          </p>
        </div>
        <div className="numa-panel p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
            Fritt efter plan
          </p>
          <div className="mt-2">
            <MoneyDisplay
              amountMinor={data.freeMinor}
              currency={data.currency}
              size="md"
            />
          </div>
          <p className="mt-2 text-xs text-[var(--numa-muted)]">
            Reserverat {(data.reservedMinor / 100).toLocaleString("sv-SE")} ·
            buffert {(data.bufferMinor / 100).toLocaleString("sv-SE")} · tryggt
            idag{" "}
            {(data.safeToSpendTodayMinor / 100).toLocaleString("sv-SE", {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </section>

      {period === "month" && data.monthCategories.length > 0 ? (
        <section className="numa-panel animate-rise-delay-2 p-5">
          <h2 className="text-sm font-semibold">Utgifter per kategori</h2>
          <ul className="mt-4 space-y-3">
            {data.monthCategories.map((cat) => (
              <li key={cat.name}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--numa-muted)]">
                    {cat.name}
                    <span className="ml-2 text-xs text-[var(--numa-faint)]">
                      {cat.count}×
                    </span>
                  </span>
                  <MoneyDisplay
                    amountMinor={cat.amountMinor}
                    currency={data.currency}
                    size="sm"
                  />
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--numa-bg-deep)]">
                  <div
                    className="h-full rounded-full bg-[var(--numa-accent)]"
                    style={{
                      width: `${Math.max(6, (cat.amountMinor / maxCategory) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="animate-rise-delay-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${
              filter === f.id
                ? "bg-[var(--numa-accent-soft)] text-[var(--numa-accent-ink)]"
                : "text-[var(--numa-muted)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="animate-rise-delay-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            {filtered.length} rörelser
          </h2>
          <a
            href="/fota"
            className="text-xs font-semibold text-[var(--numa-accent)]"
          >
            + Fota / lägg till
          </a>
        </div>

        {filtered.length === 0 ? (
          <div className="numa-panel space-y-3 p-5">
            <p className="text-sm text-[var(--numa-muted)]">
              Inga rörelser här ännu. Fota ett bank-SMS eller lägg till manuellt.
            </p>
            <a
              href="/fota"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-[var(--numa-accent)] px-4 text-sm font-semibold text-white"
            >
              Fota SMS
            </a>
          </div>
        ) : (
          <ul className="numa-panel divide-y divide-[var(--numa-border)] overflow-hidden">
            {filtered.map((tx) => {
              const signed =
                tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
              return (
                <li
                  key={tx.id}
                  className="flex items-start justify-between gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                      {tx.description}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--numa-faint)]">
                      {typeLabel(tx.transactionType)}
                      {tx.category ? ` · ${tx.category}` : ""} ·{" "}
                      {new Date(tx.occurredAt).toLocaleString("sv-SE", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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

function PeriodChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
        active
          ? "bg-[var(--numa-ink)] text-white"
          : "bg-white/60 text-[var(--numa-muted)]"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryStat({
  label,
  amountMinor,
  currency,
  tone,
  signed = false,
}: {
  label: string;
  amountMinor: number;
  currency: MovementsSnapshot["currency"];
  tone: "positive" | "danger" | "neutral";
  signed?: boolean;
}) {
  const color =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "danger"
        ? "text-[var(--numa-danger)]"
        : "text-[var(--numa-ink)]";

  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--numa-faint)]">
        {label}
      </p>
      <div className={`mt-2 ${color}`}>
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          size="md"
          tone={signed ? "signed" : "neutral"}
        />
      </div>
    </div>
  );
}
