import {
  calculateAccountBalance,
  calculatePlanTotals,
  calculateSafeToSpend,
  computeSpendingWindows,
  filterTransactionsAfterCheckpoint,
  formatRelativeVerificationSv,
  monthKeyFromDate,
  NEXT_INCOME_NAME,
  projectPayCycle,
  projectPlanForMonth,
  resolveSmsTipBalanceMinor,
  shouldWriteSmsTipCheckpoint,
  snapshotLedgerWindow,
  startOfZonedDay,
  startOfZonedMonth,
  decideSmsBatchConfirm,
  isUniqueViolationMessage,
  swedishFingerprintConflictError,
  collectPairedVoidIds,
  hasCycleFundingEvidence,
  resolveSmsBatchOccurredAt,
  zonedDayKey,
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
import { knownDisplayNameForEmail } from "@/domain/identity/display-name";

/** One auth lookup per request — repeated getUser() made Idag feel stuck. */
const requireAuthUser = cache(async (): Promise<{ id: string; email: string }> => {
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
  return { id: user.id, email: user.email ?? "" };
});

const requireUserId = cache(async (): Promise<string> => {
  return (await requireAuthUser()).id;
});

async function ensureProfile(_userId?: string): Promise<Profile> {
  const { id: userId, email } = await requireAuthUser();
  const named = knownDisplayNameForEmail(email);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) {
    const mapped = mapProfile(data);
    if (named && mapped.displayName !== named) {
      await supabase
        .from("profiles")
        .update({ display_name: named })
        .eq("id", userId);
      return { ...mapped, displayName: named };
    }
    return mapped;
  }

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      display_name: named ?? "Användare",
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
  return ensureProfile();
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
  const wantedCurrency = input?.currency ?? "THB";
  const primary = existing.find((a) => a.isDefault) ?? existing[0] ?? null;
  if (primary) {
    if (primary.currency !== wantedCurrency) {
      const matching =
        existing.find(
          (a) => a.currency === wantedCurrency && a.accountType !== "cash",
        ) ??
        existing.find((a) => a.currency === wantedCurrency) ??
        null;
      if (matching) {
        return matching;
      }
      return createAccount({
        name: wantedCurrency === "THB" ? "Bangkok Bank" : "Bankkonto",
        institution: wantedCurrency === "THB" ? "Bangkok Bank" : null,
        accountType: "checking",
        currency: wantedCurrency,
        maskedIdentifier: input?.maskedIdentifier ?? null,
        makeDefault: existing.length === 0,
      });
    }
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
    currency: wantedCurrency,
    maskedIdentifier: input?.maskedIdentifier ?? null,
    makeDefault: true,
  });
}

/**
 * Find or create an active account for a given currency (bank-app EUR, etc.).
 * Never steals the default THB account for foreign currencies.
 */
