import {
  calculateAccountBalance,
  calculatePlanTotals,
  calculateSafeToSpend,
  filterTransactionsAfterCheckpoint,
  formatRelativeVerificationSv,
  isSameZonedDay,
  monthKeyFromDate,
  NEXT_INCOME_NAME,
  projectPayCycle,
  projectPlanForMonth,
  startOfZonedDay,
  startOfZonedMonth,
  sumSpending,
  type Account,
  type BalanceCheckpoint,
  type CanonicalTransaction,
  type ExtractedTransactionCandidate,
  type PlanCategoryKind,
  type PlanItem,
  type Profile,
  type SourceObservation,
  type TransactionSource,
} from "@/domain/finance";
import { money, type CurrencyCode } from "@/domain/money";
import { createExtractionProvider, resolveScreenshotImport } from "@/domain/imports";
import { rankForOnTrackDays } from "@/domain/gamification";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapAccount,
  mapCandidate,
  mapCheckpoint,
  mapExtractionRun,
  mapObservation,
  mapPlanItem,
  mapProfile,
  mapTransaction,
  mapUserProgress,
} from "./mappers";
import {
  assertUserOwnsStoragePath,
  buildUserStoragePath,
} from "./isolation";
import type { ConfirmReceiptInput, ReceiptUploadResult } from "./receipt-types";
import type { TodaySnapshot } from "./types-snapshot";
import { emptyUserProgress, type UserProgress } from "./types-progress";

import { cache } from "react";
import { withTimeout } from "@/lib/async";

/** One auth lookup per request — repeated getUser() made Idag feel stuck. */
const requireUserId = cache(async (): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await withTimeout(
    supabase.auth.getUser(),
    4_000,
    "requireUserId getUser",
  );
  if (error || !user) {
    throw new Error("Du måste vara inloggad");
  }
  return user.id;
});

async function ensureProfile(userId: string): Promise<Profile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return mapProfile(data);

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      display_name: "Användare",
      timezone: "Asia/Bangkok",
      primary_currency: "THB",
      reference_currency: "SEK",
    })
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message);
  return mapProfile(created);
}

export async function getProfile(): Promise<Profile> {
  const userId = await requireUserId();
  return ensureProfile(userId);
}

export async function listAccounts(): Promise<Account[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAccount);
}

export async function getAccount(accountId: string): Promise<Account | null> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapAccount(data) : null;
}

