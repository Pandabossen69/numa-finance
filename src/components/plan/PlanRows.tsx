"use client";

import { useState } from "react";
import type { PlanItem } from "@/domain/finance";
import {
  formatListDateSv,
  planPartialBreakdown,
  planRowHeroMinor,
  planRowView,
  previewPartialRemaining,
  remainingDueIso,
  sortPlanRowsForList,
} from "@/domain/finance";
import { parseUiAmountToMinor, type CurrencyCode } from "@/domain/money";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { OverflowMenu, type OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { SV, planDoneLabel, planPartialLabel } from "@/features/copy/labels-sv";
import { isTempPlanId } from "@/features/plan/optimistic";
import { PlanDateField } from "@/components/plan/PlanDateField";
import { PlanEquation } from "@/components/plan/PlanEquation";
import { planChipClass, planChipLabel } from "@/components/plan/plan-chip";

export function PlanRows({
  items,
  settleKind,
  currency,
  timeZone,
  editingId,
  editName,
  editAmount,
  editExtra,
  emptyHint = "Inget inlagt.",
  subtitle,
  pendingId = null,
  pendingAction = null,
  onSettle,
  partialId,
  partialAmount,
  partialDate,
  partialPrompt,
  remainingDatePrompt,
  onPartialAmount,
  onPartialDate,
  onStartPartial,
  onCancelPartial,
  onSavePartial,
  onEditName,
  onEditAmount,
  onEditExtra,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: PlanItem[];
  settleKind: "income" | "expense";
  currency: CurrencyCode;
  timeZone: string;
  editingId: string | null;
  editName: string;
  editAmount: string;
  editExtra: string;
  emptyHint?: string;
  subtitle: (item: PlanItem) => string;
  pendingId?: string | null;
  pendingAction?: "save" | "delete" | "settle" | null;
  onSettle: (id: string, settled: boolean) => void;
  partialId: string | null;
  partialAmount: string;
  partialDate: string;
  partialPrompt: string;
  remainingDatePrompt: string;
  onPartialAmount: (v: string) => void;
  onPartialDate: (v: string) => void;
  onStartPartial: (item: PlanItem) => void;
  onCancelPartial: () => void;
  onSavePartial: (id: string) => void;
  onEditName: (v: string) => void;
  onEditAmount: (v: string) => void;
  onEditExtra: (v: string) => void;
  onStartEdit: (item: PlanItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="py-4 text-sm text-[var(--numa-muted)]">{emptyHint}</p>;
  }

  const rows = sortPlanRowsForList(items);

  return (
    <ul className="numa-plan-list">
      {rows.map((item) => {
        const rowCurrency = (item.currency || currency) as CurrencyCode;
        const dateLabel = subtitle(item);
        const restIso = remainingDueIso(item);
        const restLabel = restIso ? formatListDateSv(restIso, timeZone) : null;
        const breakdown = planPartialBreakdown(item);
        // Derived from the user's taps in one place. A ledger match is a money
        // guess for Över — it never reaches the row.
        const { status, settled, partial, canUndo } = planRowView(item);

        if (editingId === item.id) {
          return (
            <li key={item.id} className="numa-plan-row is-form space-y-3">
              <input
                value={editName}
                onChange={(e) => onEditName(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(e) => onEditAmount(e.target.value)}
                  className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base font-semibold"
                />
                <PlanDateField
                  value={editExtra}
                  onChange={onEditExtra}
                  ariaLabel="Datum"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pendingId === item.id && pendingAction === "save"}
                  className="numa-btn numa-btn-accent min-h-10 flex-1"
                  onClick={() => onSaveEdit(item.id)}
                >
                  {pendingId === item.id && pendingAction === "save"
                    ? "Sparar…"
                    : "Spara"}
                </button>
                <button
                  type="button"
                  disabled={pendingId === item.id}
                  className="numa-press min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
                  onClick={onCancelEdit}
                >
                  Avbryt
                </button>
              </div>
            </li>
          );
        }

        if (partialId === item.id) {
          let typedMinor: number | null = null;
          if (partialAmount.trim()) {
            try {
              typedMinor = parseUiAmountToMinor(partialAmount);
            } catch {
              typedMinor = null;
            }
          }
          const preview = previewPartialRemaining(item.amountMinor, typedMinor);
          return (
            <li key={item.id} className="numa-plan-row is-form is-partial space-y-3">
              <div>
                <p className="numa-plan-name">{item.name}</p>
                <p className="numa-plan-meta">{planPartialLabel(settleKind)}</p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--numa-muted)]">
                  {partialPrompt}
                </span>
                <input
                  inputMode="decimal"
                  value={partialAmount}
                  onChange={(e) => onPartialAmount(e.target.value)}
                  placeholder={`Belopp (${rowCurrency})`}
                  className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base font-semibold"
                />
              </label>
              {preview ? (
                <div className="numa-partial-preview">
                  <p className="numa-section-title">Kvar</p>
                  <MoneyDisplay
                    amountMinor={preview.remainingMinor}
                    currency={rowCurrency}
                    size="md"
                    compact
                    align="start"
                  />
                  <PlanEquation breakdown={preview} />
                </div>
              ) : null}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[var(--numa-muted)]">
                  {remainingDatePrompt}
                </span>
                <PlanDateField
                  value={partialDate}
                  onChange={onPartialDate}
                  ariaLabel={remainingDatePrompt}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    (pendingId === item.id && pendingAction === "settle") ||
                    !partialAmount.trim() ||
                    !partialDate.trim()
                  }
                  className="numa-btn numa-btn-accent min-h-10 flex-1"
                  onClick={() => onSavePartial(item.id)}
                >
                  {pendingId === item.id && pendingAction === "settle"
                    ? "Sparar…"
                    : "Spara"}
                </button>
                <button
                  type="button"
                  disabled={pendingId === item.id}
                  className="numa-press min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
                  onClick={onCancelPartial}
                >
                  Avbryt
                </button>
              </div>
            </li>
          );
        }

        const doneLabel = planDoneLabel(settleKind);
        const partialLabel = planPartialLabel(settleKind);
        const menuItems: OverflowMenuItem[] = [];
        if (!canUndo) {
          menuItems.push({
            label: doneLabel,
            disabled: pendingId === item.id && pendingAction === "settle",
            onSelect: () => onSettle(item.id, true),
          });
          menuItems.push({
            label: partialLabel,
            onSelect: () => {
              setConfirmId(null);
              onStartPartial(item);
            },
          });
        }
        menuItems.push({
          label: "Redigera",
          onSelect: () => {
            setConfirmId(null);
            onStartEdit(item);
          },
        });
        if (canUndo) {
          menuItems.push({
            label: SV.angraKlar,
            disabled: pendingId === item.id && pendingAction === "settle",
            onSelect: () => onSettle(item.id, false),
          });
        }
        menuItems.push({
          label: "Ta bort",
          tone: "danger",
          disabled: pendingId === item.id && pendingAction === "delete",
          onSelect: () => setConfirmId(item.id),
        });

        const rowState = [
          settled ? "is-settled" : partial ? "is-partial" : "",
          isTempPlanId(item.id) ? "is-fresh" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <li key={item.id} className={`numa-plan-row ${rowState}`.trim()}>
            <div className="numa-plan-copy">
              <p className="numa-plan-name" title={item.name}>
                {item.name}
              </p>
              {breakdown ? (
                <PlanEquation breakdown={breakdown} restLabel={restLabel} />
              ) : (
                <p className="numa-plan-meta">{dateLabel}</p>
              )}
            </div>
            {isTempPlanId(item.id) ? (
              <div className="numa-plan-figures">
                <MoneyDisplay
                  amountMinor={planRowHeroMinor(item)}
                  currency={rowCurrency}
                  size="md"
                  compact
                  align="end"
                  wrap={false}
                />
              </div>
            ) : confirmId === item.id ? (
              <div className="numa-plan-confirm">
                <button
                  type="button"
                  disabled={pendingId === item.id && pendingAction === "delete"}
                  className="numa-press inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-[var(--numa-danger)] hover:bg-[var(--numa-danger-soft)]/70 disabled:opacity-45"
                  onClick={() => {
                    onDelete(item.id);
                    setConfirmId(null);
                  }}
                >
                  Ta bort
                </button>
                <button
                  type="button"
                  className="numa-press inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm text-[var(--numa-muted)]"
                  onClick={() => setConfirmId(null)}
                >
                  Avbryt
                </button>
              </div>
            ) : (
              <>
                <div className="numa-plan-figures">
                  <MoneyDisplay
                    amountMinor={planRowHeroMinor(item)}
                    currency={rowCurrency}
                    size="md"
                    compact
                    align="end"
                    wrap={false}
                  />
                  {canUndo ? (
                    <button
                      type="button"
                      className={`${planChipClass(status)} self-end`}
                      disabled={pendingId === item.id && pendingAction === "settle"}
                      aria-label={`Ångra ${settled ? doneLabel : partialLabel}`}
                      onClick={() => onSettle(item.id, false)}
                    >
                      {planChipLabel(status, settleKind)}
                    </button>
                  ) : null}
                </div>
                <div className="numa-plan-menu">
                  <OverflowMenu label={`Åtgärder för ${item.name}`} items={menuItems} />
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
