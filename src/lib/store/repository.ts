import { withTimeout } from "@/lib/async";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertMultiUserSafeBackend } from "./isolation";
import * as local from "./local-repository";
import * as remote from "./supabase-repository";
import type { TodaySnapshot } from "./types-snapshot";

export type { TodaySnapshot };
export type { ReceiptUploadResult, ConfirmReceiptInput } from "./receipt-types";
export type { UserProgress } from "./types-progress";

const SNAPSHOT_TIMEOUT_MS = 5_000;

function api() {
  const supabase = isSupabaseConfigured();
  assertMultiUserSafeBackend(supabase);
  return supabase ? remote : local;
}

export async function getProfile() {
  return api().getProfile();
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

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  return withTimeout(
    api().getTodaySnapshot(),
    SNAPSHOT_TIMEOUT_MS,
    "getTodaySnapshot",
  );
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