export async function ensureDefaultBankAccount(input?: {
  maskedIdentifier?: string | null;
  currency?: CurrencyCode;
}): Promise<Account> {
  const existing = await listAccounts();
  const primary = existing.find((a) => a.isDefault) ?? existing[0] ?? null;
  if (primary) {
    if (
      input?.maskedIdentifier &&
      (!primary.maskedIdentifier || primary.maskedIdentifier === "")
    ) {
      const userId = await requireUserId();
      const supabase = await createSupabaseServerClient();
      await supabase
        .from("accounts")
        .update({
          masked_identifier: input.maskedIdentifier.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", primary.id);
      return (await getAccount(primary.id)) ?? primary;
    }
    return primary;
  }

  return createAccount({
    name: "Bangkok Bank",
    institution: "Bangkok Bank",
    accountType: "checking",
    currency: input?.currency ?? "THB",
    maskedIdentifier: input?.maskedIdentifier ?? null,
    makeDefault: true,
  });
}

export async function createAccount(input: {
  name: string;
  institution?: string | null;
  accountType: Account["accountType"];
  currency: CurrencyCode;
  maskedIdentifier?: string | null;
  makeDefault?: boolean;
}): Promise<Account> {
  const userId = await requireUserId();
  await ensureProfile(userId);
  const supabase = await createSupabaseServerClient();

  const existing = await listAccounts();
  const makeDefault = input.makeDefault ?? existing.length === 0;

  if (makeDefault && existing.length > 0) {
    const { error: clearError } = await supabase
      .from("accounts")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
    if (clearError) throw new Error(clearError.message);
  }

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      institution: input.institution?.trim() || null,
      account_type: input.accountType,
      currency: input.currency,
      masked_identifier: input.maskedIdentifier?.trim() || null,
      is_active: true,
      is_default: makeDefault,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapAccount(data);
}

export async function createCheckpoint(input: {
  accountId: string;
  balanceMinor: number;
  verifiedAt?: string;
  source: string;
  note?: string | null;
}): Promise<BalanceCheckpoint> {
  const userId = await requireUserId();
  const account = await getAccount(input.accountId);
  if (!account) throw new Error("Kontot hittades inte");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("balance_checkpoints")
    .insert({
      user_id: userId,
      account_id: input.accountId,
      balance_minor: input.balanceMinor,
      currency: account.currency,
      verified_at: input.verifiedAt ?? new Date().toISOString(),
      source: input.source,
      note: input.note ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapCheckpoint(data);
}

export async function createManualExpense(input: {
  accountId: string;
  amountMinor: number;
  description?: string;
  category?: string | null;
  occurredAt?: string;
  source?: TransactionSource;
  sourceObservationId?: string | null;
  merchant?: string | null;
  fingerprint?: string | null;
  balanceAfterMinor?: number | null;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }

  const userId = await requireUserId();
  const account = await getAccount(input.accountId);
  if (!account) throw new Error("Kontot hittades inte");

  if (input.sourceObservationId) {
    const obs = await getObservation(input.sourceObservationId);
    if (!obs || obs.userId !== userId) {
      throw new Error("Importen hittades inte");
    }
  }

  if (input.fingerprint) {
    const known = await listKnownFingerprints();
    if (known.includes(input.fingerprint)) {
      throw new Error("Den här bankbetalningen finns redan");
    }
  }

  const supabase = await createSupabaseServerClient();
  const ts = new Date().toISOString();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: input.accountId,
      direction: "debit",
      transaction_type: "expense",
      amount_minor: input.amountMinor,
      currency: account.currency,
      occurred_at: input.occurredAt ?? ts,
      description: input.description?.trim() || "Utgift",
      merchant: input.merchant ?? null,
      category: input.category ?? null,
      source: input.source ?? "manual",
      status: "confirmed",
      sync_status: "synced",
      source_observation_id: input.sourceObservationId ?? null,
      fingerprint: input.fingerprint ?? null,
      balance_after_minor: input.balanceAfterMinor ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapTransaction(data);
}

export async function createManualIncome(input: {
  accountId: string;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }
  const userId = await requireUserId();
  const account = await getAccount(input.accountId);
  if (!account) throw new Error("Kontot hittades inte");

  const supabase = await createSupabaseServerClient();
  const ts = new Date().toISOString();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: input.accountId,
      direction: "credit",
      transaction_type: "income",
      amount_minor: input.amountMinor,
      currency: account.currency,
      occurred_at: input.occurredAt ?? ts,
      description: input.description?.trim() || "Inkomst",
      source: "manual",
      status: "confirmed",
      sync_status: "synced",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTransaction(data);
}

export async function createTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<{ out: CanonicalTransaction; inn: CanonicalTransaction }> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Välj två olika konton");
  }

  const userId = await requireUserId();
  const from = await getAccount(input.fromAccountId);
  const to = await getAccount(input.toAccountId);
  if (!from || !to) throw new Error("Kontot hittades inte");
  if (from.currency !== to.currency) {
    throw new Error("Överföring mellan olika valutor stöds inte ännu");
  }

  const supabase = await createSupabaseServerClient();
  const ts = new Date().toISOString();
  const occurredAt = input.occurredAt ?? ts;
  const description = input.description?.trim() || "Överföring";

  const { data: outRow, error: outError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: from.id,
      counter_account_id: to.id,
      direction: "debit",
      transaction_type: "transfer",
      amount_minor: input.amountMinor,
      currency: from.currency,
      occurred_at: occurredAt,
      description,
      source: "manual",
      status: "confirmed",
      sync_status: "synced",
    })
    .select("*")
    .single();
  if (outError) throw new Error(outError.message);

  const { data: inRow, error: inError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: to.id,
      counter_account_id: from.id,
      direction: "credit",
      transaction_type: "transfer",
      amount_minor: input.amountMinor,
      currency: to.currency,
      occurred_at: occurredAt,
      description,
      source: "manual",
      status: "confirmed",
      sync_status: "synced",
    })
    .select("*")
    .single();
  if (inError) throw new Error(inError.message);

  return { out: mapTransaction(outRow), inn: mapTransaction(inRow) };
}

