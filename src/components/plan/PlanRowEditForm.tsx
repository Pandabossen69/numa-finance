"use client";

import type { PlanItem } from "@/domain/finance";
import { parseUiAmountToMinor } from "@/domain/money";
import { PlanDateField } from "@/components/plan/PlanDateField";

export function PlanRowEditForm({
  item,
  settleKind,
  canUndo,
  editName,
  editAmount,
  editExtra,
  editSettledAmount,
  editRestDate,
  pending,
  onEditName,
  onEditAmount,
  onEditExtra,
  onEditSettledAmount,
  onEditRestDate,
  onSave,
  onCancel,
}: {
  item: PlanItem;
  settleKind: "income" | "expense";
  canUndo: boolean;
  editName: string;
  editAmount: string;
  editExtra: string;
  editSettledAmount: string;
  editRestDate: string;
  pending: boolean;
  onEditName: (v: string) => void;
  onEditAmount: (v: string) => void;
  onEditExtra: (v: string) => void;
  onEditSettledAmount: (v: string) => void;
  onEditRestDate: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const settledLabel = settleKind === "income" ? "Mottaget" : "Betalt";
  const restPrompt =
    settleKind === "income" ? "När kommer resten?" : "När ska resten betalas?";
  let bookedPreview: number | null = null;
  if (canUndo && editSettledAmount.trim()) {
    try {
      bookedPreview = parseUiAmountToMinor(editSettledAmount);
    } catch {
      bookedPreview = null;
    }
  }
  let planPreview = item.amountMinor;
  if (editAmount.trim()) {
    try {
      planPreview = parseUiAmountToMinor(editAmount);
    } catch {
      // keep current plan amount
    }
  }
  const showRestDate =
    canUndo &&
    bookedPreview != null &&
    bookedPreview > 0 &&
    bookedPreview < planPreview;

  return (
    <li className="numa-plan-row is-form space-y-3">
      <input
        value={editName}
        onChange={(e) => onEditName(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
      />
      {canUndo ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--numa-muted)]">
              Planerat
            </span>
            <input
              inputMode="decimal"
              value={editAmount}
              onChange={(e) => onEditAmount(e.target.value)}
              className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base font-semibold"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--numa-muted)]">
              {settledLabel}
            </span>
            <input
              inputMode="decimal"
              value={editSettledAmount}
              onChange={(e) => onEditSettledAmount(e.target.value)}
              className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base font-semibold"
            />
          </label>
        </div>
      ) : (
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
      )}
      {canUndo ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--numa-muted)]">
              Datum
            </span>
            <PlanDateField
              value={editExtra}
              onChange={onEditExtra}
              ariaLabel="Datum"
            />
          </label>
          {showRestDate ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--numa-muted)]">
                {restPrompt}
              </span>
              <PlanDateField
                value={editRestDate}
                onChange={onEditRestDate}
                ariaLabel={restPrompt}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className="numa-btn numa-btn-accent min-h-10 flex-1"
          onClick={onSave}
        >
          {pending ? "Sparar…" : "Spara"}
        </button>
        <button
          type="button"
          disabled={pending}
          className="numa-press min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
          onClick={onCancel}
        >
          Avbryt
        </button>
      </div>
    </li>
  );
}
