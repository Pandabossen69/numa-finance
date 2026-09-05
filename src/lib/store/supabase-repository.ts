import {
  accountTypeForKind,
  assertAccountAcceptsWrites,
  assertCurrencyAllowedForKind,
  evaluateArchiveAccount,
  evaluateCurrencyChange,
  evaluateDeleteAccount,
  evaluateKindChange,
  evaluateRestoreAccount,
  requireLifecycle,
  NEXT_INCOME_NAME,
  resolveSmsTipBalanceMinor,
  shouldWriteSmsTipCheckpoint,
  startOfZonedDay,
  decideSmsBatchConfirm,
  isUniqueViolationMessage,
  swedishFingerprintConflictError,
  collectPairedVoidIds,
  resolveSmsBatchOccurredAt,
  zonedDayKey,
  type Account,
  type AccountKind,
  type BalanceCheckpoint,
  type CanonicalTransaction,
  type ExtractedTransactionCandidate,
  type PlanCategoryKind,
  type PlanItem,
  type Profile,
  type SourceObservation,
  type TransactionSource,
} from "@/domain/finance";
import { type CurrencyCode } from "@/domain/money";
import { createExtractionProvider, resolveScreenshotImport } from "@/domain/imports";
import { rankForOnTrackDays } from "@/domain/gamification";
import { getAuthUser } from "@/lib/supabase/auth-user";
import {
  ACCOUNT_SELECT,
  CHECKPOINT_SELECT,
  LEDGER_TRANSACTION_SELECT,
  PLAN_ITEM_SELECT,
  PROFILE_SELECT,
  numaSelect,
} from "@/lib/supabase/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accountLifecycleFacts } from "./account-lifecycle-store";
import { inferAccountKind } from "./account-kind-infer";
import { resolveCheckpointFx } from "./checkpoint-fx";
import { fetchMenuSnapshotBundle } from "./menu-snapshot-fetch";
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
import { assertUserOwnsStoragePath, buildUserStoragePath } from "./isolation";
import type { ConfirmReceiptInput, ReceiptUploadResult } from "./receipt-types";
import type { TodaySnapshot } from "./types-snapshot";
import { assembleTodaySnapshot } from "./assemble-today-snapshot";
import type { AtomicLinkResult, AtomicSettleResult } from "./settle-atomic";
import { fxFieldsForWrite, recomputeThbFromLockedRate } from "./transaction-fx";
import { emptyUserProgress, type UserProgress } from "./types-progress";

import { cache } from "react";
import {
  isPlaceholderDisplayName,
  resolveProfileDisplayName,
} from "@/domain/identity/display-name";
import type { AuthUser } from "@/lib/supabase/auth-user";

/** One auth lookup per request — shared with layout / onboarding getSessionUser. */
const requireAuthUser = cache(async (): Promise<AuthUser> => {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Du måste vara inloggad");
  }
  return user;
});

const requireUserId = cache(async (): Promise<string> => {
  return (await requireAuthUser()).id;
});

async function ensureProfile(): Promise<Profile> {
  const { id: userId, email, metadataDisplayName } = await requireAuthUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(numaSelect(PROFILE_SELECT))
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) {
    const mapped = mapProfile(data);
    const resolved = resolveProfileDisplayName({
      stored: mapped.displayName,
      email,
      authMetaName: metadataDisplayName,
    });
    if (
      isPlaceholderDisplayName(mapped.displayName) &&
      resolved !== mapped.displayName
    ) {
      await supabase
        .from("profiles")
        .update({ display_name: resolved })
        .eq("id", userId);
      return { ...mapped, displayName: resolved };
    }
    return mapped;
  }

  const resolved = resolveProfileDisplayName({
    stored: null,
    email,
    authMetaName: metadataDisplayName,
  });
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      display_name: resolved,
      timezone: "Asia/Bangkok",
      primary_currency: "THB",
      reference_currency: "SEK",
    })
    .select(numaSelect(PROFILE_SELECT))
    .single();

  if (insertError) throw new Error(insertError.message);
  return mapProfile(created);
}

export const getProfile = cache(async (): Promise<Profile> => {
  return ensureProfile();
});