export async function createCashWithdrawal(input: {
  fromAccountId: string;
  toAccountId?: string | null;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<{ out: CanonicalTransaction; inn: CanonicalTransaction | null }> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }

  const userId = await requireUserId();
  const from = await getAccount(input.fromAccountId);
  if (!from) throw new Error("Kontot hittades inte");

  let to = null as Awaited<ReturnType<typeof getAccount>>;
  if (input.toAccountId) {
    to = await getAccount(input.toAccountId);
    if (!to) throw new Error("Kontantkontot hittades inte");
    if (from.currency !== to.currency) {
      throw new Error("Olika valutor stöds inte ännu");
    }
  }

  const supabase = await createSupabaseServerClient();
  const ts = new Date().toISOString();
  const occurredAt = input.occurredAt ?? ts;
  const description = input.description?.trim() || "Kontantuttag";

  const { data: outRow, error: outError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: from.id,
      counter_account_id: to?.id ?? null,
      direction: "debit",
      transaction_type: "cash_withdrawal",
      amount_minor: input.amountMinor,
      currency: from.currency,
      occurred_at: occurredAt,
      description,
      source: "manual",
      status: "confirmed",
      sync_status: "synced",
    })
    .select("*")
    .single();
  if (outError) throw new Error(outError.message);

  if (!to) {
    return { out: mapTransaction(outRow), inn: null };
  }

  const { data: inRow, error: inError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: to.id,
      counter_account_id: from.id,
      direction: "credit",
      transaction_type: "cash_withdrawal",
      amount_minor: input.amountMinor,
      currency: to.currency,
      occurred_at: occurredAt,
      description,
      source: "manual",
      status: "confirmed",
      sync_status: "synced",
    })
    .select("*")
    .single();
  if (inError) throw new Error(inError.message);

  return { out: mapTransaction(outRow), inn: mapTransaction(inRow) };
}

export async function listTransactions(
  accountId?: string,
  options?: { sinceIso?: string; limit?: number },
): Promise<CanonicalTransaction[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false });

  if (accountId) {
    query = query.eq("account_id", accountId);
  }
  if (options?.sinceIso) {
    query = query.gte("occurred_at", options.sinceIso);
  }
  if (options?.limit != null) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTransaction);
}

export async function updateTransaction(input: {
  id: string;
  amountMinor?: number;
  description?: string;
  category?: string | null;
}): Promise<CanonicalTransaction> {
  const userId = await requireUserId();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.amountMinor != null) {
    if (input.amountMinor <= 0) {
      throw new Error("Beloppet måste vara större än noll");
    }
    patch.amount_minor = input.amountMinor;
  }
  if (input.description != null) {
    patch.description = input.description.trim() || "Utgift";
  }
  if (input.category !== undefined) patch.category = input.category;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", input.id)
    .neq("status", "voided")
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTransaction(data);
}

export async function voidTransaction(id: string): Promise<CanonicalTransaction> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      status: "voided",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapTransaction(data);
}

