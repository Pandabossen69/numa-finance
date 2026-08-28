"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { MetricRow } from "@/components/ui/MetricRow";
import { RetryLoadButton } from "@/components/ui/RetryLoadButton";
import {
  updateTransactionAction,
  voidTransactionAction,
} from "@/features/finance/actions";
import { formatListDateSv, monthKeyFromDate } from "@/domain/finance";
import { minorToUiAmount } from "@/domain/imports/amount-parse";
import { sanitizeMoneyDescription } from "@/domain/money";
import type { MovementsSnapshot } from "@/features/finance/load-movements";

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
  return tx.transactionType !== "expense" && tx.transactionType !== "income";
}

function inMonthKey(iso: string, monthKey: string, timeZone: string): boolean {
  return monthKeyFromDate(new Date(iso), timeZone) === monthKey;
}

function minorToUi(amountMinor: number): string {
  return minorToUiAmount(amountMinor);
}

export function MovementsScreen({
  data,
  error,
}: {
  data: MovementsSnapshot | null;
  error?: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [period, setPeriod] = useState<Period>("month");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirmId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter((tx) => {
      if (!matchesFilter(tx, filter)) return false;
      if (
        period === "month" &&
        !inMonthKey(tx.occurredAt, data.monthKey, data.timeZone)
      ) {
        return false;
      }
      return true;
    });
  }, [data, filter, period]);

  if (error || !data) {
    return (
      <div className="space-y-2">
        <p className="font-semibold">Kunde inte ladda</p>
        <p className="text-sm text-[var(--numa-muted)]">{error ?? "Okänt fel"}</p>
        <RetryLoadButton />
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
    <div className="numa-page numa-page-wide min-w-0 overflow-x-hidden space-y-7">
      <header className="animate-rise">
        <h1 className="numa-page-title">Rörelser</h1>
      </header>

      <div className="numa-equal-chips animate-rise-delay-1">
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

      <section className="numa-panel-strong numa-stat-trio animate-rise-delay-1 p-5">
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
          tone="alarm"
        />
        <SummaryStat
          label="Netto"
          amountMinor={net}
          currency={data.currency}
          tone={net >= 0 ? "positive" : "alarm"}
          signed
        />
      </section>

      {data.hasBankTruth && data.balanceMinor != null ? (
        <section className="numa-money-stack animate-rise-delay-2 animate-scale-in">
          <MetricRow
            label="Saldo"
            amountMinor={data.balanceMinor}
            currency={data.currency}
          />
        </section>
      ) : null}

      {period === "month" && data.monthCategories.length > 0 ? (
        <section className="numa-panel animate-rise-delay-2 p-5">
          <h2 className="numa-section-title">Per kategori</h2>
          <ul className="mt-4 space-y-3">
            {data.monthCategories.map((cat) => (
              <li key={cat.name}>
                <div className="numa-money-line mb-1.5 text-sm">
                  <span className="numa-money-line-label text-[var(--numa-muted)]">
                    {cat.name}
                    <span className="ml-2 text-xs text-[var(--numa-faint)]">
                      {cat.count}×
                    </span>
                  </span>
                  <span className="numa-money-line-amt">
                    <MoneyDisplay
                      amountMinor={cat.amountMinor}
                      currency={data.currency}
                      size="sm"
                      wrap={false}
                    />
                  </span>
                </div>
                <div className="numa-progress animate-bar">
                  <span
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

      <div className="numa-equal-chips is-quad animate-rise-delay-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`numa-press min-h-11 rounded-full px-2.5 text-sm font-semibold ${
              filter === f.id
                ? "bg-[var(--numa-ink)] text-white"
                : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="animate-rise-delay-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{filtered.length} rörelser</h2>
          <Link
            href="/fota"
            prefetch
            className="numa-tap text-xs font-semibold text-[var(--numa-accent)]"
          >
            + Lägg till
          </Link>
        </div>

        {actionError ? (
          <p className="text-sm text-[var(--numa-danger)]" role="alert">
            {actionError}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <div className="numa-panel space-y-3 p-5">
            {(data?.items.length ?? 0) > 0 ? (
              <p className="text-sm text-[var(--numa-muted)]">
                Inga träffar för filtret — prova Alla eller All tid.
              </p>
            ) : (
              <>
                <p className="text-sm text-[var(--numa-muted)]">
                  Inga rörelser här ännu.
                </p>
                <Link
                  href="/fota"
                  prefetch
                  className="numa-btn numa-btn-accent inline-flex min-h-11 px-4"
                >
                  Lägg till
                </Link>
              </>
            )}
          </div>
        ) : (
          <ul className="numa-panel-list divide-y divide-[var(--numa-border)]">
            {filtered.map((tx) => {
              const signed =
                tx.direction === "debit" ? -tx.amountMinor : tx.amountMinor;
              const canEdit =
                tx.transactionType === "expense" ||
                tx.transactionType === "income";

              if (editingId === tx.id) {
                return (
                  <li key={tx.id} className="space-y-3 px-4 py-3.5">
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Beskrivning"
                      className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
                    />
                    <input
                      inputMode="decimal"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="money min-h-12 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-card)] px-3 text-lg font-semibold"
                    />
                    {tx.transactionType === "expense" ? (
                      <input
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Kategori"
                        className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
                      />
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="numa-btn numa-btn-accent flex-1"
                        onClick={() => {
                          setActionError(null);
                          void (async () => {
                            const result = await updateTransactionAction({
                              id: tx.id,
                              amount: editAmount,
                              description: editDescription,
                              category:
                                tx.transactionType === "expense"
                                  ? editCategory || null
                                  : undefined,
                            });
                            if (!result.ok) {
                              setActionError(result.error);
                              return;
                            }
                            setEditingId(null);
                            router.refresh();
                          })();
                        }}
                      >
                        Spara
                      </button>
                      <button
                        type="button"
                        className="numa-tap min-h-11 rounded-xl px-3 text-sm text-[var(--numa-muted)]"
                        onClick={() => setEditingId(null)}
                      >
                        Avbryt
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li
                  key={tx.id}
                  className="numa-money-line items-start px-4 py-3.5"
                >
                  <div className="numa-money-line-label">
                    <p className="truncate text-sm font-medium text-[var(--numa-ink)]">
                      {sanitizeMoneyDescription(tx.description)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--numa-faint)]">
                      {[
                        filter === "all" ? typeLabel(tx.transactionType) : null,
                        filter === "all" || filter === "expense"
                          ? tx.category
                          : null,
                        formatListDateSv(tx.occurredAt, data.timeZone, {
                          withTime: true,
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {canEdit && (confirmId == null || confirmId === tx.id) ? (
                      confirmId === tx.id ? (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="numa-press numa-tap px-1 text-xs font-semibold text-[var(--numa-danger)]"
                            onClick={() => {
                              setActionError(null);
                              setConfirmId(null);
                              void (async () => {
                                const result = await voidTransactionAction(tx.id);
                                if (!result.ok) {
                                  setActionError(result.error);
                                  return;
                                }
                                router.refresh();
                              })();
                            }}
                          >
                            Ta bort
                          </button>
                          <button
                            type="button"
                            className="numa-press numa-tap px-1 text-xs text-[var(--numa-muted)]"
                            onClick={() => setConfirmId(null)}
                          >
                            Avbryt
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="numa-press numa-tap px-1 text-xs font-semibold text-[var(--numa-accent)]"
                            onClick={() => {
                              setEditingId(tx.id);
                              setConfirmId(null);
                              setEditAmount(minorToUi(tx.amountMinor));
                              setEditDescription(tx.description);
                              setEditCategory(tx.category ?? "");
                              setActionError(null);
                            }}
                          >
                            Redigera
                          </button>
                          <button
                            type="button"
                            className="numa-press numa-tap px-1 text-xs text-[var(--numa-muted)]"
                            onClick={() => setConfirmId(tx.id)}
                          >
                            Ta bort
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                  <span className="numa-money-line-amt">
                    <MoneyDisplay
                      amountMinor={signed}
                      currency={tx.currency}
                      size="sm"
                      tone="signed"
                      wrap={false}
                    />
                  </span>
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
      className={`numa-press min-h-11 rounded-full px-3 text-sm font-semibold ${
        active
          ? "bg-[var(--numa-ink)] text-white"
          : "bg-[var(--numa-card)] text-[var(--numa-muted)] ring-1 ring-[var(--numa-border-strong)]"
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
  tone: "positive" | "alarm" | "neutral";
  signed?: boolean;
}) {
  const color =
    tone === "positive"
      ? "text-[var(--numa-positive)]"
      : tone === "alarm"
        ? "text-[var(--numa-alarm)]"
        : "text-[var(--numa-ink)]";

  return (
    <div className="min-w-0">
      <p className="numa-section-title">{label}</p>
      <div className={`numa-hero-money mt-2 ${color}`}>
        <MoneyDisplay
          amountMinor={amountMinor}
          currency={currency}
          size="md"
          tone={signed ? "signed" : "neutral"}
          wrap={false}
        />
      </div>
    </div>
  );
}
