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
  getLatestCheckpoint,
  listConfirmedPlanSettleLedgers,
  listPlanItems,
  listTransactions,
  listTransactionsByPlanItemId,
  updateTransaction,
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
 * Keep synthetic bookings equal to the settled amount.
 * An existing booking moves by the delta only. A row still in the open
 * balance window is updated in place and keeps occurred_at. A booking
 * already inside the saldo checkpoint stays put; only the delta is posted
 * after it. Voiding that row and inserting the full new amount stacks the
 * whole price on På kontona. A bank/SMS row that already funded the item
 * still drops the synthetics. Never voids a row without plan_item_id.
 */
export async function syncPlanItemSettleLedger(params: {
  item: PlanItem;
  planItems?: readonly PlanItem[];
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
  const existing = liveSettleBookings(
    await listTransactionsByPlanItemId(params.item.id),
  );
  const previousBookedMinor = existing.reduce(
    (sum, tx) => sum + tx.amountMinor,
    0,
  );
  const previousAccountId = existing[0]?.accountId ?? null;

  const [ledger, planItems] = await Promise.all([
    listTransactions(),
    params.planItems
      ? Promise.resolve(params.planItems)
      : listPlanItems(),
  ]);
  const monthKey = monthKeyForPlanSettle(params.item, params.timeZone);
  const funded = planItemAlreadyFundedInLedger({
    item: params.item,
    planItems,
    transactions: ledger,
    kind,
    monthKey,
    timeZone: params.timeZone,
  });

  let bookedMinor = 0;
  let accountId = previousAccountId ?? account.id;

  if (target <= 0 || funded) {
    const voided = await voidPlanSettleBookings(params.item.id);
    accountId = voided.accountId ?? accountId;
    bookedMinor = 0;
  } else if (existing.length > 0) {
    const delta = target - previousBookedMinor;
    const checkpoint = await getLatestCheckpoint(accountId);
    const checkpointMs = checkpoint ? Date.parse(checkpoint.verifiedAt) : NaN;
    const keeper = existing.find(
      (tx) =>
        !Number.isFinite(checkpointMs) ||
        Date.parse(tx.occurredAt) >= checkpointMs,
    );
    if (delta !== 0 && keeper) {
      const nextAmount = keeper.amountMinor + delta;
      if (nextAmount <= 0) {
        throw new Error("Kunde inte boka beloppet mot saldot");
      }
      await updateTransaction({
        id: keeper.id,
        amountMinor: nextAmount,
      });
      accountId = keeper.accountId;
    } else if (delta > 0) {
      const created = await insertSettleBooking({
        kind,
        accountId,
        amountMinor: delta,
        description: params.item.name,
        occurredAt: new Date().toISOString(),
        planItemId: params.item.id,
      });
      accountId = created.accountId;
    } else if (delta < 0) {
      throw new Error("Kunde inte boka beloppet mot saldot");
    }
    bookedMinor = target;
  } else {
    try {
      const created = await insertSettleBooking({
        kind,
        accountId: account.id,
        amountMinor: target,
        description: params.item.name,
        occurredAt: new Date().toISOString(),
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
      planItems: items,
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
