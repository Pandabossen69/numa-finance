import { isPlanIncome } from "./plan-months";
import type { CanonicalTransaction, PlanItem } from "./types";

export type PlanPaymentAllocation = {
  id: string;
  userId: string;
  planItemId: string;
  transactionId: string;
  allocatedCanonicalMinor: number;
  allocatedNativeMinor: number;
  currency: CanonicalTransaction["currency"];
  fxRate: number | null;
  clientMutationId: string | null;
  createdAt: string;
};

export type AllocatePaymentError =
  | "transaction_not_found"
  | "plan_item_not_found"
  | "synthetic_row"
  | "not_confirmed"
  | "wrong_direction"
  | "wrong_currency"
  | "over_allocation"
  | "account_not_owned";

export type AllocatePaymentOk = {
  ok: true;
  item: PlanItem;
  transactionId: string;
  allocatedCanonicalMinor: number;
  remainingCanonicalMinor: number;
  voidedSyntheticIds: string[];
  idempotent: boolean;
};

export type AllocatePaymentResult =
  | AllocatePaymentOk
  | { ok: false; error: AllocatePaymentError };

export function allocatedSumCanonical(
  allocations: readonly PlanPaymentAllocation[],
  planItemId: string,
): number {
  let sum = 0;
  for (const row of allocations) {
    if (row.planItemId === planItemId) sum += row.allocatedCanonicalMinor;
  }
  return sum;
}

export function remainingOpenFromAllocations(
  item: PlanItem,
  allocations: readonly PlanPaymentAllocation[],
): number {
  return Math.max(0, item.amountMinor - allocatedSumCanonical(allocations, item.id));
}

function expectedDirection(item: PlanItem): {
  direction: CanonicalTransaction["direction"];
  transactionType: CanonicalTransaction["transactionType"];
} {
  if (isPlanIncome(item)) {
    return { direction: "credit", transactionType: "income" };
  }
  return { direction: "debit", transactionType: "expense" };
}

export function canonicalAmountForLink(
  tx: Pick<CanonicalTransaction, "amountMinor"> & {
    currency?: CanonicalTransaction["currency"];
    thbMinor?: number | null;
  },
): number {
  if (tx.thbMinor != null) return tx.thbMinor;
  if (!tx.currency || tx.currency === "THB") return tx.amountMinor;
  throw new Error("wrong_currency");
}

/** Confirmed external links only — never a synthetic settle row. */
export function allocatedCanonicalFromLinks(
  item: Pick<PlanItem, "id">,
  transactions: readonly (Pick<
    CanonicalTransaction,
    "status" | "amountMinor"
  > & {
    linkedPlanItemId?: string | null;
    ledgerOrigin?: CanonicalTransaction["ledgerOrigin"];
    planItemId?: string | null;
    currency?: CanonicalTransaction["currency"];
    thbMinor?: number | null;
  })[],
): number {
  let sum = 0;
  for (const tx of transactions) {
    if (tx.status !== "confirmed") continue;
    if (tx.ledgerOrigin === "plan_settle" || tx.planItemId) continue;
    if (tx.linkedPlanItemId !== item.id) continue;
    try {
      sum += canonicalAmountForLink(tx);
    } catch {
      // Foreign row without a locked THB amount cannot fund a plan.
    }
  }
  return sum;
}

/**
 * In-memory twin of `numa_internal.allocate_payment_to_plan`.
 * Mutates transactions / allocations / the plan item in place.
 */