export async function stampOnboardingSaldoAt(): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_saldo_at: now,
      updated_at: now,
    })
    .eq("id", userId)
    .is("onboarding_saldo_at", null);
  if (error) throw new Error(error.message);
}

export async function stampOnboardingCompletedAt(): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed_at: now,
      updated_at: now,
    })
    .eq("id", userId)
    .is("onboarding_completed_at", null);
  if (error) throw new Error(error.message);
}

export async function stampGettingStartedCompletedAt(): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      getting_started_completed_at: now,
      getting_started_collapsed: false,
      updated_at: now,
    })
    .eq("id", userId)
    .is("getting_started_completed_at", null);
  if (error) throw new Error(error.message);
}

export async function setGettingStartedCollapsed(collapsed: boolean): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      getting_started_collapsed: collapsed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export const listAccounts = cache(async (): Promise<Account[]> => {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(numaSelect(ACCOUNT_SELECT))
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAccount);
});

export async function getAccount(accountId: string): Promise<Account | null> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(numaSelect(ACCOUNT_SELECT))
    .eq("user_id", userId)
    .eq("id", accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapAccount(data) : null;
}

export const listArchivedAccounts = cache(async (): Promise<Account[]> => {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(numaSelect(ACCOUNT_SELECT))
    .eq("user_id", userId)
    .eq("is_active", false)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAccount);
});

async function remoteLifecycleFacts(account: Account) {
  const userId = await requireUserId();
  const [active, transactions, checkpoint] = await Promise.all([
    listAccounts(),
    listTransactions(account.id),
    latestCheckpointForAccount(account.id),
  ]);
  return accountLifecycleFacts({
    account,
    actorUserId: userId,
    activeCount: active.length,
    transactions,
    checkpoint,
  });
}

export async function updateAccount(input: {
  id: string;
  name?: string;
  kind?: AccountKind;
  currency?: CurrencyCode;
  makeDefault?: boolean;
}): Promise<Account> {
  const userId = await requireUserId();
  const account = await getAccount(input.id);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(account));
  const facts = await remoteLifecycleFacts(account);

  const nextKind = input.kind ?? account.kind;
  const nextCurrency = input.currency ?? account.currency;
  if (input.kind != null && input.kind !== account.kind) {
    requireLifecycle(evaluateKindChange(facts, input.kind, nextCurrency));
  }
  if (input.currency != null && input.currency !== account.currency) {
    requireLifecycle(evaluateCurrencyChange(facts, nextKind, input.currency));
  }
  if (input.makeDefault === false && account.isDefault) {
    throw new Error(
      "Välj ett annat förvalt konto först. Förvalt konto kan inte lämnas utan ersättare.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (input.makeDefault) {
    const { error: clearError } = await supabase
      .from("accounts")
      .update({ is_default: false, updated_at: now })
      .eq("user_id", userId)
      .eq("is_default", true);
    if (clearError) throw new Error(clearError.message);
  }

  const patch: Record<string, unknown> = { updated_at: now };
  if (input.name != null) patch.name = input.name.trim();
  if (input.kind != null) {
    patch.kind = input.kind;
    patch.account_type = accountTypeForKind(input.kind, account.accountType);
  }
  if (input.currency != null) patch.currency = input.currency;
  if (input.makeDefault) patch.is_default = true;

  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", input.id)
    .select(numaSelect(ACCOUNT_SELECT))
    .single();
  if (error) throw new Error(error.message);

  if (input.currency != null && input.currency !== account.currency) {
    const latest = await latestCheckpointForAccount(input.id);
    if (latest) {
      const { error: cpError } = await supabase
        .from("balance_checkpoints")
        .update({
          currency: input.currency,
          thb_minor: input.currency === "THB" ? latest.balanceMinor : null,
          fx_rate: input.currency === "THB" ? 1 : null,
          fx_source: input.currency === "THB" ? "identity" : null,
        })
        .eq("user_id", userId)
        .eq("id", latest.id);
      if (cpError) throw new Error(cpError.message);
    }
  }

  return mapAccount(data);
}