export async function listKnownFingerprints(): Promise<string[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const [{ data: txs }, { data: cands }] = await Promise.all([
    supabase
      .from("transactions")
      .select("fingerprint")
      .eq("user_id", userId)
      .not("fingerprint", "is", null),
    supabase
      .from("extracted_transaction_candidates")
      .select("fingerprint, status")
      .eq("user_id", userId)
      .not("fingerprint", "is", null)
      .in("status", ["confirmed", "duplicate"]),
  ]);

  const fps = [
    ...(txs ?? []).map((r) => r.fingerprint as string),
    ...(cands ?? []).map((r) => r.fingerprint as string),
  ].filter(Boolean);
  return [...new Set(fps)];
}

export async function createScreenshotObservation(input: {
  notes?: string | null;
  institutionHint?: string | null;
  accountHint?: string | null;
}): Promise<SourceObservation> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_observations")
    .insert({
      user_id: userId,
      kind: "screenshot",
      institution_hint: input.institutionHint ?? "Bangkok Bank",
      account_hint: input.accountHint ?? null,
      status: "uploaded",
      notes:
        input.notes ??
        "Skärmbild mottagen. OCR är inte inkopplad ännu — observation sparad för framtida import.",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapObservation(data);
}

export async function listObservations(): Promise<SourceObservation[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_observations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapObservation);
}

export async function getObservation(
  observationId: string,
): Promise<SourceObservation | null> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_observations")
    .select("*")
    .eq("user_id", userId)
    .eq("id", observationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapObservation(data) : null;
}

export async function latestCheckpointForAccount(
  accountId: string,
): Promise<BalanceCheckpoint | null> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("balance_checkpoints")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapCheckpoint(data) : null;
}

export async function listPlanItems(): Promise<PlanItem[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_items")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPlanItem);
}

export async function createPlanItem(input: {
  name: string;
  kind: PlanCategoryKind;
  amountMinor: number;
  currency: CurrencyCode;
  cadence?: string | null;
  nextDueAt?: string | null;
}): Promise<PlanItem> {
  if (input.amountMinor < 0) throw new Error("Belopp kan inte vara negativt");
  const userId = await requireUserId();
  await ensureProfile(userId);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_items")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      kind: input.kind,
      amount_minor: input.amountMinor,
      currency: input.currency,
      cadence: input.cadence ?? "monthly",
      next_due_at: input.nextDueAt ?? null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPlanItem(data);
}

export async function updatePlanItem(input: {
  id: string;
  name?: string;
  kind?: PlanCategoryKind;
  amountMinor?: number;
  nextDueAt?: string | null;
  isActive?: boolean;
}): Promise<PlanItem> {
  const userId = await requireUserId();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name != null) patch.name = input.name.trim();
  if (input.kind != null) patch.kind = input.kind;
  if (input.amountMinor != null) {
    if (input.amountMinor < 0) throw new Error("Belopp kan inte vara negativt");
    patch.amount_minor = input.amountMinor;
  }
  if (input.nextDueAt !== undefined) patch.next_due_at = input.nextDueAt;
  if (input.isActive != null) patch.is_active = input.isActive;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPlanItem(data);
}

export async function deletePlanItem(id: string): Promise<void> {
  await updatePlanItem({ id, isActive: false });
}

