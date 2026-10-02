import type { CurrencyCode } from "@/domain/money";
import type { AccountsSnapshot } from "@/features/finance/load-accounts";
import type { HomeSnapshot } from "@/features/finance/load-home";
import type { MovementsSnapshot } from "@/features/finance/load-movements";
import type { PlanSnapshot } from "@/features/finance/load-plan";
import {
  applyAccountDelta,
  applyMovementsAdd,
  applyOptimisticHomeIncome,
  applyOptimisticHomeSpend,
  captureOptimisticBalance,
  confirmOptimisticFinance,
  isStaleMovementsSnapshot,
  lastHomeSnapshot,
  pinLocalHomeRevision,
  rememberAccountsSnapshot,
  rememberHomeSnapshot,
  rememberMovementsSnapshot,
  rememberPlanSnapshot,
  replaceOptimisticMovementId,
  undoOptimisticBalance,
  type OptimisticBalancePaint,
} from "@/features/home/last-snapshot";

export type QuickAddKind = "expense" | "income";

let quickAddError: string | null = null;
const quickAddErrorListeners = new Set<() => void>();

export function publishQuickAddError(message: string | null): void {
  if (quickAddError === message) return;
  quickAddError = message;
  for (const listener of quickAddErrorListeners) listener();
}

export function lastQuickAddError(): string | null {
  return quickAddError;
}

export function subscribeQuickAddError(listener: () => void): () => void {
  quickAddErrorListeners.add(listener);
  return () => {
    quickAddErrorListeners.delete(listener);
  };
}

export function resetQuickAddErrorForTests(): void {
  quickAddError = null;
  quickAddErrorListeners.clear();
}

export type OptimisticQuickAddInput = {
  kind: QuickAddKind;
  mutationId: string;
  nativeAmountMinor: number;
  thbMinor: number;
  description: string;
  category?: string | null;
  nativeCurrency: CurrencyCode;
  accountId: string;
  fxRate?: number | null;
  /** Booked instant. Defaults to now when the form did not pick a day. */
  occurredAt?: string;
  /**
   * False when the expense is on an earlier calendar day. Then only the
   * balance moves — Kvar idag stays put until the server snapshot lands.
   */
  affectsTodaySpend?: boolean;
};

/**
 * Hem total, account balance and the Rörelser row, using the same helpers
 * as today's optimistic spend/income path. The row id is the clientMutationId.
 */
export function paintOptimisticQuickAdd(
  input: OptimisticQuickAddInput,
): OptimisticBalancePaint {
  publishQuickAddError(null);
  const paint = captureOptimisticBalance();
  if (input.kind === "expense") {
    if (input.affectsTodaySpend === false) applyOptimisticHomeIncome(-input.thbMinor);
    else applyOptimisticHomeSpend(input.thbMinor);
  } else applyOptimisticHomeIncome(input.thbMinor);
  applyAccountDelta(
    input.kind === "expense" ? -input.nativeAmountMinor : input.nativeAmountMinor,
    input.accountId,
  );
  applyMovementsAdd({
    id: input.mutationId,
    description: input.description,
    category: input.category ?? null,
    transactionType: input.kind,
    direction: input.kind === "expense" ? "debit" : "credit",
    amountMinor: input.thbMinor,
    currency: "THB",
    nativeAmountMinor: input.nativeAmountMinor,
    nativeCurrency: input.nativeCurrency,
    accountId: input.accountId,
    fxRate: input.fxRate ?? (input.nativeCurrency === "THB" ? 1 : null),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    source: "manual",
    clientMutationId: input.mutationId,
    listKey: input.mutationId,
  });
  return paint;
}

export function rollbackOptimisticQuickAdd(
  paint: OptimisticBalancePaint,
  error?: string,
): void {
  undoOptimisticBalance(paint);
  if (error) publishQuickAddError(error);
}

export function confirmOptimisticQuickAdd(
  mutationId: string,
  result: {
    id?: string;
    home?: HomeSnapshot | null;
    plan?: PlanSnapshot | null;
    accounts?: AccountsSnapshot | null;
    movements?: MovementsSnapshot | null;
  },
): void {
  const movementsStale =
    result.movements != null && isStaleMovementsSnapshot(result.movements);
  const homeBefore = lastHomeSnapshot();
  if (!movementsStale && result.home) rememberHomeSnapshot(result.home);
  if (!movementsStale && result.plan) rememberPlanSnapshot(result.plan);
  if (!movementsStale && result.accounts) {
    rememberAccountsSnapshot(result.accounts);
  }
  if (result.movements) rememberMovementsSnapshot(result.movements);
  replaceOptimisticMovementId(mutationId, result.id);
  if (lastHomeSnapshot() === homeBefore) pinLocalHomeRevision();
  confirmOptimisticFinance();
}