export async function deleteAccount(id: string): Promise<void> {
  const userId = await requireUserId();
  const account = await getAccount(id);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(evaluateDeleteAccount(await remoteLifecycleFacts(account)));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function archiveAccount(id: string): Promise<Account> {
  const userId = await requireUserId();
  const account = await getAccount(id);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(evaluateArchiveAccount(await remoteLifecycleFacts(account)));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({
      is_active: false,
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select(numaSelect(ACCOUNT_SELECT))
    .single();
  if (error) throw new Error(error.message);
  return mapAccount(data);
}

export async function restoreAccount(id: string): Promise<Account> {
  const userId = await requireUserId();
  const account = await getAccount(id);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(evaluateRestoreAccount(await remoteLifecycleFacts(account)));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select(numaSelect(ACCOUNT_SELECT))
    .single();
  if (error) throw new Error(error.message);
  return mapAccount(data);
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
        existing.find((a) => a.currency === wantedCurrency && a.accountType !== "cash") ??
        existing.find((a) => a.currency === wantedCurrency) ??
        null;
      if (matching) {
        return matching;
      }
      return createAccount({
        name: wantedCurrency === "THB" ? "Bangkok Bank" : "Bankkonto",
        institution: wantedCurrency === "THB" ? "Bangkok Bank" : null,
        accountType: "checking",
        kind: wantedCurrency === "THB" ? "thai_bank" : "other",
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
    name: wantedCurrency === "THB" ? "Bangkok Bank" : "Bankkonto",
    institution: wantedCurrency === "THB" ? "Bangkok Bank" : null,
    accountType: "checking",
    kind: wantedCurrency === "THB" ? "thai_bank" : "other",
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
  kind?: AccountKind;
  currency: CurrencyCode;
  maskedIdentifier?: string | null;
  makeDefault?: boolean;
}): Promise<Account> {
  const userId = await requireUserId();
  await ensureProfile();
  const supabase = await createSupabaseServerClient();

  const kind = inferAccountKind({
    kind: input.kind,
    accountType: input.accountType,
    currency: input.currency,
    name: input.name,
    institution: input.institution,
  });
  assertCurrencyAllowedForKind(kind, input.currency);

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
      kind,
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
  fxRate?: number | null;
  fxAsOf?: string | null;
  fxSource?: string | null;
  requireFx?: boolean;
}): Promise<BalanceCheckpoint> {
  const userId = await requireUserId();
  const account = await getAccount(input.accountId);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(account));

  const fx = await resolveCheckpointFx({
    currency: account.currency,
    balanceMinor: input.balanceMinor,
    fxRate: input.fxRate,
    fxAsOf: input.fxAsOf,
    fxSource: input.fxSource,
    required: input.requireFx,
  });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("balance_checkpoints")
    .insert({
      user_id: userId,
      account_id: input.accountId,
      balance_minor: input.balanceMinor,
      currency: account.currency,
      thb_minor: fx?.thbMinor ?? null,
      fx_rate: fx?.fxRate ?? null,
      fx_as_of: fx?.fxAsOf ?? null,
      fx_source: fx?.fxSource ?? null,
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
  planItemId?: string | null;
  ledgerOrigin?: CanonicalTransaction["ledgerOrigin"];
  linkedPlanItemId?: string | null;
  clientMutationId?: string | null;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }

  const userId = await requireUserId();
  if (input.clientMutationId) {
    const existing = await findTransactionByMutationId(input.clientMutationId);
    if (existing) return existing;
  }
  const account = await getAccount(input.accountId);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(account));

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

  const ts = new Date().toISOString();
  const checkpoint = await latestCheckpointForAccount(input.accountId);
  const fx = fxFieldsForWrite({
    nativeMinor: input.amountMinor,
    currency: account.currency,
    checkpoint,
    nowIso: ts,
  });
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: input.accountId,
      direction: "debit",
      transaction_type: "expense",
      amount_minor: input.amountMinor,
      currency: account.currency,
      thb_minor: fx.thbMinor,
      fx_rate: fx.fxRate,
      fx_as_of: fx.fxAsOf,
      fx_source: fx.fxSource,
      client_mutation_id: input.clientMutationId ?? null,
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
      plan_item_id: input.planItemId ?? null,
      ledger_origin:
        input.ledgerOrigin ?? (input.planItemId ? "plan_settle" : "external"),
      linked_plan_item_id: input.linkedPlanItemId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (input.clientMutationId && isUniqueViolationMessage(error.message)) {
      const existing = await findTransactionByMutationId(input.clientMutationId);
      if (existing) return existing;
    }
    if (isUniqueViolationMessage(error.message) && input.fingerprint) {
      throw new Error(swedishFingerprintConflictError());
    }
    throw new Error(error.message);
  }
  return mapTransaction(data);
}

async function findTransactionByMutationId(
  clientMutationId: string,
): Promise<CanonicalTransaction | null> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("client_mutation_id", clientMutationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapTransaction(data) : null;
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
  planItemId?: string | null;
  ledgerOrigin?: CanonicalTransaction["ledgerOrigin"];
  linkedPlanItemId?: string | null;
  clientMutationId?: string | null;
}): Promise<CanonicalTransaction> {
  if (input.amountMinor <= 0) {
    throw new Error("Beloppet måste vara större än noll");
  }
  const userId = await requireUserId();
  if (input.clientMutationId) {
    const existing = await findTransactionByMutationId(input.clientMutationId);
    if (existing) return existing;
  }
  const account = await getAccount(input.accountId);
  if (!account) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(account));

  if (input.fingerprint) {
    const known = await listConfirmedFingerprints();
    if (known.includes(input.fingerprint)) {
      throw new Error(swedishFingerprintConflictError());
    }
  }

  const supabase = await createSupabaseServerClient();
  const ts = new Date().toISOString();
  const checkpoint = await latestCheckpointForAccount(input.accountId);
  const fx = fxFieldsForWrite({
    nativeMinor: input.amountMinor,
    currency: account.currency,
    checkpoint,
    nowIso: ts,
  });
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: input.accountId,
      direction: "credit",
      transaction_type: "income",
      amount_minor: input.amountMinor,
      currency: account.currency,
      thb_minor: fx.thbMinor,
      fx_rate: fx.fxRate,
      fx_as_of: fx.fxAsOf,
      fx_source: fx.fxSource,
      client_mutation_id: input.clientMutationId ?? null,
      occurred_at: input.occurredAt ?? ts,
      description: input.description?.trim() || "Insättning",
      source: input.source ?? "manual",
      status: "confirmed",
      sync_status: "synced",
      fingerprint: input.fingerprint ?? null,
      balance_after_minor: input.balanceAfterMinor ?? null,
      source_observation_id: input.sourceObservationId ?? null,
      plan_item_id: input.planItemId ?? null,
      ledger_origin:
        input.ledgerOrigin ?? (input.planItemId ? "plan_settle" : "external"),
      linked_plan_item_id: input.linkedPlanItemId ?? null,
    })
    .select("*")
    .single();
  if (error) {
    if (input.clientMutationId && isUniqueViolationMessage(error.message)) {
      const existing = await findTransactionByMutationId(input.clientMutationId);
      if (existing) return existing;
    }
    if (isUniqueViolationMessage(error.message) && input.fingerprint) {
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
  requireLifecycle(assertAccountAcceptsWrites(from));
  requireLifecycle(assertAccountAcceptsWrites(to));
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
  const checkpoint = await latestCheckpointForAccount(from.id);
  const fx = fxFieldsForWrite({
    nativeMinor: input.amountMinor,
    currency: from.currency,
    checkpoint,
    nowIso: ts,
  });

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
        thb_minor: fx.thbMinor,
        fx_rate: fx.fxRate,
        fx_as_of: fx.fxAsOf,
        fx_source: fx.fxSource,
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
        thb_minor: fx.thbMinor,
        fx_rate: fx.fxRate,
        fx_as_of: fx.fxAsOf,
        fx_source: fx.fxSource,
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
    throw new Error("Välj ett kontantkonto — annars försvinner pengarna i modellen");
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("Välj två olika konton");
  }

  const userId = await requireUserId();
  const from = await getAccount(input.fromAccountId);
  if (!from) throw new Error("Kontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(from));
  const to = await getAccount(input.toAccountId);
  if (!to) throw new Error("Kontantkontot hittades inte");
  requireLifecycle(assertAccountAcceptsWrites(to));
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
  const checkpoint = await latestCheckpointForAccount(from.id);
  const fx = fxFieldsForWrite({
    nativeMinor: input.amountMinor,
    currency: from.currency,
    checkpoint,
    nowIso: ts,
  });

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
        thb_minor: fx.thbMinor,
        fx_rate: fx.fxRate,
        fx_as_of: fx.fxAsOf,
        fx_source: fx.fxSource,
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
        thb_minor: fx.thbMinor,
        fx_rate: fx.fxRate,
        fx_as_of: fx.fxAsOf,
        fx_source: fx.fxSource,
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
    .select(numaSelect(LEDGER_TRANSACTION_SELECT))
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

export async function listTransactionsByPlanItemId(
  planItemId: string,
): Promise<CanonicalTransaction[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(numaSelect(LEDGER_TRANSACTION_SELECT))
    .eq("user_id", userId)
    .eq("plan_item_id", planItemId)
    .neq("status", "voided")
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTransaction);
}

export async function listConfirmedPlanSettleLedgers(): Promise<
  CanonicalTransaction[]
> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(numaSelect(LEDGER_TRANSACTION_SELECT))
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .not("plan_item_id", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTransaction);
}

