"use client";

import { memo, useMemo, useState } from "react";
import type { PlanItem } from "@/domain/finance";
import {
  isoToDateInput,
  previewAdditionalPartialRemaining,
  remainingDueIso,
  settledAmountMinor,
} from "@/domain/finance";
import { planPartialLabel } from "@/features/copy/labels-sv";
import { parseUiAmountToMinor, type CurrencyCode } from "@/domain/money";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { PlanDateField } from "@/components/plan/PlanDateField";
import { PlanEquation } from "@/components/plan/PlanEquation";
import { minorToUi } from "@/components/plan/plan-format";

export type PlanEditDraft = {
  name: string;
  amount: string;
  date: string;
};

export type PlanPartialDraft = {
  amount: string;
  date: string;
};

export const PlanRowEditFields = memo(function PlanRowEditFields({
  item,
  timeZone,
  pendingId,
  pendingAction,
  onSave,
  onCancel,
}: {
  item: PlanItem;
  timeZone: string;
  pendingId: string | null;
  pendingAction: "save" | "delete" | "settle" | null;
  onSave: (id: string, draft: PlanEditDraft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(() => minorToUi(item.amountMinor));
  const [date, setDate] = useState(() =>
    isoToDateInput(remainingDueIso(item), timeZone),
  );
  const saving = pendingId === item.id && pendingAction === "save";

  return (
    <li className="numa-plan-row is-form space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-transparent px-3 text-sm"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base font-semibold"
        />
        <PlanDateField value={date} onChange={setDate} ariaLabel="Datum" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          className="numa-btn numa-btn-accent min-h-10 flex-1"
          onClick={() => onSave(item.id, { name, amount, date })}
        >
          {saving ? "Sparar…" : "Spara"}
        </button>
        <button
          type="button"
          disabled={pendingId === item.id}
          className="numa-press min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
          onClick={onCancel}
        >
          Avbryt
        </button>
      </div>
    </li>
  );
});

export const PlanRowPartialFields = memo(function PlanRowPartialFields({
  item,
  settleKind,
  currency,
  timeZone,
  monthKey,
  pendingId,
  pendingAction,
  partialPrompt,
  remainingDatePrompt,
  settleAccounts,
  settleAccountId,
  onSettleAccountId,
  onSave,
  saveError = null,
  onCancel,
}: {
  item: PlanItem;
  settleKind: "income" | "expense";
  currency: CurrencyCode;
  timeZone: string;
  monthKey: string;
  pendingId: string | null;
  pendingAction: "save" | "delete" | "settle" | null;
  partialPrompt: string;
  remainingDatePrompt: string;
  settleAccounts: Array<{ id: string; name: string; currency: string }>;
  settleAccountId: string;
  onSettleAccountId?: (id: string) => void;
  onSave: (id: string, draft: PlanPartialDraft) => void;
  saveError?: string | null;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [partialDate, setPartialDate] = useState(
    () => isoToDateInput(remainingDueIso(item), timeZone) || `${monthKey}-01`,
  );
  const rowCurrency = (item.currency || currency) as CurrencyCode;
  const preview = useMemo(() => {
    let typedMinor: number | null = null;
    if (amount.trim()) {
      try {
        typedMinor = parseUiAmountToMinor(amount);
      } catch {
        typedMinor = null;
      }
    }
    return previewAdditionalPartialRemaining(
      item.amountMinor,
      settledAmountMinor(item),
      typedMinor,
    );
  }, [amount, item]);
  const settling = pendingId === item.id && pendingAction === "settle";

  return (
    <li className="numa-plan-row is-form is-partial space-y-3">
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
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Belopp (${rowCurrency})`}
          className="money min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base font-semibold"
        />
      </label>
      {settleAccounts.length > 0 ? (
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--numa-muted)]">
            Konto
          </span>
          <select
            value={settleAccountId}
            onChange={(e) => onSettleAccountId?.(e.target.value)}
            aria-label="Konto för bokningen"
            className="min-h-11 w-full rounded-xl border border-[var(--numa-border)] bg-[var(--numa-bg)] px-3 text-base"
          >
            {settleAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.currency}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
          onChange={setPartialDate}
          ariaLabel={remainingDatePrompt}
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={settling || !amount.trim() || !partialDate.trim()}
          className="numa-btn numa-btn-accent min-h-10 flex-1"
          onClick={() => onSave(item.id, { amount, date: partialDate })}
        >
          {settling ? "Sparar…" : "Spara"}
        </button>
        <button
          type="button"
          disabled={pendingId === item.id}
          className="numa-press min-h-10 rounded-xl px-3 text-sm text-[var(--numa-muted)] disabled:opacity-45"
          onClick={onCancel}
        >
          Avbryt
        </button>
      </div>
      {saveError ? (
        <p className="text-sm text-[var(--numa-danger)]" role="alert">
          {saveError}
        </p>
      ) : null}
    </li>
  );
});