export async function ensureAccountForCurrency(input: {
  currency: CurrencyCode;
  name: string;
  institution?: string | null;
}): Promise<Account> {
  const existing = await listAccounts();
  const institution = input.institution?.trim() || null;

  if (institution) {
    const exact = existing.find(
      (a) =>
        a.currency === input.currency &&
        (a.institution ?? "").toLowerCase() === institution.toLowerCase(),
    );
    if (exact) return exact;
    // Do not reuse another institution's same-currency wallet (bunq vs Revolut).
  } else {
    const any = existing.find((a) => a.currency === input.currency);
    if (any) return any;
  }

  if (input.currency === "THB" && !institution) {
    return ensureDefaultBankAccount({ currency: "THB" });
  }

  return createAccount({
    name: input.name,
    institution: institution ?? input.name,
    accountType: "checking",
    currency: input.currency,
    makeDefault: false,
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
    const known = await listConfirmedFingerprints();
    if (known.includes(input.fingerprint)) {
      throw new Error(swedishFingerprintConflictError());
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

  if (error) {
    if (isUniqueViolationMessage(error.message)) {
      throw new Error(swedishFingerprintConflictError());
    }
    throw new Error(error.message);
  }
  return mapTransaction(data);
}

export async function createManualIncome(input: {
  accountId: string;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
  source?: TransactionSource;
  sourceObservationId?: string | null;
  fingerprint?: string | null;
  balanceAfterMinor?: number | null;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }
  const userId = await requireUserId();
  const account = await getAccount(input.accountId);
  if (!account) throw new Error("Kontot hittades inte");

  if (input.fingerprint) {
    const known = await listConfirmedFingerprints();
    if (known.includes(input.fingerprint)) {
      throw new Error(swedishFingerprintConflictError());
    }
  }

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
      description: input.description?.trim() || "Insättning",
      source: input.source ?? "manual",
      status: "confirmed",
      sync_status: "synced",
      fingerprint: input.fingerprint ?? null,
      balance_after_minor: input.balanceAfterMinor ?? null,
      source_observation_id: input.sourceObservationId ?? null,
    })
    .select("*")
    .single();
  if (error) {
    if (isUniqueViolationMessage(error.message)) {
      throw new Error(swedishFingerprintConflictError());
    }
    throw new Error(error.message);
  }
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
  const transferGroupId = crypto.randomUUID();
  const outId = crypto.randomUUID();
  const inId = crypto.randomUUID();

  // Single multi-row insert — both legs commit together or neither does.
  const { data: rows, error } = await supabase
    .from("transactions")
    .insert([
      {
        id: outId,
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
        transfer_group_id: transferGroupId,
      },
      {
        id: inId,
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
        transfer_group_id: transferGroupId,
      },
    ])
    .select("*");
  if (error) throw new Error(error.message);

  const outRow = (rows ?? []).find((r) => r.id === outId);
  const inRow = (rows ?? []).find((r) => r.id === inId);
  if (!outRow || !inRow) {
    throw new Error("Överföringen sparades inte komplett");
  }

  return { out: mapTransaction(outRow), inn: mapTransaction(inRow) };
}

export async function createCashWithdrawal(input: {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  description?: string;
  occurredAt?: string;
}): Promise<{ out: CanonicalTransaction; inn: CanonicalTransaction }> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }
  if (!input.toAccountId) {
    throw new Error(
      "Välj ett kontantkonto — annars försvinner pengarna i modellen",
    );
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Välj två olika konton");
  }

  const userId = await requireUserId();
  const from = await getAccount(input.fromAccountId);
  if (!from) throw new Error("Kontot hittades inte");
  const to = await getAccount(input.toAccountId);
  if (!to) throw new Error("Kontantkontot hittades inte");
  if (to.accountType !== "cash") {
    throw new Error("Kontantuttag måste gå till ett konto av typen Kontanter");
  }
  if (from.currency !== to.currency) {
    throw new Error("Olika valutor stöds inte ännu");
  }

  const supabase = await createSupabaseServerClient();
  const ts = new Date().toISOString();
  const occurredAt = input.occurredAt ?? ts;
  const description = input.description?.trim() || "Kontantuttag";
  const transferGroupId = crypto.randomUUID();
  const outId = crypto.randomUUID();
  const inId = crypto.randomUUID();

  const { data: rows, error } = await supabase
    .from("transactions")
    .insert([
      {
        id: outId,
        user_id: userId,
        account_id: from.id,
        counter_account_id: to.id,
        direction: "debit",
        transaction_type: "cash_withdrawal",
        amount_minor: input.amountMinor,
        currency: from.currency,
        occurred_at: occurredAt,
        description,
        source: "manual",
        status: "confirmed",
        sync_status: "synced",
        transfer_group_id: transferGroupId,
      },
      {
        id: inId,
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
        transfer_group_id: transferGroupId,
      },
    ])
    .select("*");
  if (error) throw new Error(error.message);

  const outRow = (rows ?? []).find((r) => r.id === outId);
  const inRow = (rows ?? []).find((r) => r.id === inId);
  if (!outRow || !inRow) {
    throw new Error("Kontantuttaget sparades inte komplett");
  }

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
  const { data: target, error: readError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!target) throw new Error("Rörelsen hittades inte");

  let siblingRows: Array<Record<string, unknown>> = [];
  if (
    target.transaction_type === "transfer" ||
    target.transaction_type === "cash_withdrawal"
  ) {
    if (target.transfer_group_id) {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("transfer_group_id", target.transfer_group_id);
      if (error) throw new Error(error.message);
      siblingRows = data ?? [];
    } else if (target.counter_account_id) {
      // Legacy rows without transfer_group_id.
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("transaction_type", target.transaction_type)
        .eq("amount_minor", target.amount_minor)
        .eq("occurred_at", target.occurred_at)
        .eq("account_id", target.counter_account_id)
        .eq("counter_account_id", target.account_id)
        .neq("status", "voided");
      if (error) throw new Error(error.message);
      siblingRows = data ?? [];
    }
  }

  const ids = collectPairedVoidIds(
    {
      id: target.id as string,
      transactionType: target.transaction_type as string,
      accountId: target.account_id as string,
      counterAccountId: (target.counter_account_id as string | null) ?? null,
      amountMinor: Number(target.amount_minor),
      occurredAt: target.occurred_at as string,
      transferGroupId: (target.transfer_group_id as string | null) ?? null,
      status: target.status as string,
    },
    siblingRows.map((row) => ({
      id: row.id as string,
      transactionType: row.transaction_type as string,
      accountId: row.account_id as string,
      counterAccountId: (row.counter_account_id as string | null) ?? null,
      amountMinor: Number(row.amount_minor),
      occurredAt: row.occurred_at as string,
      transferGroupId: (row.transfer_group_id as string | null) ?? null,
      status: row.status as string,
    })),
  );

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ status: "voided", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", ids);
  if (updateError) throw new Error(updateError.message);

  const { data: voided, error: afterError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();
  if (afterError) throw new Error(afterError.message);
  return mapTransaction(voided);
}