export async function updateTransaction(input: {
  id: string;
  amountMinor?: number;
  description?: string;
  category?: string | null;
  occurredAt?: string;
}): Promise<CanonicalTransaction> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    updated_at: nowIso,
  };
  if (input.amountMinor != null) {
    if (input.amountMinor <= 0) {
      throw new Error("Beloppet måste vara större än noll");
    }
    const { data: current, error: readError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("id", input.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) throw new Error("Rörelsen hittades inte");
    const existing = mapTransaction(current);
    const fx = recomputeThbFromLockedRate({
      nativeMinor: input.amountMinor,
      currency: existing.currency,
      fxRate: existing.fxRate,
      nowIso,
    });
    patch.amount_minor = input.amountMinor;
    patch.thb_minor = fx.thbMinor;
    patch.fx_rate = fx.fxRate;
    patch.fx_as_of = fx.fxAsOf;
    patch.fx_source = fx.fxSource;
  }
  if (input.description != null) {
    patch.description = input.description.trim() || "Utgift";
  }
  if (input.category !== undefined) patch.category = input.category;
  if (input.occurredAt != null) patch.occurred_at = input.occurredAt;

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

const MEDIA_BUCKET = "numa-source-media";

export async function deleteObservation(observationId: string): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_observations")
    .select("id, storage_path")
    .eq("user_id", userId)
    .eq("id", observationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Importen hittades inte");
  if (data.storage_path) {
    await supabase.storage.from(MEDIA_BUCKET).remove([data.storage_path]);
  }
  const { error: delError } = await supabase
    .from("source_observations")
    .delete()
    .eq("user_id", userId)
    .eq("id", observationId);
  if (delError) throw new Error(delError.message);
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

export async function listObservationCandidates(
  observationId: string,
): Promise<ExtractedTransactionCandidate[]> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("extracted_transaction_candidates")
    .select("*")
    .eq("user_id", userId)
    .eq("observation_id", observationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCandidate);
}

export async function getObservationMediaUrl(
  storagePath: string,
): Promise<string | null> {
  const userId = await requireUserId();
  assertUserOwnsStoragePath(userId, storagePath);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 15);
  if (error || !data?.signedUrl) {
    console.warn("[numa] signed media url failed", error?.message);
    return null;
  }
  return data.signedUrl;
}