export async function setNextIncomeDate(isoDate: string): Promise<PlanItem> {
  const items = await listPlanItems();
  const existing = items.find((p) => p.name === NEXT_INCOME_NAME);
  const profile = await getProfile();
  const accounts = await listAccounts();
  const currency =
    accounts.find((a) => a.isDefault)?.currency ?? profile.primaryCurrency;
  if (existing) {
    return updatePlanItem({
      id: existing.id,
      nextDueAt: isoDate,
    });
  }
  return createPlanItem({
    name: NEXT_INCOME_NAME,
    kind: "expected",
    amountMinor: 0,
    currency,
    cadence: "income",
    nextDueAt: isoDate,
  });
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const [profile, accounts, planItems, progress] = await Promise.all([
    getProfile(),
    listAccounts(),
    listPlanItems().catch(() => [] as PlanItem[]),
    getUserProgress().catch(() => null),
  ]);
  const primary = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;

  if (!primary) {
    return emptySnapshot(profile, accounts, progress, planItems);
  }

  const timezone = profile.timezone;
  const now = new Date();
  const monthStart = startOfZonedMonth(now, timezone);

  const checkpoint = await latestCheckpointForAccount(primary.id);

  if (!checkpoint) {
    return {
      profile,
      accounts,
      primaryAccount: primary,
      checkpoint: null,
      calculatedBalanceMinor: 0,
      balanceKind: "unknown",
      verificationLabel: null,
      todaySpendingMinor: 0,
      monthSpendingMinor: 0,
      safeToSpendTodayMinor: 0,
      safeToSpendWeekMinor: 0,
      freeMinor: 0,
      reservedMinor: 0,
      bufferMinor: 0,
      flexibleMinor: 0,
      daysUntilIncome: 0,
      recentTransactions: [],
      planItems,
      currency: primary.currency,
      progress: progress ?? emptyUserProgress(profile.id),
    };
  }

  const sinceCandidates = [monthStart.toISOString(), checkpoint.verifiedAt];
  const sinceIso = sinceCandidates.sort()[0]!;

  const accountTx = await listTransactions(primary.id, {
    sinceIso,
    limit: 120,
  });

  const after = filterTransactionsAfterCheckpoint(accountTx, checkpoint);
  let calculated = null;
  try {
    calculated = calculateAccountBalance({
      checkpoint,
      transactionsAfterCheckpoint: after,
    });
  } catch (error) {
    console.error("[numa] balance calc failed", error);
  }

  const dayStart = startOfZonedDay(now, timezone);
  const todayTx = accountTx.filter(
    (t) =>
      t.status === "confirmed" &&
      isSameZonedDay(t.occurredAt, now, timezone) &&
      Date.parse(t.occurredAt) >= dayStart.getTime(),
  );
  const monthTx = accountTx.filter(
    (t) =>
      t.status === "confirmed" && Date.parse(t.occurredAt) >= monthStart.getTime(),
  );

  const currency = primary.currency;
  const todaySpending = sumSpending(todayTx, currency);
  const monthSpending = sumSpending(monthTx, currency);
  const monthKey = monthKeyFromDate(now, timezone);
  const projection = projectPlanForMonth(planItems, monthKey, timezone);
  const cycle = projectPayCycle(planItems, now, timezone);
  const totals = calculatePlanTotals(planItems, currency, now, 0);
  // Cycle expenses + savings; buffer separate (avoid double-count).
  const reservedMinor = cycle.reservedMinor + cycle.savingsMinor;
  const bufferMinor = cycle.bufferMinor;
  const available = calculated ?? money(0, currency);
  const daysUntilNextIncome = Math.max(
    1,
    cycle.startAt ? cycle.daysLeft : totals.daysUntilNextIncome || 1,
  );
  const safe = calculateSafeToSpend({
    available,
    reserved: money(reservedMinor, currency),
    safetyBuffer: money(bufferMinor, currency),
    daysUntilNextIncome,
    flexiblePlanRemaining:
      cycle.flexibleMinor > 0
        ? money(cycle.flexibleMinor, currency)
        : undefined,
  });

  let balanceKind: TodaySnapshot["balanceKind"] = "unknown";
  if (after.length === 0) balanceKind = "verified_checkpoint_only";
  else if (calculated) balanceKind = "calculated";
  else balanceKind = "verified_checkpoint_only";

  return {
    profile,
    accounts,
    primaryAccount: primary,
    checkpoint,
    calculatedBalanceMinor: calculated?.amountMinor ?? null,
    balanceKind,
    verificationLabel: formatRelativeVerificationSv(checkpoint.verifiedAt, now),
    todaySpendingMinor: todaySpending.amountMinor,
    monthSpendingMinor: monthSpending.amountMinor,
    safeToSpendTodayMinor: safe.today.amountMinor,
    safeToSpendWeekMinor: safe.week.amountMinor,
    freeMinor: safe.free.amountMinor,
    reservedMinor: cycle.expenseMinor || projection.totalPlannedMinor,
    bufferMinor,
    flexibleMinor: cycle.flexibleMinor || projection.flexibleMinor,
    daysUntilIncome: daysUntilNextIncome,
    recentTransactions: accountTx.slice(0, 8),
    planItems,
    currency,
    progress,
  };
}

