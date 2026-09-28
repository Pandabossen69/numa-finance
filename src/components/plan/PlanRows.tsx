"use client";

import { memo, useState } from "react";
import type { PlanItem } from "@/domain/finance";
import {
  formatListDateSv,
  planPartialBreakdown,
  planRowHeroMinor,
  planRowView,
  remainingDueIso,
  sortPlanRowsForList,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";
import { OverflowMenu, type OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { SV, planDoneLabel, planPartialLabel } from "@/features/copy/labels-sv";
import { isTempPlanId } from "@/features/plan/optimistic";
import { PlanEquation } from "@/components/plan/PlanEquation";
import { planChipClass, planChipLabel } from "@/components/plan/plan-chip";
import {
  PlanRowEditFields,
  PlanRowPartialFields,
  type PlanEditDraft,
  type PlanPartialDraft,
} from "@/components/plan/PlanRowForms";

const PlanListRow = memo(function PlanListRow({
  item,
  settleKind,
  currency,
  timeZone,
  subtitle,
  pendingId,
  pendingAction,
  confirming,
  onConfirmId,
  onSettle,
  onMarkRemainder,
  onStartPartial,
  onStartEdit,
  onDelete,
}: {
  item: PlanItem;
  settleKind: "income" | "expense";
  currency: CurrencyCode;
  timeZone: string;
  subtitle: (item: PlanItem) => string;
  pendingId: string | null;
  pendingAction: "save" | "delete" | "settle" | null;
  confirming: boolean;
  onConfirmId: (id: string | null) => void;
  onSettle: (id: string, settled: boolean) => void;
  onMarkRemainder: (id: string) => void;
  onStartPartial: (item: PlanItem) => void;
  onStartEdit: (item: PlanItem) => void;
  onDelete: (id: string) => void;
}) {
  const rowCurrency = (item.currency || currency) as CurrencyCode;
  const dateLabel = subtitle(item);
  const restIso = remainingDueIso(item);
  const restLabel = restIso ? formatListDateSv(restIso, timeZone) : null;
  const breakdown = planPartialBreakdown(item);
  // Derived from the user's taps in one place. A ledger match is a money
  // guess for Över — it never reaches the row.
  const { status, settled, partial, canUndo } = planRowView(item);
  const doneLabel = planDoneLabel(settleKind);
  const partialLabel = planPartialLabel(settleKind);
  const addPartialLabel =
    settleKind === "income" ? "Lägg till mottaget" : "Lägg till betalt";
  const markRestLabel =
    settleKind === "income" ? "Markera resten mottagen" : "Markera resten betald";
  const menuItems: OverflowMenuItem[] = [];
  if (status === "open") {
    menuItems.push({
      label: doneLabel,
      disabled: pendingId === item.id && pendingAction === "settle",
      onSelect: () => onSettle(item.id, true),
    });
    menuItems.push({
      label: partialLabel,
      onSelect: () => {
        onConfirmId(null);
        onStartPartial(item);
      },
    });
    menuItems.push({
      label: "Redigera",
      onSelect: () => {
        onConfirmId(null);
        onStartEdit(item);
      },
    });
  } else if (status === "partial") {
    menuItems.push({
      label: addPartialLabel,
      onSelect: () => {
        onConfirmId(null);
        onStartPartial(item);
      },
    });
    menuItems.push({
      label: markRestLabel,
      disabled: pendingId === item.id && pendingAction === "settle",
      onSelect: () => onMarkRemainder(item.id),
    });
    menuItems.push({
      label: "Redigera",
      onSelect: () => {
        onConfirmId(null);
        onStartEdit(item);
      },
    });
    menuItems.push({
      label: SV.angraKlar,
      disabled: pendingId === item.id && pendingAction === "settle",
      onSelect: () => onSettle(item.id, false),
    });
  } else {
    menuItems.push({
      label: SV.angraKlar,
      disabled: pendingId === item.id && pendingAction === "settle",
      onSelect: () => onSettle(item.id, false),
    });
    menuItems.push({
      label: "Redigera",
      onSelect: () => {
        onConfirmId(null);
        onStartEdit(item);
      },
    });
  }
  menuItems.push({
    label: "Ta bort",
    tone: "danger",
    disabled: pendingId === item.id && pendingAction === "delete",
    onSelect: () => onConfirmId(item.id),
  });

  const rowState = [
    settled ? "is-settled" : partial ? "is-partial" : "",
    isTempPlanId(item.id) ? "is-fresh" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={`numa-plan-row ${rowState}`.trim()}>
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
      ) : confirming ? (
        <div className="numa-plan-confirm">
          <button
            type="button"
            disabled={pendingId === item.id && pendingAction === "delete"}
            className="numa-press inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-[var(--numa-danger)] hover:bg-[var(--numa-danger-soft)]/70 disabled:opacity-45"
            onClick={() => {
              onDelete(item.id);
              onConfirmId(null);
            }}
          >
            Ta bort
          </button>
          <button
            type="button"
            className="numa-press inline-flex min-h-11 items-center rounded-xl px-2.5 text-sm text-[var(--numa-muted)]"
            onClick={() => onConfirmId(null)}
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
});

export function PlanRows({
  items,
  settleKind,
  currency,
  timeZone,
  monthKey,
  editingId,
  emptyHint = "Inget inlagt.",
  subtitle,
  pendingId = null,
  pendingAction = null,
  onSettle,
  onMarkRemainder,
  partialId,
  partialPrompt,
  remainingDatePrompt,
  onStartPartial,
  onCancelPartial,
  onSavePartial,
  saveError = null,
  settleAccounts = [],
  settleAccountId = "",
  onSettleAccountId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: PlanItem[];
  settleKind: "income" | "expense";
  currency: CurrencyCode;
  timeZone: string;
  monthKey: string;
  editingId: string | null;
  emptyHint?: string;
  subtitle: (item: PlanItem) => string;
  pendingId?: string | null;
  pendingAction?: "save" | "delete" | "settle" | null;
  onSettle: (id: string, settled: boolean) => void;
  onMarkRemainder: (id: string) => void;
  partialId: string | null;
  partialPrompt: string;
  remainingDatePrompt: string;
  onStartPartial: (item: PlanItem) => void;
  onCancelPartial: () => void;
  onSavePartial: (id: string, draft: PlanPartialDraft) => void;
  saveError?: string | null;
  settleAccounts?: Array<{ id: string; name: string; currency: string }>;
  settleAccountId?: string;
  onSettleAccountId?: (id: string) => void;
  onStartEdit: (item: PlanItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, draft: PlanEditDraft) => void;
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
        if (editingId === item.id) {
          return (
            <PlanRowEditFields
              key={item.id}
              item={item}
              timeZone={timeZone}
              pendingId={pendingId}
              pendingAction={pendingAction}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          );
        }
        if (partialId === item.id) {
          return (
            <PlanRowPartialFields
              key={item.id}
              item={item}
              settleKind={settleKind}
              currency={currency}
              timeZone={timeZone}
              monthKey={monthKey}
              pendingId={pendingId}
              pendingAction={pendingAction}
              partialPrompt={partialPrompt}
              remainingDatePrompt={remainingDatePrompt}
              settleAccounts={settleAccounts}
              settleAccountId={settleAccountId}
              onSettleAccountId={onSettleAccountId}
              onSave={onSavePartial}
              saveError={saveError}
              onCancel={onCancelPartial}
            />
          );
        }
        return (
          <PlanListRow
            key={item.id}
            item={item}
            settleKind={settleKind}
            currency={currency}
            timeZone={timeZone}
            subtitle={subtitle}
            pendingId={pendingId}
            pendingAction={pendingAction}
            confirming={confirmId === item.id}
            onConfirmId={setConfirmId}
            onSettle={onSettle}
            onMarkRemainder={onMarkRemainder}
            onStartPartial={onStartPartial}
            onStartEdit={onStartEdit}
            onDelete={onDelete}
          />
        );
      })}
    </ul>
  );
}