export async function latestCheckpointForAccount(
  accountId: string,
): Promise<BalanceCheckpoint | null> {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("balance_checkpoints")
    .select(numaSelect(CHECKPOINT_SELECT))
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapCheckpoint(data) : null;
}

export const listPlanItems = cache(async (): Promise<PlanItem[]> => {
  const userId = await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("plan_items")
    .select(numaSelect(PLAN_ITEM_SELECT))
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPlanItem);
});

function itemFromSaveRpc(data: unknown): PlanItem {
  const payload = data as { item?: Parameters<typeof mapPlanItem>[0] } | null;
  if (!payload?.item) throw new Error("Kunde inte spara planposten");
  return mapPlanItem(payload.item);
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
  await requireUserId();
  await ensureProfile();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_plan_item", {
    p_id: null,
    p_name: input.name.trim(),
    p_kind: input.kind,
    p_amount_minor: input.amountMinor,
    p_currency: input.currency,
    p_cadence: input.cadence ?? "monthly",
    p_next_due_at: input.nextDueAt ?? null,
    p_is_active: true,
    p_settled_at: null,
    p_settled_minor: null,
    p_remaining_due_at: null,
    p_sync_ledger: true,
  });
  if (error) throw new Error(error.message);
  return itemFromSaveRpc(data);
}

