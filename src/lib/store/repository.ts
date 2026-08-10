import { withTimeout } from "@/lib/async";
import { withRolledMonthlyDues } from "@/domain/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as local from "./local-repository";
import * as remote from "./supabase-repository";
import { assertMultiUserSafeBackend } from "./isolation";
import type { TodaySnapshot } from "./types-snapshot";

export type { TodaySnapshot };
export type { ReceiptUploadResult, ConfirmReceiptInput } from "./receipt-types";
export type {
  BankSmsUploadResult,
  ConfirmBankSmsInput,
  ConfirmBankSmsResult,
  ConfirmBankSmsItem,
} from "./bank-sms-types";
export type { UserProgress, RecordOnTrackDayResult } from "./types-progress";

const SNAPSHOT_TIMEOUT_MS = 3_500;

function api() {
  const supabase = isSupabaseConfigured();
  assertMultiUserSafeBackend(supabase);
  return supabase ? remote : local;
}

/** Keep monthly due dates rolling into future months automatically. */
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

export async function setDefaultAccount(accountId: string) {
  return api().setDefaultAccount(accountId);
}

export async function ensureDefaultBankAccount(
  input?: Parameters<typeof local.ensureDefaultBankAccount>[0],
) {
  return api().ensureDefaultBankAccount(input);
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

export async function updateManualTransaction(
  input: Parameters<typeof local.updateManualTransaction>[0],
) {
  return api().updateManualTransaction(input);
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
  await ensurePlanDuesRolled();
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

export async function listTransactionFingerprints() {
  return api().listTransactionFingerprints();
}

export async function parseBankSmsText(
  input: Parameters<typeof local.parseBankSmsText>[0],
) {
  return api().parseBankSmsText(input);
}

export async function uploadBankSmsAndExtract(
  input: Parameters<typeof local.uploadBankSmsAndExtract>[0],
) {
  return api().uploadBankSmsAndExtract(input);
}

export async function confirmBankSmsImport(
  input: Parameters<typeof local.confirmBankSmsImport>[0],
) {
  return api().confirmBankSmsImport(input);
}

export async function getUserProgress() {
  return api().getUserProgress();
}

export async function recordOnTrackDayIfNeeded(isOnTrack: boolean) {
  return api().recordOnTrackDayIfNeeded(isOnTrack);
}

export async function hasClosedDayToday() {
  return api().hasClosedDayToday();
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