export function applyAllocateInMemory(params: {
  item: PlanItem;
  transaction: CanonicalTransaction;
  transactions: CanonicalTransaction[];
  allocations: PlanPaymentAllocation[];
  accounts: Array<{ id: string; userId?: string }>;
  userId: string;
  nowIso: string;
  newId: () => string;
  clientMutationId?: string | null;
}): AllocatePaymentResult {
  const tx = params.transaction;
  if (tx.userId !== params.userId) {
    return { ok: false, error: "account_not_owned" };
  }
  if (tx.ledgerOrigin === "plan_settle" || tx.planItemId) {
    return { ok: false, error: "synthetic_row" };
  }
  if (tx.status !== "confirmed") {
    return { ok: false, error: "not_confirmed" };
  }

  const owned = params.accounts.some((account) => account.id === tx.accountId);
  if (!owned) return { ok: false, error: "account_not_owned" };

  const expect = expectedDirection(params.item);
  if (tx.direction !== expect.direction || tx.transactionType !== expect.transactionType) {
    return { ok: false, error: "wrong_direction" };
  }
  if (tx.currency !== params.item.currency) {
    return { ok: false, error: "wrong_currency" };
  }

  const existing = params.allocations.find(
    (row) =>
      row.planItemId === params.item.id && row.transactionId === tx.id,
  );
  if (existing) {
    return {
      ok: true,
      item: params.item,
      transactionId: tx.id,
      allocatedCanonicalMinor: existing.allocatedCanonicalMinor,
      remainingCanonicalMinor: remainingOpenFromAllocations(
        params.item,
        params.allocations,
      ),
      voidedSyntheticIds: [],
      idempotent: true,
    };
  }

  if (params.clientMutationId) {
    const byKey = params.allocations.find(
      (row) =>
        row.clientMutationId === params.clientMutationId &&
        row.userId === params.userId,
    );
    if (byKey) {
      return {
        ok: true,
        item: params.item,
        transactionId: byKey.transactionId,
        allocatedCanonicalMinor: byKey.allocatedCanonicalMinor,
        remainingCanonicalMinor: remainingOpenFromAllocations(
          params.item,
          params.allocations,
        ),
        voidedSyntheticIds: [],
        idempotent: true,
      };
    }
  }

  let amount: number;
  try {
    amount = canonicalAmountForLink(tx);
  } catch {
    return { ok: false, error: "wrong_currency" };
  }

  const remaining = remainingOpenFromAllocations(params.item, params.allocations);
  if (amount > remaining) {
    return { ok: false, error: "over_allocation" };
  }

  const voidedSyntheticIds: string[] = [];
  for (const row of params.transactions) {
    if (
      row.planItemId === params.item.id &&
      row.ledgerOrigin === "plan_settle" &&
      row.status === "confirmed"
    ) {
      row.status = "voided";
      row.updatedAt = params.nowIso;
      voidedSyntheticIds.push(row.id);
    }
  }

  params.allocations.push({
    id: params.newId(),
    userId: params.userId,
    planItemId: params.item.id,
    transactionId: tx.id,
    allocatedCanonicalMinor: amount,
    allocatedNativeMinor: tx.amountMinor,
    currency: tx.currency,
    fxRate: tx.fxRate ?? (tx.currency === "THB" ? 1 : null),
    clientMutationId: params.clientMutationId ?? null,
    createdAt: params.nowIso,
  });

  tx.linkedPlanItemId = params.item.id;
  tx.updatedAt = params.nowIso;

  const settled = allocatedSumCanonical(params.allocations, params.item.id);
  if (settled <= 0) {
    params.item.settledAt = null;
    params.item.settledMinor = null;
    params.item.remainingDueAt = null;
  } else if (settled >= params.item.amountMinor) {
    params.item.settledAt = params.item.settledAt ?? params.nowIso;
    params.item.settledMinor = params.item.amountMinor;
    params.item.remainingDueAt = null;
  } else {
    params.item.settledAt = null;
    params.item.settledMinor = settled;
    params.item.remainingDueAt =
      params.item.remainingDueAt ?? params.item.nextDueAt;
  }
  params.item.updatedAt = params.nowIso;

  return {
    ok: true,
    item: params.item,
    transactionId: tx.id,
    allocatedCanonicalMinor: amount,
    remainingCanonicalMinor: remainingOpenFromAllocations(
      params.item,
      params.allocations,
    ),
    voidedSyntheticIds,
    idempotent: false,
  };
}

export function allocateErrorMessageSv(error: AllocatePaymentError): string {
  switch (error) {
    case "wrong_direction":
      return "Rörelsen går åt fel håll för den här planposten";
    case "wrong_currency":
      return "Rörelsen är i en annan valuta än planposten";
    case "over_allocation":
      return "Beloppet är större än det som är kvar att koppla";
    case "synthetic_row":
      return "Kan inte koppla en syntetisk bokning";
    case "not_confirmed":
      return "Rörelsen är inte bekräftad";
    case "account_not_owned":
      return "Kontot tillhör inte dig";
    case "transaction_not_found":
      return "Rörelsen hittades inte";
    case "plan_item_not_found":
      return "Planposten hittades inte";
    default:
      return "Kunde inte koppla transaktionen";
  }
}