export async function updatePlanItem(input: {
  id: string;
  name?: string;
  kind?: PlanCategoryKind;
  amountMinor?: number;
  nextDueAt?: string | null;
  isActive?: boolean;
  settledAt?: string | null;
  settledMinor?: number | null;
  remainingDueAt?: string | null;
}): Promise<PlanItem> {
  if (input.amountMinor != null && input.amountMinor < 0) {
    throw new Error("Belopp kan inte vara negativt");
  }
  await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_plan_item", {
    p_id: input.id,
    p_name: input.name?.trim() ?? null,
    p_kind: input.kind ?? null,
    p_amount_minor: input.amountMinor ?? null,
    p_currency: null,
    p_cadence: null,
    p_next_due_at: input.nextDueAt ?? null,
    p_is_active: input.isActive ?? null,
    p_settled_at: input.settledAt ?? null,
    p_settled_minor: input.settledMinor ?? null,
    p_remaining_due_at: input.remainingDueAt ?? null,
    p_sync_ledger: true,
  });
  if (error) throw new Error(error.message);
  return itemFromSaveRpc(data);
}

export async function settlePlanItemAtomic(input: {
  itemId: string;
  settled: boolean;
  targetSettledMinor?: number | null;
  remainingDueAt?: string | null;
  accountId?: string | null;
  clientMutationId?: string | null;
}): Promise<AtomicSettleResult> {
  const supabase = await createSupabaseServerClient();
  // One RPC — Postgres rolls back if the flag write or ledger booking fails.
  const { data, error } = await supabase.rpc("settle_plan_item", {
    p_item_id: input.itemId,
    p_settled: input.settled,
    p_target_settled_minor: input.targetSettledMinor ?? null,
    p_remaining_due_at: input.remainingDueAt ?? null,
    p_account_id: input.accountId ?? null,
    p_client_mutation_id: input.clientMutationId ?? null,
  });
  if (error) throw new Error(error.message);
  const payload = data as {
    ok?: boolean;
    idempotent?: boolean;
    item?: Parameters<typeof mapPlanItem>[0];
    booked_minor?: number;
    booked_native_minor?: number;
    booked_canonical_minor?: number;
    saldo_delta?: number;
    saldo_delta_native?: number;
    account_id?: string | null;
    skipped_because_funded?: boolean;
  } | null;
  if (!payload?.item) throw new Error("Kunde inte uppdatera Klar");
  const bookedCanonical = Number(
    payload.booked_canonical_minor ?? payload.booked_minor ?? 0,
  );
  return {
    item: mapPlanItem(payload.item),
    bookedMinor: bookedCanonical,
    bookedNativeMinor: Number(payload.booked_native_minor ?? bookedCanonical),
    bookedCanonicalMinor: bookedCanonical,
    saldoDeltaMinor: Number(payload.saldo_delta ?? 0),
    nativeSaldoDeltaMinor: Number(
      payload.saldo_delta_native ?? payload.saldo_delta ?? 0,
    ),
    accountId: payload.account_id ?? null,
    skippedBecauseFunded: Boolean(payload.skipped_because_funded),
    idempotent: Boolean(payload.idempotent),
  };
}

