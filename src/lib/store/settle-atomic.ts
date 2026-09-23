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

export type SettleCheckpoint = {
  accountId: string;
  verifiedAt: string;
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
  /**
   * Latest saldo checkpoints. A booking dated before the account's
   * checkpoint is already inside that balance and must not be rewritten
   * as a new full-amount row after it.
   */
  checkpoints?: readonly SettleCheckpoint[];
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

  const income = isPlanIncome(params.item);
  const liveSynths = params.transactions.filter(
    (tx) =>
      tx.planItemId === params.item.id &&
      tx.ledgerOrigin === "plan_settle" &&
      tx.status === "confirmed",
  );
  const alreadyBookedThb = liveSynths.reduce(
    (sum, tx) => sum + signedSettleThb(tx, income),
    0,
  );
  const alreadyBookedNative = liveSynths.reduce(
    (sum, tx) => sum + signedSettleNative(tx, income),
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

  // QA: Betald 44k then edit to 45k voided the 44k row and inserted a
  // confirmed 45k row at the same time. Rörelser hid the void and showed
  // one −45k, which matched the ledger. På kontona still had the −44k
  // (the void does not put back a payment already inside the checkpoint)
  // and then applied the full −45k again. The balance change must be
  // saldo_delta = −(new−old) only. Rows already inside the checkpoint
  // stay put; the open window receives only the delta. A booking still
  // inside the window is updated in place and keeps occurred_at.
  const checkpointAt = latestCheckpointVerifiedAt(params.checkpoints, accountId);
  const checkpointMs =
    checkpointAt != null && Number.isFinite(Date.parse(checkpointAt))
      ? Date.parse(checkpointAt)
      : null;
  const inOpenWindow = (tx: CanonicalTransaction) =>
    checkpointMs == null || Date.parse(tx.occurredAt) >= checkpointMs;
  const frozen = liveSynths.filter((tx) => !inOpenWindow(tx));
  const windowed = liveSynths.filter(inOpenWindow);
  const frozenThb = frozen.reduce((sum, tx) => sum + signedSettleThb(tx, income), 0);
  const desiredWindowThb = synthTarget - frozenThb;

  const keeper = [...windowed].sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  )[0];
  for (const tx of windowed) {
    if (tx !== keeper) {
      tx.status = "voided";
      tx.updatedAt = params.nowIso;
    }
  }

  const account = accountId
    ? params.accounts.find((row) => row.id === accountId)
    : undefined;
  writeSettleWindow({
    desiredWindowThb,
    keeper,
    income,
    accountId,
    account,
    item: params.item,
    transactions: params.transactions,
    nowIso: params.nowIso,
    newId: params.newId,
    userId: params.userId,
    clientMutationId: params.clientMutationId ?? null,
  });

  const liveAfter = params.transactions.filter(
    (tx) =>
      tx.planItemId === params.item.id &&
      tx.ledgerOrigin === "plan_settle" &&
      tx.status === "confirmed",
  );
  const bookedAfterThb = liveAfter.reduce(
    (sum, tx) => sum + signedSettleThb(tx, income),
    0,
  );
  const bookedAfterNative = liveAfter.reduce(
    (sum, tx) => sum + signedSettleNative(tx, income),
    0,
  );
  const bookedThb = synthTarget > 0 ? synthTarget : 0;
  let bookedNative = 0;
  if (bookedThb > 0 && account) {
    const currency = (account.currency ?? "THB") as CanonicalTransaction["currency"];
    const fxRate = currency === "THB" ? 1 : account.fxRate ?? null;
    bookedNative = thbToNativeMinor(bookedThb, currency, fxRate);
  }
  const saldoDeltaMinor = (income ? 1 : -1) * (bookedAfterThb - alreadyBookedThb);
  const nativeSaldoDeltaMinor =
    (income ? 1 : -1) * (bookedAfterNative - alreadyBookedNative);

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

/** Positive when the row books toward the plan (expense debit / income credit). */
function signedSettleThb(tx: CanonicalTransaction, income: boolean): number {
  const magnitude = tx.thbMinor ?? tx.amountMinor;
  const natural = income ? tx.direction === "credit" : tx.direction === "debit";
  return natural ? magnitude : -magnitude;
}

function signedSettleNative(tx: CanonicalTransaction, income: boolean): number {
  const natural = income ? tx.direction === "credit" : tx.direction === "debit";
  return natural ? tx.amountMinor : -tx.amountMinor;
}

function latestCheckpointVerifiedAt(
  checkpoints: readonly SettleCheckpoint[] | undefined,
  accountId: string | null,
): string | null {
  if (!accountId || !checkpoints?.length) return null;
  let best: string | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const row of checkpoints) {
    if (row.accountId !== accountId) continue;
    const ms = Date.parse(row.verifiedAt);
    if (!Number.isFinite(ms) || ms < bestMs) continue;
    bestMs = ms;
    best = row.verifiedAt;
  }
  return best;
}

