import {
  allocatedCanonicalFromLinks,
  allocatedSumCanonical,
  isPlanIncome,
  thbToNativeMinor,
  type CanonicalTransaction,
  type PlanItem,
  type PlanPaymentAllocation,
} from "@/domain/finance";

export type AtomicSettleResult = {
  item: PlanItem;
  bookedMinor: number;
  bookedNativeMinor: number;
  bookedCanonicalMinor: number;
  saldoDeltaMinor: number;
  nativeSaldoDeltaMinor: number;
  accountId: string | null;
  skippedBecauseFunded: boolean;
  idempotent: boolean;
};

export type AtomicLinkResult = {
  item: PlanItem;
  transactionId: string;
  allocatedCanonicalMinor?: number;
  idempotent?: boolean;
};

export type SettleAccount = {
  id: string;
  isDefault: boolean;
  currency: string;
  fxRate?: number | null;
};

/**
 * In-memory twin of `numa_internal.settle_plan_item`.
 * Mutates the provided arrays in place so local JSON mode stays atomic.
 */
export function applySettleInMemory(params: {
  item: PlanItem;
  transactions: CanonicalTransaction[];
  allocations?: PlanPaymentAllocation[];
  accounts: SettleAccount[];
  settled: boolean;
  targetSettledMinor: number | null;
  remainingDueAt: string | null;
  accountId?: string | null;
  nowIso: string;
  newId: () => string;
  userId: string;
  clientMutationId?: string | null;
}): AtomicSettleResult {
  const amount = params.item.amountMinor;
  if (amount <= 0) throw new Error("Planposten har inget belopp");

  const allocated = Math.max(
    allocatedSumCanonical(params.allocations ?? [], params.item.id),
    allocatedCanonicalFromLinks(params.item, params.transactions),
  );

  const requested = !params.settled
    ? allocated
    : params.targetSettledMinor == null
      ? amount
      : Math.max(allocated, Math.min(amount, Math.round(params.targetSettledMinor)));

  let settledAt: string | null;
  let settledMinor: number | null;
  let remainingDueAt: string | null;
  if (requested <= 0) {
    settledAt = null;
    settledMinor = null;
    remainingDueAt = null;
  } else if (requested >= amount) {
    settledAt = params.item.settledAt ?? params.nowIso;
    settledMinor = amount;
    remainingDueAt = null;
  } else {
    settledAt = null;
    settledMinor = requested;
    remainingDueAt =
      params.remainingDueAt ??
      params.item.remainingDueAt ??
      params.item.nextDueAt;
  }

  const synthTarget = Math.max(0, requested - allocated);

  const liveSynths = params.transactions.filter(
    (tx) =>
      tx.planItemId === params.item.id &&
      tx.ledgerOrigin === "plan_settle" &&
      tx.status === "confirmed",
  );
  const alreadyBookedThb = liveSynths.reduce(
    (sum, tx) => sum + (tx.thbMinor ?? tx.amountMinor),
    0,
  );
  const alreadyBookedNative = liveSynths.reduce(
    (sum, tx) => sum + tx.amountMinor,
    0,
  );

  const accountId =
    params.accountId ??
    liveSynths[0]?.accountId ??
    params.accounts.find((a) => a.isDefault)?.id ??
    params.accounts[0]?.id ??
    null;

  if (
    (params.item.settledMinor ?? 0) === (settledMinor ?? 0) &&
    params.item.settledAt === settledAt &&
    params.item.remainingDueAt === remainingDueAt &&
    alreadyBookedThb === synthTarget
  ) {
    return {
      item: params.item,
      bookedMinor: 0,
      bookedNativeMinor: 0,
      bookedCanonicalMinor: 0,
      saldoDeltaMinor: 0,
      nativeSaldoDeltaMinor: 0,
      accountId: null,
      skippedBecauseFunded: allocated > 0 && synthTarget === 0,
      idempotent: true,
    };
  }

  for (const tx of liveSynths) {
    tx.status = "voided";
    tx.updatedAt = params.nowIso;
  }

  let bookedThb = 0;
  let bookedNative = 0;
  if (synthTarget > 0) {
    if (!accountId) throw new Error("Inget konto för bokningen");
    const account = params.accounts.find((a) => a.id === accountId);
    const currency = (account?.currency ?? "THB") as CanonicalTransaction["currency"];
    const fxRate = currency === "THB" ? 1 : account?.fxRate ?? null;
    bookedNative = thbToNativeMinor(synthTarget, currency, fxRate);
    bookedThb = synthTarget;
    const income = isPlanIncome(params.item);
    params.transactions.push({
      id: params.newId(),
      userId: params.userId,
      accountId,
      counterAccountId: null,
      direction: income ? "credit" : "debit",
      transactionType: income ? "income" : "expense",
      amountMinor: bookedNative,
      currency,
      thbMinor: bookedThb,
      fxRate,
      fxAsOf: params.nowIso,
      fxSource: "settlement",
      clientMutationId: params.clientMutationId ?? null,
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
  }

  const kindIncome = isPlanIncome(params.item);
  const saldoDeltaMinor = kindIncome
    ? bookedThb - alreadyBookedThb
    : -(bookedThb - alreadyBookedThb);
  const nativeSaldoDeltaMinor = kindIncome
    ? bookedNative - alreadyBookedNative
    : -(bookedNative - alreadyBookedNative);

  params.item.settledAt = settledAt;
  params.item.settledMinor = settledMinor;
  params.item.remainingDueAt = remainingDueAt;
  params.item.updatedAt = params.nowIso;

  return {
    item: { ...params.item },
    bookedMinor: bookedThb,
    bookedNativeMinor: bookedNative,
    bookedCanonicalMinor: bookedThb,
    saldoDeltaMinor,
    nativeSaldoDeltaMinor,
    accountId,
    skippedBecauseFunded: synthTarget === 0 && allocated > 0,
    idempotent: false,
  };
}