export async function linkTransactionToPlanItem(input: {
  transactionId: string;
  itemId: string;
  clientMutationId?: string | null;
}): Promise<AtomicLinkResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("link_transaction_to_plan_item", {
    p_transaction_id: input.transactionId,
    p_item_id: input.itemId,
    p_client_mutation_id: input.clientMutationId ?? null,
  });
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("wrong direction")) {
      throw new Error("Rörelsen går åt fel håll för den här planposten");
    }
    if (message.includes("wrong currency")) {
      throw new Error("Rörelsen är i en annan valuta än planposten");
    }
    if (message.includes("over allocation")) {
      throw new Error("Beloppet är större än det som är kvar att koppla");
    }
    throw new Error(error.message);
  }
  const payload = data as {
    item?: Parameters<typeof mapPlanItem>[0];
    transaction_id?: string;
    allocated_canonical_minor?: number;
    idempotent?: boolean;
  } | null;
  if (!payload?.item || !payload.transaction_id) {
    throw new Error("Kunde inte koppla transaktionen");
  }
  return {
    item: mapPlanItem(payload.item),
    transactionId: payload.transaction_id,
    allocatedCanonicalMinor: Number(payload.allocated_canonical_minor ?? 0),
    idempotent: Boolean(payload.idempotent),
  };
}

export async function deletePlanItem(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_plan_item", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function purgeExpiredObservations(input?: {
  now?: Date;
  retentionDays?: number;
}): Promise<{ purged: number }> {
  const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/admin");
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase.rpc("purge_expired_source_images", {
    p_now: (input?.now ?? new Date()).toISOString(),
    p_retention_days: input?.retentionDays ?? 30,
  });
  if (error) throw new Error(error.message);
  const payload = data as { purged?: number } | null;
  return { purged: Number(payload?.purged ?? 0) };
}