function emptySnapshot(
  profile: Profile,
  accounts: Account[],
  progress: UserProgress | null,
  planItems: PlanItem[] = [],
): TodaySnapshot {
  return {
    profile,
    accounts,
    primaryAccount: null,
    checkpoint: null,
    calculatedBalanceMinor: null,
    balanceKind: "unknown",
    verificationLabel: null,
    todaySpendingMinor: 0,
    monthSpendingMinor: 0,
    safeToSpendTodayMinor: 0,
    safeToSpendWeekMinor: 0,
    freeMinor: 0,
    reservedMinor: 0,
    bufferMinor: 0,
    flexibleMinor: 0,
    daysUntilIncome: 0,
    recentTransactions: [],
    planItems,
    currency: profile.primaryCurrency,
    progress: progress ?? emptyUserProgress(profile.id),
  };
}

const MEDIA_BUCKET = "numa-source-media";

export async function getUserProgress(): Promise<UserProgress | null> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Table may be missing if migration not applied — soft degrade.
    console.warn("[numa] user_progress read failed", error.message);
    return emptyUserProgress(userId);
  }
  if (data) return mapUserProgress(data);

  const { data: created, error: insertError } = await supabase
    .from("user_progress")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (insertError) {
    console.warn("[numa] user_progress insert failed", insertError.message);
    return emptyUserProgress(userId);
  }
  return mapUserProgress(created);
}