export async function listKnownFingerprints(options?: {
  includePendingCandidates?: boolean;
}): Promise<string[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const pending = options?.includePendingCandidates !== false;
  const candStatuses = pending
    ? ["confirmed", "duplicate", "needs_review"]
    : ["confirmed", "duplicate"];
  const [{ data: txs }, { data: cands }] = await Promise.all([
    supabase
      .from("transactions")
      .select("fingerprint")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .not("fingerprint", "is", null),
    supabase
      .from("extracted_transaction_candidates")
      .select("fingerprint, status")
      .eq("user_id", userId)
      .not("fingerprint", "is", null)
      .in("status", candStatuses),
  ]);

  const fps = [
    ...(txs ?? []).map((r) => r.fingerprint as string),
    ...(cands ?? []).map((r) => r.fingerprint as string),
  ].filter(Boolean);
  return [...new Set(fps)];
}

export async function listConfirmedFingerprints(): Promise<string[]> {
  return listKnownFingerprints({ includePendingCandidates: false });
}

/**
 * Abandoned needs_review candidates must not block a re-scan of the same SMS
 * (unique fingerprint index + false “finns redan”). Mark them rejected so a
 * fresh observation can create new review rows.
 */
export async function supersedePendingCandidatesByFingerprints(
  fingerprints: string[],
): Promise<number> {
  const fps = [...new Set(fingerprints.map((f) => f.trim()).filter(Boolean))];
  if (fps.length === 0) return 0;
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("extracted_transaction_candidates")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .in("status", ["needs_review", "pending"])
    .in("fingerprint", fps)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
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
  const monthKey = monthKeyFromDate(now, timezone);
  const cycle = projectPayCycle(planItems, now, timezone);

  const spendWindow = snapshotLedgerWindow({
    monthStart,
    cycleStartAt: cycle.startAt,
  });
  const [checkpoint, spendTx] = await Promise.all([
    latestCheckpointForAccount(primary.id),
    listTransactions(primary.id, { sinceIso: spendWindow.spendSinceIso }),
  ]);
  const ledger = snapshotLedgerWindow({
    monthStart,
    cycleStartAt: cycle.startAt,
    checkpointVerifiedAt: checkpoint?.verifiedAt,
  });
  const accountTx = ledger.refetchFromCheckpoint
    ? await listTransactions(primary.id, { sinceIso: ledger.saldoSinceIso })
    : spendTx;

  const after = filterTransactionsAfterCheckpoint(accountTx, checkpoint);
  let calculated = null;
  if (checkpoint) {
    try {
      calculated = calculateAccountBalance({
        checkpoint,
        transactionsAfterCheckpoint: after,
      });
    } catch (error) {
      console.error("[numa] balance calc failed", error);
    }
  }

  const currency = primary.currency;
  const projection = projectPlanForMonth(planItems, monthKey, timezone);
  const totals = calculatePlanTotals(planItems, currency, now, 0, timezone);
  // Cycle expenses + savings; buffer separate (avoid double-count).
  const reservedMinor = cycle.reservedMinor + cycle.savingsMinor;
  const bufferMinor = cycle.bufferMinor;
  const daysUntilNextIncome = Math.max(
    1,
    cycle.startAt ? cycle.daysLeft : totals.daysUntilNextIncome || 1,
  );
  const { today: todaySpending, month: monthSpending, cycle: cycleSpending } =
    computeSpendingWindows({
      transactions: accountTx,
      currency,
      now,
      timeZone: timezone || "Asia/Bangkok",
      cycleStartAt: cycle.startAt,
      cycleEndAt: cycle.endAt,
    });
  const fundingConfirmed = hasCycleFundingEvidence({
    cycleStartAt: cycle.startAt,
    cycleEndAt: cycle.endAt,
    transactions: accountTx,
  });
  // Unknown saldo must not feed safe-to-spend as fake ฿0 available.
  const safe =
    calculated != null
      ? calculateSafeToSpend({
          available: calculated,
          reserved: money(reservedMinor, currency),
          safetyBuffer: money(bufferMinor, currency),
          daysUntilNextIncome,
          flexiblePlanRemaining:
            cycle.flexibleMinor > 0
              ? money(cycle.flexibleMinor, currency)
              : undefined,
        })
      : null;

  let balanceKind: TodaySnapshot["balanceKind"] = "unknown";
  if (checkpoint && after.length === 0) balanceKind = "verified_checkpoint_only";
  else if (checkpoint && calculated) balanceKind = "calculated";
  else if (checkpoint) balanceKind = "verified_checkpoint_only";

  return {
    profile,
    accounts,
    primaryAccount: primary,
    checkpoint,
    // null (not 0): unknown saldo must not look like an empty wallet
    calculatedBalanceMinor: calculated?.amountMinor ?? null,
    balanceKind,
    verificationLabel: checkpoint
      ? formatRelativeVerificationSv(checkpoint.verifiedAt, now)
      : null,
    todaySpendingMinor: todaySpending.amountMinor,
    monthSpendingMinor: monthSpending.amountMinor,
    cycleSpendingMinor: cycleSpending.amountMinor,
    fundingConfirmed,
    safeToSpendTodayMinor: safe?.today.amountMinor ?? 0,
    safeToSpendWeekMinor: safe?.week.amountMinor ?? 0,
    freeMinor: safe?.free.amountMinor ?? 0,
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
    cycleSpendingMinor: 0,
    fundingConfirmed: false,
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
  const dayKey = zonedDayKey(new Date(), profile.timezone);

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
  preferBankSms?: boolean;
  preferBankApp?: boolean;
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

  const institutionHint = input.preferBankSms
    ? "Bangkok Bank"
    : input.preferBankApp
      ? "bank_app"
      : null;

  const provider = createExtractionProvider();
  const imageBase64 = Buffer.from(input.bytes).toString("base64");
  const extraction = await provider.extract({
    observationId: "pending",
    storagePath,
    imageBase64,
    mimeType: input.mimeType,
    institutionHint,
  });

  // Only confirmed ledger fingerprints count as "already imported".
  // Pending needs_review from abandoned scans must not block re-import.
  const known = await listConfirmedFingerprints();
  const resolved = resolveScreenshotImport(extraction, known, {
    preferBankSms: input.preferBankSms,
    preferBankApp: input.preferBankApp,
  });

  const batch =
    (resolved.kind === "bank_sms" || resolved.kind === "bank_app") &&
    !resolved.alreadyKnown
      ? resolved.selectedBatch
      : [];
  const hasBatch = batch.length > 0;
  const hasSingle =
    !hasBatch &&
    resolved.suggestedAmountMinor != null &&
    !resolved.alreadyKnown;

  if (hasBatch) {
    await supersedePendingCandidatesByFingerprints(
      batch
        .map((e) => e.fingerprint?.fingerprint)
        .filter((f): f is string => Boolean(f)),
    );
  } else if (hasSingle && resolved.fingerprint) {
    await supersedePendingCandidatesByFingerprints([resolved.fingerprint]);
  }

  const institutionForObs =
    resolved.kind === "bank_sms"
      ? "Bangkok Bank"
      : resolved.kind === "bank_app"
        ? (resolved.selected?.institution ??
          batch[0]?.institution ??
          "bank_app")
        : null;

  const { data: obsRow, error: obsError } = await supabase
    .from("source_observations")
    .insert({
      user_id: userId,
      kind: resolved.observationKind,
      storage_path: storagePath,
      institution_hint: institutionForObs,
      account_hint:
        resolved.kind === "bank_sms"
          ? (resolved.selected?.maskedAccount ??
            (batch[0] && "maskedAccount" in batch[0]
              ? batch[0].maskedAccount
              : null) ??
            null)
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
        tipBalanceAfterMinor:
          resolved.kind === "bank_sms" ? resolved.balanceAfterMinor : null,
      },
      finished_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (runError) throw new Error(runError.message);
  mapExtractionRun(runRow);

  const createdCandidates: ExtractedTransactionCandidate[] = [];
  const importKindTag =
    resolved.kind === "bank_sms"
      ? "bank_sms"
      : resolved.kind === "bank_app"
        ? "bank_app"
        : resolved.kind;

  if (hasBatch) {
    for (let batchIndex = 0; batchIndex < batch.length; batchIndex++) {
      const event = batch[batchIndex]!;
      if (
        event.amountMinor == null ||
        !event.direction ||
        !event.fingerprint
      ) {
        continue;
      }
      const { data: candRow, error: candError } = await supabase
        .from("extracted_transaction_candidates")
        .insert({
          extraction_run_id: runRow.id,
          observation_id: observation.id,
          user_id: userId,
          direction: event.direction,
          amount_minor: event.amountMinor,
          currency: event.currency ?? "THB",
          balance_after_minor:
            "balanceAfterMinor" in event ? event.balanceAfterMinor : null,
          occurred_at:
            "occurredAt" in event && typeof event.occurredAt === "string"
              ? event.occurredAt
              : null,
          description: event.labelSv,
          confidence: event.confidence,
          fingerprint: event.fingerprint.fingerprint,
          status: "needs_review",
          raw_payload: {
            importKind: importKindTag,
            labelSv: event.labelSv,
            batchIndex,
            tipBalanceAfterMinor:
              resolved.kind === "bank_sms" ? resolved.balanceAfterMinor : null,
            updatesBalance:
              resolved.kind === "bank_sms" &&
              resolved.balanceAfterMinor != null,
            merchant:
              "merchant" in event && typeof event.merchant === "string"
                ? event.merchant
                : null,
            accountInstitution:
              "institution" in event ? String(event.institution) : null,
            accountName:
              "institution" in event
                ? event.institution === "bunq"
                  ? "bunq"
                  : event.institution === "revolut"
                    ? "Revolut"
                    : "Bankapp"
                : null,
            annotationSv:
              "annotationSv" in event &&
              typeof event.annotationSv === "string"
                ? event.annotationSv
                : null,
          },
        })
        .select("*")
        .single();
      if (candError) throw new Error(candError.message);
      createdCandidates.push(mapCandidate(candRow));
    }
  } else if (hasSingle) {
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
          resolved.kind === "bank_sms" || resolved.kind === "bank_app"
            ? (resolved.selected?.confidence ?? null)
            : (extraction.candidates[0]?.confidence ??
              (typeof extraction.rawMetadata?.confidence === "number"
                ? extraction.rawMetadata.confidence
                : null)),
        fingerprint: resolved.fingerprint,
        status: "needs_review",
        raw_payload: {
          importKind: importKindTag,
          labelSv: resolved.suggestedDescription,
          batchIndex: 0,
        },
      })
      .select("*")
      .single();
    if (candError) throw new Error(candError.message);
    createdCandidates.push(mapCandidate(candRow));
  }

  const candidate = createdCandidates[0] ?? null;

  await supabase
    .from("source_observations")
    .update({
      status: resolved.alreadyKnown
        ? "processed"
        : createdCandidates.length > 0
          ? "needs_review"
          : "uploaded",
      notes:
        extraction.provider === "none"
          ? "Bild sparad. Kunde inte autoläsa — ta en tydligare bild."
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
  else if (createdCandidates.length === 0) ocrStatus = "failed";

  const confidence =
    candidate?.confidence ??
    (typeof extraction.rawMetadata?.confidence === "number"
      ? extraction.rawMetadata.confidence
      : null);

  // Very unclear receipt with an amount still allowed (user must confirm),
  // but SMS with critically low confidence should force a clearer photo.
  if (
    ocrStatus === "ok" &&
    resolved.kind === "bank_sms" &&
    confidence != null &&
    confidence < 0.55
  ) {
    ocrStatus = "failed";
  }

  const skippedOlderCount =
    (resolved.kind === "bank_sms" || resolved.kind === "bank_app") &&
    resolved.selection.status === "ready"
      ? resolved.selection.skippedDuplicateCount
      : 0;

  const events = createdCandidates
    .filter(
      (c) =>
        c.amountMinor != null &&
        c.fingerprint &&
        (c.direction === "debit" || c.direction === "credit"),
    )
    .map((c) => ({
      candidateId: c.id,
      direction: c.direction as "debit" | "credit",
      amountMinor: c.amountMinor!,
      balanceAfterMinor: c.balanceAfterMinor,
      fingerprint: c.fingerprint!,
      description: c.description ?? "",
      labelSv:
        typeof c.rawPayload?.labelSv === "string"
          ? c.rawPayload.labelSv
          : (c.description ?? ""),
    }));

  const visionMessage =
    typeof extraction.rawMetadata?.message === "string"
      ? extraction.rawMetadata.message
      : null;

  return {
    observation: refreshed,
    candidate,
    events,
    suggestedAmountMinor: resolved.suggestedAmountMinor,
    suggestedDescription: resolved.suggestedDescription,
    currency: resolved.currency ?? profile.primaryCurrency,
    ocrStatus,
    confidence,
    message:
      ocrStatus === "unavailable"
        ? "Autoläsning är inte konfigurerad (OPENAI_API_KEY saknas i miljön)."
        : ocrStatus === "failed"
          ? (visionMessage ??
            resolved.messageSv ??
            "Kunde inte läsa bilden — ta en skarpare skärmdump.")
          : resolved.messageSv,
    importKind:
      resolved.kind === "bank_sms"
        ? "bank_sms"
        : resolved.kind === "bank_app"
          ? "bank_app"
          : resolved.kind === "receipt_or_other"
            ? "receipt"
            : "unknown",
    balanceAfterMinor: resolved.balanceAfterMinor,
    fingerprint: resolved.fingerprint,
    alreadyKnown: resolved.alreadyKnown,
    skippedOlderCount,
    direction: resolved.direction,
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

  const supabase = await createSupabaseServerClient();
  const batchMode =
    input.confirmAllPending === true || observation.kind === "screenshot";

  if (batchMode) {
    const { data: allRows, error: allError } = await supabase
      .from("extracted_transaction_candidates")
      .select("*")
      .eq("user_id", userId)
      .eq("observation_id", input.observationId);
    if (allError) throw new Error(allError.message);

    const allCandidates = (allRows ?? []).map(mapCandidate);
    const pending = allCandidates
      .filter(
        (c) =>
          c.status === "needs_review" &&
          c.amountMinor != null &&
          c.amountMinor > 0 &&
          (c.direction === "credit" || c.direction === "debit") &&
          c.fingerprint,
      )
      .sort((a, b) => {
        const ai =
          typeof a.rawPayload?.batchIndex === "number"
            ? a.rawPayload.batchIndex
            : 0;
        const bi =
          typeof b.rawPayload?.batchIndex === "number"
            ? b.rawPayload.batchIndex
            : 0;
        return ai - bi;
      });

    const { data: linkedRows, error: linkedError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("source_observation_id", input.observationId)
      .neq("status", "voided")
      .order("occurred_at", { ascending: true });
    if (linkedError) throw new Error(linkedError.message);

    const decision = decideSmsBatchConfirm({
      pendingCandidateIds: pending.map((c) => c.id),
      confirmedCanonicalIds: allCandidates
        .filter((c) => c.status === "confirmed")
        .map((c) => c.canonicalTransactionId),
      linkedTransactionIds: (linkedRows ?? []).map((r) => r.id as string),
    });

    if (decision.action === "idempotent") {
      const existing =
        (linkedRows ?? []).find((r) => r.id === decision.existingTransactionId) ??
        (
          await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .eq("id", decision.existingTransactionId)
            .maybeSingle()
        ).data;
      if (existing) return mapTransaction(existing);
    }

    if (decision.action === "empty") {
      throw new Error("Inga bankrörelser att spara från den här bilden");
    }

    const payloadTip = pending
      .map((c) => c.rawPayload?.tipBalanceAfterMinor)
      .find((v): v is number => typeof v === "number");
    const updatesFlag = pending
      .map((c) => c.rawPayload?.updatesBalance)
      .find((v): v is boolean => typeof v === "boolean");
    const tipInBatch =
      updatesFlag === true ||
      (updatesFlag == null && input.balanceAfterMinor != null);
    const tipBalance = resolveSmsTipBalanceMinor({
      inputBalanceAfterMinor: input.balanceAfterMinor,
      payloadTipBalanceMinor: payloadTip ?? null,
      updatesBalance: tipInBatch,
    });

    const maskedFromCandidate =
      input.maskedAccount ?? observation.accountHint ?? null;
    const batchCurrency =
      (pending[0]?.currency as import("@/domain/money").CurrencyCode | null) ??
      "THB";
    const isBankAppBatch = pending.some(
      (c) => c.rawPayload?.importKind === "bank_app",
    );
    const institutionHint =
      typeof pending[0]?.rawPayload?.accountInstitution === "string"
        ? pending[0].rawPayload.accountInstitution
        : observation.institutionHint;

    const accountFromInput = input.accountId
      ? await getAccount(input.accountId)
      : null;
    // Bank-app EUR must not land on Hem's THB account just because UI passed it.
    let account =
      accountFromInput &&
      (!isBankAppBatch || accountFromInput.currency === batchCurrency)
        ? accountFromInput
        : isBankAppBatch
          ? await ensureAccountForCurrency({
              currency: batchCurrency,
              name:
                typeof pending[0]?.rawPayload?.accountName === "string"
                  ? pending[0].rawPayload.accountName
                  : institutionHint || "Bankapp",
              institution: institutionHint,
            })
          : await ensureDefaultBankAccount({
              maskedIdentifier: maskedFromCandidate,
              currency: "THB",
            });

    if (isBankAppBatch) {
      if (account.currency !== batchCurrency) {
        throw new Error(
          `Kontovaluta (${account.currency}) matchar inte importen (${batchCurrency})`,
        );
      }
    } else if (account.currency !== "THB") {
      throw new Error(
        "Bank-SMS är i THB — välj eller skapa ett THB-konto innan du sparar",
      );
    }

    const existingCheckpoint = await latestCheckpointForAccount(account.id);
    const hadCheckpoint = existingCheckpoint != null;
    if (!hadCheckpoint && tipBalance == null) {
      if (!(isBankAppBatch && account.currency !== "THB")) {
        throw new Error(
          isBankAppBatch
            ? "Första importen måste vara ett bank-SMS med saldo — bankapp-bilder fungerar efteråt."
            : "Första importen måste vara ett bank-SMS med saldo (available balance)",
        );
      }
    }

    // Secondary currency accounts (EUR): bootstrap before the oldest imported
    // occurredAt so OCR timestamps still affect calculated balance.
    if (
      isBankAppBatch &&
      !hadCheckpoint &&
      account.currency !== "THB" &&
      tipBalance == null
    ) {
      const earliestMs = pending.reduce((min, c) => {
        if (typeof c.occurredAt !== "string" || !c.occurredAt) return min;
        const t = Date.parse(c.occurredAt);
        return Number.isFinite(t) ? Math.min(min, t) : min;
      }, Date.now());
      await createCheckpoint({
        accountId: account.id,
        balanceMinor: 0,
        verifiedAt: new Date(earliestMs - 60_000).toISOString(),
        source: "bank_app_bootstrap",
        note: `Startsaldo 0 ${account.currency} — justera under Konton om du vet verkligt saldo`,
      });
    }

    const known = await listConfirmedFingerprints();
    const baseMs = Date.now();
    const chronological = [...pending].reverse();
    const fresh = chronological.filter((c) => !known.includes(c.fingerprint!));

    if (fresh.length === 0) {
      // Double-submit after fingerprints already landed — treat as idempotent.
      const lastLinked = (linkedRows ?? [])[(linkedRows ?? []).length - 1];
      if (lastLinked) {
        return mapTransaction(lastLinked);
      }
      throw new Error(swedishFingerprintConflictError());
    }

    const ledgerSource = isBankAppBatch ? "bank_import" : "screenshot";
    const tipInBatchEffective =
      tipInBatch && tipBalance != null && account.currency === "THB";

    const insertRows = fresh.map((cand, i) => {
      const direction = cand.direction as "debit" | "credit";
      const movedAt = resolveSmsBatchOccurredAt({
        candidateOccurredAt: cand.occurredAt,
        index: i,
        batchLength: fresh.length,
        baseMs,
        tipInBatch: tipInBatchEffective || isBankAppBatch,
      });
      return {
        id: crypto.randomUUID(),
        user_id: userId,
        account_id: account.id,
        direction,
        transaction_type: direction === "credit" ? "income" : "expense",
        amount_minor: cand.amountMinor!,
        currency: account.currency,
        occurred_at: movedAt,
        description:
          cand.description ||
          (direction === "credit"
            ? isBankAppBatch
              ? "Insättning (import)"
              : "Insättning (bank-SMS)"
            : isBankAppBatch
              ? "Utgift (import)"
              : "Utgift (bank-SMS)"),
        category: direction === "debit" ? (input.category ?? null) : null,
        source: ledgerSource,
        status: "confirmed",
        sync_status: "synced",
        source_observation_id: input.observationId,
        fingerprint: cand.fingerprint,
        balance_after_minor: cand.balanceAfterMinor,
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from("transactions")
      .insert(insertRows)
      .select("*");
    if (insertError) {
      if (isUniqueViolationMessage(insertError.message)) {
        throw new Error(swedishFingerprintConflictError());
      }
      throw new Error(insertError.message);
    }

    const byFingerprint = new Map(
      (inserted ?? []).map((row) => [row.fingerprint as string, row]),
    );
    const nowIso = new Date().toISOString();
    for (const cand of fresh) {
      const row = byFingerprint.get(cand.fingerprint!);
      if (!row) continue;
      const { error: candError } = await supabase
        .from("extracted_transaction_candidates")
        .update({
          status: "confirmed",
          canonical_transaction_id: row.id,
          updated_at: nowIso,
        })
        .eq("user_id", userId)
        .eq("id", cand.id);
      if (candError) throw new Error(candError.message);
    }

    if (
      shouldWriteSmsTipCheckpoint({
        tipBalanceMinor: tipBalance,
        tipInBatch: tipInBatchEffective,
      })
    ) {
      await createCheckpoint({
        accountId: account.id,
        balanceMinor: tipBalance!,
        verifiedAt: new Date(baseMs).toISOString(),
        source: hadCheckpoint ? "sms_import" : "sms_bootstrap",
        note: hadCheckpoint
          ? "Saldo från Bangkok Bank SMS"
          : "Första saldo från Bangkok Bank SMS",
      });
    }

    await supabase
      .from("source_observations")
      .update({
        status: "processed",
        notes:
          fresh.length > 1
            ? `${fresh.length} rörelser sparade`
            : hadCheckpoint || isBankAppBatch
              ? "Bekräftad och sparad"
              : "Första SMS — saldo och rörelse sparade",
        updated_at: nowIso,
      })
      .eq("user_id", userId)
      .eq("id", input.observationId);

    const lastRow = (inserted ?? [])[(inserted ?? []).length - 1];
    if (!lastRow) throw new Error("Kunde inte spara importen");
    const lastTx = mapTransaction(lastRow);
    return {
      ...lastTx,
      balanceAfterMinor: tipBalance ?? lastTx.balanceAfterMinor,
    };
  }

  let fingerprint = input.fingerprint ?? null;
  let balanceAfterMinor = input.balanceAfterMinor ?? null;
  let source: TransactionSource = input.source ?? "receipt_camera";
  let maskedFromCandidate: string | null = input.maskedAccount ?? null;
  let direction: "debit" | "credit" = "debit";
  let amountMinor = input.amountMinor;
  let description = input.description;

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
    if (cand.canonical_transaction_id) {
      const { data: existing } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("id", cand.canonical_transaction_id)
        .neq("status", "voided")
        .maybeSingle();
      if (existing) return mapTransaction(existing);
    }
    fingerprint = (cand.fingerprint as string | null) ?? fingerprint;
    balanceAfterMinor =
      (cand.balance_after_minor as number | null) ?? balanceAfterMinor;
    amountMinor = cand.amount_minor as number;
    // Receipt camera: prefer the amount/description the user confirmed in the UI.
    const isReceiptConfirm =
      input.source === "receipt_camera" || observation.kind === "receipt";
    if (isReceiptConfirm && input.amountMinor != null && input.amountMinor > 0) {
      amountMinor = input.amountMinor;
    }
    if (amountMinor == null || amountMinor <= 0) {
      throw new Error("Kandidaten saknar giltigt belopp");
    }
    if (cand.direction === "credit" || cand.direction === "debit") {
      direction = cand.direction;
    }
    if (isReceiptConfirm && input.description?.trim()) {
      description = input.description.trim();
    } else if (typeof cand.description === "string" && cand.description) {
      description = cand.description;
    }
    if (observation.kind === "screenshot") source = "screenshot";
  } else if (input.direction === "credit" || input.direction === "debit") {
    direction = input.direction;
  }

  if (amountMinor == null || amountMinor <= 0) {
    throw new Error("Ange ett belopp större än noll");
  }

  if (fingerprint) {
    const known = await listConfirmedFingerprints();
    if (known.includes(fingerprint)) {
      throw new Error(swedishFingerprintConflictError());
    }
  }

  maskedFromCandidate =
    maskedFromCandidate ?? observation.accountHint ?? null;

  let account =
    (input.accountId ? await getAccount(input.accountId) : null) ?? null;
  if (source === "screenshot" && account && account.currency !== "THB") {
    throw new Error(
      "Bank-SMS är i THB — välj eller skapa ett THB-konto innan du sparar",
    );
  }
  account =
    account ??
    (await ensureDefaultBankAccount({
      maskedIdentifier: maskedFromCandidate,
      currency: source === "screenshot" ? "THB" : undefined,
    }));
  if (source === "screenshot" && account.currency !== "THB") {
    throw new Error(
      "Bank-SMS är i THB — välj eller skapa ett THB-konto innan du sparar",
    );
  }

  const existingCheckpoint = await latestCheckpointForAccount(account.id);
  const hadCheckpoint = existingCheckpoint != null;
  if (!hadCheckpoint && balanceAfterMinor == null && source === "screenshot") {
    throw new Error(
      "Första importen måste vara ett bank-SMS med saldo (available balance)",
    );
  }

  // Bank-SMS requires saldo; bank-app / receipt-with-fingerprint may omit it
  // once Hem already has a verified balance.
  if (
    source === "screenshot" &&
    (!fingerprint || (balanceAfterMinor == null && !hadCheckpoint))
  ) {
    throw new Error(
      "Bank-SMS saknar komplett belopp/saldo — ta en tydligare bild.",
    );
  }

  const baseMs = Date.now();
  const movedAt = new Date(baseMs - 2_000).toISOString();
  const checkpointAt = new Date(baseMs).toISOString();

  const tx =
    direction === "credit"
      ? await createManualIncome({
          accountId: account.id,
          amountMinor,
          description: description || "Insättning (import)",
          source,
          sourceObservationId: input.observationId,
          fingerprint,
          balanceAfterMinor,
          occurredAt: movedAt,
        })
      : await createManualExpense({
          accountId: account.id,
          amountMinor,
          description,
          category: input.category,
          source,
          sourceObservationId: input.observationId,
          fingerprint,
          balanceAfterMinor,
          occurredAt: movedAt,
        });

  // Receipt OCR must not mint sms_* tip checkpoints — only bank-SMS with saldo.
  if (source === "screenshot" && balanceAfterMinor != null) {
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
        amount_minor: amountMinor,
        direction,
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
      notes:
        source === "receipt_camera"
          ? "Bekräftad och sparad som utgift"
          : hadCheckpoint
            ? "Bekräftad och sparad"
            : "Första SMS — saldo och rörelse sparade",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", input.observationId);

  return tx;
}