export async function setNextIncomeDate(isoDate: string): Promise<PlanItem> {
  const items = await listPlanItems();
  const existing = items.find((p) => p.name === NEXT_INCOME_NAME);
  const profile = await getProfile();
  const accounts = await listAccounts();
  const currency = accounts.find((a) => a.isDefault)?.currency ?? profile.primaryCurrency;
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

async function loadTodaySnapshotUncached(): Promise<TodaySnapshot> {
  const bundle = await fetchMenuSnapshotBundle({
    loadProfile: getProfile,
    loadAccounts: listAccounts,
    // Fail closed: a Plan read error must NOT become "empty plan" / 0 obligations.
    loadPlanItems: listPlanItems,
    loadCheckpoint: latestCheckpointForAccount,
    loadTransactions: (options) =>
      listTransactions(options.accountId, {
        sinceIso: options.sinceIso,
      }),
  });
  return assembleTodaySnapshot({
    profile: bundle.profile,
    accounts: bundle.accounts,
    planItems: bundle.planItems,
    primary: bundle.primary,
    checkpoint: bundle.checkpoint,
    checkpoints: bundle.checkpoints,
    transactions: bundle.transactions,
  });
}

/** Fresh read after a mutation — bypasses the request-scoped React cache. */
export async function refreshTodaySnapshot(): Promise<TodaySnapshot> {
  return loadTodaySnapshotUncached();
}

export const getTodaySnapshot = cache(loadTodaySnapshotUncached);

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
  await ensureProfile();
  const supabase = await createSupabaseServerClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: rateError } = await supabase
    .from("source_observations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", hourAgo);
  if (rateError) throw new Error(rateError.message);
  if ((count ?? 0) >= 20) {
    throw new Error("För många bilder den här timmen. Försök igen senare.");
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: orphans } = await supabase
    .from("source_observations")
    .select("id, storage_path")
    .eq("user_id", userId)
    .in("status", ["uploaded", "extracting"])
    .lt("created_at", dayAgo);
  if (orphans && orphans.length > 0) {
    const paths = orphans
      .map((row) => row.storage_path as string | null)
      .filter((path): path is string => Boolean(path));
    if (paths.length > 0) {
      await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    }
    await supabase
      .from("source_observations")
      .delete()
      .in(
        "id",
        orphans.map((row) => row.id as string),
      );
  }
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
    !hasBatch && resolved.suggestedAmountMinor != null && !resolved.alreadyKnown;

  if (hasBatch) {
    await supersedePendingCandidatesByFingerprints(
      batch.map((e) => e.fingerprint?.fingerprint).filter((f): f is string => Boolean(f)),
    );
  } else if (hasSingle && resolved.fingerprint) {
    await supersedePendingCandidatesByFingerprints([resolved.fingerprint]);
  }

  const institutionForObs =
    resolved.kind === "bank_sms"
      ? "Bangkok Bank"
      : resolved.kind === "bank_app"
        ? (resolved.selected?.institution ?? batch[0]?.institution ?? "bank_app")
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
            (batch[0] && "maskedAccount" in batch[0] ? batch[0].maskedAccount : null) ??
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
      if (event.amountMinor == null || !event.direction || !event.fingerprint) {
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
              resolved.kind === "bank_sms" && resolved.balanceAfterMinor != null,
            merchant:
              "merchant" in event && typeof event.merchant === "string"
                ? event.merchant
                : null,
            accountInstitution: "institution" in event ? String(event.institution) : null,
            accountName:
              "institution" in event
                ? event.institution === "bunq"
                  ? "bunq"
                  : event.institution === "revolut"
                    ? "Revolut"
                    : "Bankapp"
                : null,
            annotationSv:
              "annotationSv" in event && typeof event.annotationSv === "string"
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
          suggestedAmountMinor: resolved.suggestedAmountMinor,
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
  if (input.clientMutationId) {
    const existing = await findTransactionByMutationId(input.clientMutationId);
    if (existing) return existing;
  }
  const observation = await getObservation(input.observationId);
  if (!observation || observation.userId !== userId) {
    throw new Error("Importen hittades inte");
  }
  if (observation.status === "processed") {
    const supabaseExisting = await createSupabaseServerClient();
    const { data: existingRow } = await supabaseExisting
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("source_observation_id", input.observationId)
      .neq("status", "voided")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRow) return mapTransaction(existingRow);
  }

  const supabase = await createSupabaseServerClient();
  const batchMode = input.confirmAllPending === true || observation.kind === "screenshot";

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
          typeof a.rawPayload?.batchIndex === "number" ? a.rawPayload.batchIndex : 0;
        const bi =
          typeof b.rawPayload?.batchIndex === "number" ? b.rawPayload.batchIndex : 0;
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
      updatesFlag === true || (updatesFlag == null && input.balanceAfterMinor != null);
    const tipBalance = resolveSmsTipBalanceMinor({
      inputBalanceAfterMinor: input.balanceAfterMinor,
      payloadTipBalanceMinor: payloadTip ?? null,
      updatesBalance: tipInBatch,
    });

    const maskedFromCandidate = input.maskedAccount ?? observation.accountHint ?? null;
    const batchCurrency =
      (pending[0]?.currency as import("@/domain/money").CurrencyCode | null) ?? "THB";
    const isBankAppBatch = pending.some((c) => c.rawPayload?.importKind === "bank_app");
    const institutionHint =
      typeof pending[0]?.rawPayload?.accountInstitution === "string"
        ? pending[0].rawPayload.accountInstitution
        : observation.institutionHint;

    const accountFromInput = input.accountId ? await getAccount(input.accountId) : null;
    // Bank-app EUR must not land on Hem's THB account just because UI passed it.
    const account =
      accountFromInput && (!isBankAppBatch || accountFromInput.currency === batchCurrency)
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
        requireFx: false,
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
    balanceAfterMinor = (cand.balance_after_minor as number | null) ?? balanceAfterMinor;
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

  maskedFromCandidate = maskedFromCandidate ?? observation.accountHint ?? null;

  let account = (input.accountId ? await getAccount(input.accountId) : null) ?? null;
  if (source === "screenshot" && account && account.currency !== "THB") {
    throw new Error("Bank-SMS är i THB — välj eller skapa ett THB-konto innan du sparar");
  }
  account =
    account ??
    (await ensureDefaultBankAccount({
      maskedIdentifier: maskedFromCandidate,
      currency: source === "screenshot" ? "THB" : undefined,
    }));
  if (source === "screenshot" && account.currency !== "THB") {
    throw new Error("Bank-SMS är i THB — välj eller skapa ett THB-konto innan du sparar");
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
    throw new Error("Bank-SMS saknar komplett belopp/saldo — ta en tydligare bild.");
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
          clientMutationId: input.clientMutationId,
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
          clientMutationId: input.clientMutationId,
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
