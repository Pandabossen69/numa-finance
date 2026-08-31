import {
  monthKeyForPlanSettle,
  planItemAlreadyFundedInLedger,
  planSettleKind,
  signedPlanSettleSaldoDelta,
  type PlanSettleKind,
} from "@/domain/finance";
import {
  createManualExpense,
  createManualIncome,
  ensureDefaultBankAccount,
  listConfirmedPlanSettleLedgers,
  listPlanItems,
  listTransactions,
  listTransactionsByPlanItemId,
  voidTransaction,
} from "@/lib/store/repository";
import type { CanonicalTransaction, PlanItem } from "@/domain/finance";

export type PlanSettleLedgerResult = {
  bookedMinor: number;
  saldoDeltaMinor: number;
  accountId: string | null;
  skippedBecauseFunded: boolean;
};

function liveSettleBookings(
  rows: CanonicalTransaction[],
): CanonicalTransaction[] {
  return rows.filter(
    (tx) => tx.status === "confirmed" && Boolean(tx.planItemId),
  );
}

async function voidPlanSettleBookings(
  planItemId: string,
): Promise<{ previousBookedMinor: number; accountId: string | null }> {
  const existing = await listTransactionsByPlanItemId(planItemId);
  const live = liveSettleBookings(existing);
  let previousBookedMinor = 0;
  let accountId: string | null = null;
  for (const tx of live) {
    previousBookedMinor += tx.amountMinor;
    accountId = accountId ?? tx.accountId;
    await voidTransaction(tx.id);
  }
  return { previousBookedMinor, accountId };
}

async function insertSettleBooking(input: {
  kind: PlanSettleKind;
  accountId: string;
  amountMinor: number;
  description: string;
  occurredAt: string;
  planItemId: string;
}): Promise<CanonicalTransaction> {
  if (input.kind === "income") {
    return createManualIncome({
      accountId: input.accountId,
      amountMinor: input.amountMinor,
      description: input.description,
      occurredAt: input.occurredAt,
      source: "manual",
      planItemId: input.planItemId,
    });
  }
  return createManualExpense({
    accountId: input.accountId,
    amountMinor: input.amountMinor,
    description: input.description,
    occurredAt: input.occurredAt,
    source: "manual",
    planItemId: input.planItemId,
  });
}

/**
 * Void previous synthetic bookings, then write one confirmed row for the
 * new settled amount — unless a bank/SMS row already funded the plan item.
 * Never voids a row without plan_item_id.
 */
export async function syncPlanItemSettleLedger(params: {
  item: PlanItem;
  targetBookedMinor: number;
  timeZone: string;
}): Promise<PlanSettleLedgerResult> {
  const kind = planSettleKind(params.item);
  if (!kind) {
    return {
      bookedMinor: 0,
      saldoDeltaMinor: 0,
      accountId: null,
      skippedBecauseFunded: false,
    };
  }

  const target = Math.max(0, Math.round(params.targetBookedMinor));
  const account = await ensureDefaultBankAccount();
  const { previousBookedMinor, accountId: previousAccountId } =
    await voidPlanSettleBookings(params.item.id);

  const ledger = await listTransactions();
  const monthKey = monthKeyForPlanSettle(params.item, params.timeZone);
  const funded = planItemAlreadyFundedInLedger({
    item: params.item,
    transactions: ledger,
    kind,
    monthKey,
    timeZone: params.timeZone,
  });

  let bookedMinor = 0;
  let accountId = previousAccountId ?? account.id;
  if (target > 0 && !funded) {
    try {
      const created = await insertSettleBooking({
        kind,
        accountId: account.id,
        amountMinor: target,
        description: params.item.name,
        occurredAt:
          params.item.nextDueAt ??
          params.item.remainingDueAt ??
          new Date().toISOString(),
        planItemId: params.item.id,
      });
      bookedMinor = created.amountMinor;
      accountId = created.accountId;
    } catch {
      const raced = liveSettleBookings(
        await listTransactionsByPlanItemId(params.item.id),
      );
      const match = raced.find((tx) => tx.amountMinor === target);
      if (!match) throw new Error("Kunde inte boka beloppet mot saldot");
      bookedMinor = match.amountMinor;
      accountId = match.accountId;
    }
  }

  return {
    bookedMinor,
    saldoDeltaMinor: signedPlanSettleSaldoDelta(
      kind,
      bookedMinor - previousBookedMinor,
    ),
    accountId,
    skippedBecauseFunded: funded,
  };
}

/**
 * After a bank/SMS/manual landing: drop synthetic settle bookings that would
 * double-count money already in the account.
 */
export async function reclaimStalePlanSettleLedgers(params: {
  timeZone: string;
}): Promise<number> {
  const [bookings, items, ledger] = await Promise.all([
    listConfirmedPlanSettleLedgers(),
    listPlanItems(),
    listTransactions(),
  ]);
  if (bookings.length === 0) return 0;

  const byItem = new Map<string, CanonicalTransaction[]>();
  for (const tx of bookings) {
    const id = tx.planItemId;
    if (!id) continue;
    const list = byItem.get(id) ?? [];
    list.push(tx);
    byItem.set(id, list);
  }

  let voided = 0;
  for (const [itemId, rows] of byItem) {
    const item = items.find((row) => row.id === itemId);
    if (!item) continue;
    const kind = planSettleKind(item);
    if (!kind) continue;
    const others = ledger.filter((tx) => tx.planItemId !== itemId);
    const funded = planItemAlreadyFundedInLedger({
      item,
      transactions: others,
      kind,
      monthKey: monthKeyForPlanSettle(item, params.timeZone),
      timeZone: params.timeZone,
    });
    if (!funded) continue;
    for (const tx of rows) {
      await voidTransaction(tx.id);
      voided += 1;
    }
  }
  return voided;
}