function writeSettleWindow(input: {
  desiredWindowThb: number;
  keeper: CanonicalTransaction | undefined;
  income: boolean;
  accountId: string | null;
  account: SettleAccount | undefined;
  item: { id: string; name: string };
  transactions: CanonicalTransaction[];
  nowIso: string;
  newId: () => string;
  userId: string;
  clientMutationId: string | null;
}) {
  const { desiredWindowThb, keeper, income } = input;
  if (desiredWindowThb === 0) {
    if (keeper) {
      keeper.status = "voided";
      keeper.updatedAt = input.nowIso;
    }
    return;
  }

  const magnitude = Math.abs(desiredWindowThb);
  const natural = desiredWindowThb > 0;
  const credit = natural ? income : !income;
  const direction = credit ? "credit" : "debit";
  const transactionType = natural
    ? income
      ? "income"
      : "expense"
    : "adjustment";
  const keeperMatches =
    keeper != null &&
    natural &&
    keeper.direction === direction &&
    keeper.transactionType === transactionType;

  if (keeperMatches && keeper) {
    const currency = keeper.currency;
    const fxRate = currency === "THB" ? 1 : keeper.fxRate ?? input.account?.fxRate ?? null;
    keeper.amountMinor = thbToNativeMinor(magnitude, currency, fxRate);
    keeper.thbMinor = magnitude;
    keeper.fxRate = fxRate;
    keeper.description = input.item.name.trim() || "Planpost";
    keeper.merchant = input.item.name.trim() || null;
    keeper.updatedAt = input.nowIso;
    return;
  }

  if (keeper) {
    keeper.status = "voided";
    keeper.updatedAt = input.nowIso;
  }
  if (!input.accountId) throw new Error("Inget konto för bokningen");
  const currency = (input.account?.currency ?? "THB") as CanonicalTransaction["currency"];
  const fxRate = currency === "THB" ? 1 : input.account?.fxRate ?? null;
  const native = thbToNativeMinor(magnitude, currency, fxRate);
  input.transactions.push({
    id: input.newId(),
    userId: input.userId,
    accountId: input.accountId,
    counterAccountId: null,
    direction,
    transactionType,
    amountMinor: native,
    currency,
    thbMinor: magnitude,
    fxRate,
    fxAsOf: input.nowIso,
    fxSource: "settlement",
    clientMutationId: input.clientMutationId,
    occurredAt: input.nowIso,
    description: input.item.name.trim() || "Planpost",
    merchant: input.item.name.trim() || null,
    category: null,
    source: "manual",
    status: "confirmed",
    balanceAfterMinor: null,
    fingerprint: null,
    sourceObservationId: null,
    transferGroupId: null,
    planItemId: input.item.id,
    ledgerOrigin: "plan_settle",
    linkedPlanItemId: null,
    syncStatus: "saved",
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  });
}
