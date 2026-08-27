import { cache } from "react";
import { isTimeoutError, withTimeout, withTimeoutRetry } from "@/lib/async";
import { withRolledMonthlyDues } from "@/domain/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as local from "./local-repository";
import * as remote from "./supabase-repository";
import { assertMultiUserSafeBackend } from "./isolation";
import type { TodaySnapshot } from "./types-snapshot";

export type { TodaySnapshot };
export type { ReceiptUploadResult, ConfirmReceiptInput } from "./receipt-types";
export type { UserProgress } from "./types-progress";

/** Data queries only — auth is warmed before this timer starts. */
const SNAPSHOT_TIMEOUT_MS = 12_000;

function api() {
  const supabase = isSupabaseConfigured();
  assertMultiUserSafeBackend(supabase);
  return supabase ? remote : local;
}

/** Keep the "Nästa inkomst" pointer rolling; fixed expenses stay month-pinned. */
async function ensurePlanDuesRolled(): Promise<void> {
  try {
    const items = await api().listPlanItems();
    const { changed } = withRolledMonthlyDues(items, new Date());
    if (changed.length === 0) return;
    await Promise.all(
      changed.map((item) =>
        api().updatePlanItem({ id: item.id, nextDueAt: item.nextDueAt }),
      ),
    );
  } catch (error) {
    console.warn("[numa] plan due roll skipped", error);
  }
}

/** Request-scoped: layout + Hem/Analys share one profile round-trip. */
export const getProfile = cache(async () => api().getProfile());

export async function stampOnboardingSaldoAt() {
  return api().stampOnboardingSaldoAt();
}

export async function stampOnboardingCompletedAt() {
  return api().stampOnboardingCompletedAt();
}

export async function stampGettingStartedCompletedAt() {
  return api().stampGettingStartedCompletedAt();
}

export async function setGettingStartedCollapsed(collapsed: boolean) {
  return api().setGettingStartedCollapsed(collapsed);
}

export async function listAccounts() {
  return api().listAccounts();
}

export async function getAccount(accountId: string) {
  return api().getAccount(accountId);
}

export async function createAccount(
  input: Parameters<typeof local.createAccount>[0],
) {
  return api().createAccount(input);
}

export async function ensureDefaultBankAccount(
  input?: Parameters<typeof local.ensureDefaultBankAccount>[0],
) {
  return api().ensureDefaultBankAccount(input);
}

export async function ensureAccountForCurrency(
  input: Parameters<typeof local.ensureAccountForCurrency>[0],
) {
  return api().ensureAccountForCurrency(input);
}

export async function createCheckpoint(
  input: Parameters<typeof local.createCheckpoint>[0],
) {
  return api().createCheckpoint(input);
}

export async function createManualExpense(
  input: Parameters<typeof local.createManualExpense>[0],
) {
  return api().createManualExpense(input);
}

export async function createManualIncome(
  input: Parameters<typeof local.createManualIncome>[0],
) {
  return api().createManualIncome(input);
}

export async function createTransfer(
  input: Parameters<typeof local.createTransfer>[0],
) {
  return api().createTransfer(input);
}

export async function createCashWithdrawal(
  input: Parameters<typeof local.createCashWithdrawal>[0],
) {
  return api().createCashWithdrawal(input);
}

export async function listTransactions(
  accountId?: string,
  options?: { sinceIso?: string; limit?: number },
) {
  if (isSupabaseConfigured()) {
    return remote.listTransactions(accountId, options);
  }
  return local.listTransactions(accountId);
}

export async function updateTransaction(
  input: Parameters<typeof local.updateTransaction>[0],
) {
  return api().updateTransaction(input);
}

export async function voidTransaction(id: string) {
  return api().voidTransaction(id);
}

export async function createScreenshotObservation(
  input: Parameters<typeof local.createScreenshotObservation>[0],
) {
  return api().createScreenshotObservation(input);
}

export async function listObservations() {
  return withTimeout(
    api().listObservations(),
    SNAPSHOT_TIMEOUT_MS,
    "listObservations",
  );
}

export async function getObservation(observationId: string) {
  return api().getObservation(observationId);
}

export async function listObservationCandidates(observationId: string) {
  return api().listObservationCandidates(observationId);
}

export async function getObservationMediaUrl(storagePath: string) {
  return api().getObservationMediaUrl(storagePath);
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  // Do not await due-rolling on the login path — it was an extra plan-items
  // round-trip before the timed snapshot even started.
  void ensurePlanDuesRolled();
  // Warm getUser/profile outside the timer so login auth cannot eat the budget.
  await api().getProfile();
  try {
    return await withTimeoutRetry(
      () => api().getTodaySnapshot(),
      SNAPSHOT_TIMEOUT_MS,
      "getTodaySnapshot",
      1,
    );
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[numa] snapshot timed out after retry");
    }
    throw error;
  }
}

export async function getLatestCheckpoint(accountId: string) {
  if (isSupabaseConfigured()) {
    return remote.latestCheckpointForAccount(accountId);
  }
  const store = await import("./local-store").then((m) => m.readStore());
  return local.latestCheckpointForAccount(store, accountId);
}

export async function uploadReceiptAndExtract(
  input: Parameters<typeof local.uploadReceiptAndExtract>[0],
) {
  return api().uploadReceiptAndExtract(input);
}

export async function confirmReceiptExpense(
  input: Parameters<typeof local.confirmReceiptExpense>[0],
) {
  return api().confirmReceiptExpense(input);
}

export async function getUserProgress() {
  return api().getUserProgress();
}

export async function recordOnTrackDayIfNeeded(isOnTrack: boolean) {
  return api().recordOnTrackDayIfNeeded(isOnTrack);
}

export async function listPlanItems() {
  return api().listPlanItems();
}

export async function createPlanItem(
  input: Parameters<typeof local.createPlanItem>[0],
) {
  return api().createPlanItem(input);
}

export async function updatePlanItem(
  input: Parameters<typeof local.updatePlanItem>[0],
) {
  return api().updatePlanItem(input);
}

export async function deletePlanItem(id: string) {
  return api().deletePlanItem(id);
}

export async function setNextIncomeDate(isoDate: string) {
  return api().setNextIncomeDate(isoDate);
}

export { hoursSince, NEXT_INCOME_NAME } from "./local-repository";