export async function recordOnTrackDayIfNeeded(
  isOnTrack: boolean,
): Promise<UserProgress | null> {
  const userId = await requireUserId();
  if (!isOnTrack) return getUserProgress();

  const profile = await getProfile();
  const dayStart = startOfZonedDay(new Date(), profile.timezone);
  const dayKey = dayStart.toISOString().slice(0, 10);

  const supabase = await createSupabaseServerClient();
  const { data: existingEvents, error: evError } = await supabase
    .from("progress_events")
    .select("id, payload")
    .eq("user_id", userId)
    .eq("event_type", "day_on_track")
    .gte("created_at", dayStart.toISOString())
    .limit(10);

  if (evError) {
    console.warn("[numa] progress_events read failed", evError.message);
    return getUserProgress();
  }
  const already = (existingEvents ?? []).some((row) => {
    const payload = row.payload as { dayKey?: string } | null;
    return payload?.dayKey === dayKey;
  });
  if (already) {
    return getUserProgress();
  }

  const current = (await getUserProgress()) ?? emptyUserProgress(userId);
  const onTrackDays = current.onTrackDays + 1;
  const currentStreak = current.currentStreak + 1;
  const bestStreak = Math.max(current.bestStreak, currentStreak);
  const rank = rankForOnTrackDays(onTrackDays);
  const disciplineScore = current.disciplineScore + 10;
  const level = rank.minLevel;

  const { data: updated, error: upError } = await supabase
    .from("user_progress")
    .upsert({
      user_id: userId,
      level,
      rank_id: rank.id,
      on_track_days: onTrackDays,
      current_streak: currentStreak,
      best_streak: bestStreak,
      discipline_score: disciplineScore,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (upError) {
    console.warn("[numa] user_progress update failed", upError.message);
    return current;
  }

  await supabase.from("progress_events").insert({
    user_id: userId,
    event_type: "day_on_track",
    delta_score: 10,
    payload: { dayKey },
  });

  return mapUserProgress(updated);
}

export async function uploadReceiptAndExtract(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<ReceiptUploadResult> {
  const userId = await requireUserId();
  await ensureProfile(userId);
  const supabase = await createSupabaseServerClient();
  const storagePath = buildUserStoragePath(userId, input.fileName);
  assertUserOwnsStoragePath(userId, storagePath);

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  const provider = createExtractionProvider();
  const imageBase64 = Buffer.from(input.bytes).toString("base64");
  const extraction = await provider.extract({
    observationId: "pending",
    storagePath,
    imageBase64,
    mimeType: input.mimeType,
  });

  const known = await listKnownFingerprints();
  const resolved = resolveScreenshotImport(extraction, known);

  const { data: obsRow, error: obsError } = await supabase
    .from("source_observations")
    .insert({
      user_id: userId,
      kind: resolved.observationKind,
      storage_path: storagePath,
      institution_hint:
        resolved.kind === "bank_sms" ? "Bangkok Bank" : null,
      account_hint:
        resolved.kind === "bank_sms"
          ? (resolved.selected?.maskedAccount ?? null)
          : null,
      status: "extracting",
      notes: "Bild uppladdad — väntar på läsning",
    })
    .select("*")
    .single();
  if (obsError) throw new Error(obsError.message);
  const observation = mapObservation(obsRow);

  const runStatus = extraction.provider === "none" ? "failed" : "succeeded";
  const { data: runRow, error: runError } = await supabase
    .from("extraction_runs")
    .insert({
      observation_id: observation.id,
      user_id: userId,
      provider: extraction.provider,
      status: runStatus,
      raw_metadata: {
        ...extraction.rawMetadata,
        resolvedKind: resolved.kind,
        alreadyKnown: resolved.alreadyKnown,
      },
      finished_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (runError) throw new Error(runError.message);
  mapExtractionRun(runRow);

  let candidate: ExtractedTransactionCandidate | null = null;
  if (resolved.suggestedAmountMinor != null && !resolved.alreadyKnown) {
    const { data: candRow, error: candError } = await supabase
      .from("extracted_transaction_candidates")
      .insert({
        extraction_run_id: runRow.id,
        observation_id: observation.id,
        user_id: userId,
        direction: resolved.direction,
        amount_minor: resolved.suggestedAmountMinor,
        currency: resolved.currency,
        balance_after_minor: resolved.balanceAfterMinor,
        occurred_at: null,
        description: resolved.suggestedDescription,
        confidence:
          resolved.kind === "bank_sms"
            ? (resolved.selected?.confidence ?? null)
            : null,
        fingerprint: resolved.fingerprint,
        status: "needs_review",
        raw_payload: {
          importKind: resolved.kind,
          labelSv: resolved.suggestedDescription,
        },
      })
      .select("*")
      .single();
    if (candError) throw new Error(candError.message);
    candidate = mapCandidate(candRow);
  }

  await supabase
    .from("source_observations")
    .update({
      status: resolved.alreadyKnown
        ? "processed"
        : resolved.suggestedAmountMinor
          ? "needs_review"
          : "uploaded",
      notes:
        extraction.provider === "none"
          ? "Bild sparad. Kunde inte autoläsa — skriv beloppet som drogs (inte saldot)."
          : resolved.messageSv,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", observation.id);

  const refreshed = (await getObservation(observation.id)) ?? observation;
  const profile = await getProfile();

  let ocrStatus: ReceiptUploadResult["ocrStatus"] = "ok";
  if (extraction.provider === "none") ocrStatus = "unavailable";
  else if (resolved.alreadyKnown) ocrStatus = "all_known";
  else if (resolved.suggestedAmountMinor == null) ocrStatus = "failed";

  const skippedOlderCount =
    resolved.kind === "bank_sms" && resolved.selection.status === "ready"
      ? resolved.selection.skippedOlderCount
      : 0;

  return {
    observation: refreshed,
    candidate,
    suggestedAmountMinor: resolved.suggestedAmountMinor,
    suggestedDescription: resolved.suggestedDescription,
    currency: resolved.currency ?? profile.primaryCurrency,
    ocrStatus,
    message:
      ocrStatus === "unavailable"
        ? "Kunde inte autoläsa just nu. Skriv beloppet som drogs i SMS:et (t.ex. 65,00) — inte saldot."
        : resolved.messageSv,
    importKind:
      resolved.kind === "bank_sms"
        ? "bank_sms"
        : resolved.kind === "receipt_or_other"
          ? "receipt"
          : "unknown",
    balanceAfterMinor: resolved.balanceAfterMinor,
    fingerprint: resolved.fingerprint,
    alreadyKnown: resolved.alreadyKnown,
    skippedOlderCount,
  };
}

export async function confirmReceiptExpense(
  input: ConfirmReceiptInput,
): Promise<CanonicalTransaction> {
  const userId = await requireUserId();
  const observation = await getObservation(input.observationId);
  if (!observation || observation.userId !== userId) {
    throw new Error("Importen hittades inte");
  }

  let fingerprint = input.fingerprint ?? null;
  let balanceAfterMinor = input.balanceAfterMinor ?? null;
  let source: TransactionSource = input.source ?? "receipt_camera";
  let maskedFromCandidate: string | null = input.maskedAccount ?? null;

  const supabase = await createSupabaseServerClient();
  if (input.candidateId) {
    const { data: cand, error } = await supabase
      .from("extracted_transaction_candidates")
      .select("*")
      .eq("user_id", userId)
      .eq("id", input.candidateId)
      .eq("observation_id", input.observationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cand) throw new Error("Kandidaten hittades inte");
    fingerprint = fingerprint ?? (cand.fingerprint as string | null);
    balanceAfterMinor =
      balanceAfterMinor ?? (cand.balance_after_minor as number | null);
    if (observation.kind === "screenshot") source = "screenshot";
  }

  maskedFromCandidate =
    maskedFromCandidate ?? observation.accountHint ?? null;

  const account =
    (input.accountId ? await getAccount(input.accountId) : null) ??
    (await ensureDefaultBankAccount({
      maskedIdentifier: maskedFromCandidate,
      currency: "THB",
    }));

  const existingCheckpoint = await latestCheckpointForAccount(account.id);
  const hadCheckpoint = existingCheckpoint != null;
  if (!hadCheckpoint && balanceAfterMinor == null) {
    throw new Error(
      "Första importen måste vara ett bank-SMS med saldo (available balance)",
    );
  }

  const expenseAt = new Date(Date.now() - 2_000).toISOString();
  const checkpointAt = new Date().toISOString();

  const tx = await createManualExpense({
    accountId: account.id,
    amountMinor: input.amountMinor,
    description: input.description,
    category: input.category,
    source,
    sourceObservationId: input.observationId,
    fingerprint,
    balanceAfterMinor,
    occurredAt: expenseAt,
  });

  if (balanceAfterMinor != null) {
    await createCheckpoint({
      accountId: account.id,
      balanceMinor: balanceAfterMinor,
      verifiedAt: checkpointAt,
      source: hadCheckpoint ? "sms_import" : "sms_bootstrap",
      note: hadCheckpoint
        ? "Saldo från Bangkok Bank SMS"
        : "Första saldo från Bangkok Bank SMS",
    });
  }

  if (input.candidateId) {
    await supabase
      .from("extracted_transaction_candidates")
      .update({
        status: "confirmed",
        canonical_transaction_id: tx.id,
        amount_minor: input.amountMinor,
        fingerprint,
        balance_after_minor: balanceAfterMinor,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", input.candidateId);
  }

  await supabase
    .from("source_observations")
    .update({
      status: "processed",
      notes: hadCheckpoint
        ? "Bekräftad och sparad"
        : "Första SMS — saldo och utgift sparade",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", input.observationId);

  return tx;
}
