import {
  isPlanIncome,
  type CanonicalTransaction,
  type PlanItem,
} from "@/domain/finance";

export type AtomicSettleResult = {
  item: PlanItem;
  bookedMinor: number;
  saldoDeltaMinor: number;
  accountId: string | null;
  skippedBecauseFunded: boolean;
  idempotent: boolean;
};

export type AtomicLinkResult = {
  item: PlanItem;
  transactionId: string;
};

/**
 * In-memory twin of `numa_internal.settle_plan_item`.
 * Mutates the provided arrays in place so local JSON mode stays atomic.
 */
export function applySettleInMemory(params: {
  item: PlanItem;
  transactions: CanonicalTransaction[];
  accounts: Array<{ id: string; isDefault: boolean; currency: string }>;
  settled: boolean;
  targetSettledMinor: number | null;
  remainingDueAt: string | null;
  accountId?: string | null;
  nowIso: string;
  newId: () => string;
  userId: string;
}): AtomicSettleResult {
  const amount = params.item.amountMinor;
  if (amount <= 0) throw new Error("Planposten har inget belopp");

  const target = !params.settled
    ? 0
    : params.targetSettledMinor == null
      ? amount
      : Math.max(0, Math.min(amount, Math.round(params.targetSettledMinor)));

  let settledAt: string | null;
  let settledMinor: number | null;
  let remainingDueAt: string | null;
  if (target <= 0) {
    settledAt = null;
    settledMinor = null;
    remainingDueAt = null;
  } else if (target >= amount) {
    settledAt = params.item.settledAt ?? params.nowIso;
    settledMinor = amount;
    remainingDueAt = null;
  } else {
    settledAt = null;
    settledMinor = target;
    remainingDueAt =
      params.remainingDueAt ??
      params.item.remainingDueAt ??
      params.item.nextDueAt;
  }

  if (
    (params.item.settledMinor ?? 0) === (settledMinor ?? 0) &&
    params.item.settledAt === settledAt &&
    params.item.remainingDueAt === remainingDueAt
  ) {
    return {
      item: params.item,
      bookedMinor: 0,
      saldoDeltaMinor: 0,
      accountId: null,
      skippedBecauseFunded: false,
      idempotent: true,
    };
  }

  const funded = params.transactions.some(
    (tx) =>
      tx.status === "confirmed" &&
      tx.linkedPlanItemId === params.item.id &&
      tx.ledgerOrigin !== "plan_settle" &&
      !tx.planItemId,
  );

  const liveSynths = params.transactions.filter(
    (tx) =>
      tx.planItemId === params.item.id &&
      tx.ledgerOrigin === "plan_settle" &&
      tx.status === "confirmed",
  );
  const alreadyBooked = liveSynths.reduce((sum, tx) => sum + tx.amountMinor, 0);
  for (const tx of liveSynths) {
    tx.status = "voided";
    tx.updatedAt = params.nowIso;
  }

  const accountId =
    params.accountId ??
    liveSynths[0]?.accountId ??
    params.accounts.find((a) => a.isDefault)?.id ??
    params.accounts[0]?.id ??
    null;

  let bookedMinor = 0;
  if (!funded && target > 0) {
    if (!accountId) throw new Error("Inget konto för bokningen");
    const account = params.accounts.find((a) => a.id === accountId);
    const income = isPlanIncome(params.item);
    params.transactions.push({
      id: params.newId(),
      userId: params.userId,
      accountId,
      counterAccountId: null,
      direction: income ? "credit" : "debit",
      transactionType: income ? "income" : "expense",
      amountMinor: target,
      currency: (account?.currency as CanonicalTransaction["currency"]) ?? "THB",
      occurredAt: params.nowIso,
      description: params.item.name.trim() || "Planpost",
      merchant: params.item.name.trim() || null,
      category: null,
      source: "manual",
      status: "confirmed",
      balanceAfterMinor: null,
      fingerprint: null,
      sourceObservationId: null,
      transferGroupId: null,
      planItemId: params.item.id,
      ledgerOrigin: "plan_settle",
      linkedPlanItemId: null,
      syncStatus: "saved",
      createdAt: params.nowIso,
      updatedAt: params.nowIso,
    });
    bookedMinor = target;
  }

  const kindIncome = isPlanIncome(params.item);
  const saldoDeltaMinor = funded
    ? 0
    : kindIncome
      ? bookedMinor - alreadyBooked
      : -(bookedMinor - alreadyBooked);

  params.item.settledAt = settledAt;
  params.item.settledMinor = settledMinor;
  params.item.remainingDueAt = remainingDueAt;
  params.item.updatedAt = params.nowIso;

  return {
    item: { ...params.item },
    bookedMinor: funded ? 0 : bookedMinor,
    saldoDeltaMinor,
    accountId,
    skippedBecauseFunded: funded,
    idempotent: false,
  };
}
