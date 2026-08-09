import {
  calculateAccountBalance,
  calculateSafeToSpend,
  filterTransactionsAfterCheckpoint,
  formatRelativeVerificationSv,
  isSameZonedDay,
  startOfZonedDay,
  startOfZonedMonth,
  sumSpending,
  type Account,
  type BalanceCheckpoint,
  type CanonicalTransaction,
  type Profile,
  type SourceObservation,
} from "@/domain/finance";
import { money, type CurrencyCode } from "@/domain/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapAccount,
  mapCheckpoint,
  mapObservation,
  mapProfile,
  mapTransaction,
} from "./mappers";
import type { TodaySnapshot } from "./types-snapshot";

async function requireUserId(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Du måste vara inloggad");
  }
  return user.id;
}

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
  await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAccount);
}

export async function getAccount(accountId: string): Promise<Account | null> {
  await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapAccount(data) : null;
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
      direction: "debit",
      transaction_type: "expense",
      amount_minor: input.amountMinor,
      currency: account.currency,
      occurred_at: input.occurredAt ?? ts,
      description: input.description?.trim() || "Utgift",
      category: input.category ?? null,
      source: "manual",
      status: "confirmed",
      sync_status: "synced",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapTransaction(data);
}

export async function listTransactions(
  accountId?: string,
): Promise<CanonicalTransaction[]> {
  await requireUserId();
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("transactions")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTransaction);
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
  await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("source_observations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapObservation);
}

export async function latestCheckpointForAccount(
  accountId: string,
): Promise<BalanceCheckpoint | null> {
  await requireUserId();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("balance_checkpoints")
    .select("*")
    .eq("account_id", accountId)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapCheckpoint(data) : null;
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const profile = await getProfile();
  const accounts = await listAccounts();
  const primary = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;

  if (!primary) {
    return emptySnapshot(profile, accounts);
  }

  const checkpoint = await latestCheckpointForAccount(primary.id);
  const accountTx = await listTransactions(primary.id);
  const after = filterTransactionsAfterCheckpoint(accountTx, checkpoint);
  const calculated = calculateAccountBalance({
    checkpoint,
    transactionsAfterCheckpoint: after,
  });

  const timezone = profile.timezone;
  const now = new Date();
  const dayStart = startOfZonedDay(now, timezone);
  const monthStart = startOfZonedMonth(now, timezone);

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
  const reservedMinor = 0;
  const bufferMinor = 0;
  const daysUntilIncome = 17;
  const available = calculated ?? money(0, currency);
  const safe = calculateSafeToSpend({
    available,
    reserved: money(reservedMinor, currency),
    safetyBuffer: money(bufferMinor, currency),
    daysUntilNextIncome: daysUntilIncome,
  });

  let balanceKind: TodaySnapshot["balanceKind"] = "unknown";
  if (checkpoint && after.length === 0) balanceKind = "verified_checkpoint_only";
  else if (checkpoint) balanceKind = "calculated";

  return {
    profile,
    accounts,
    primaryAccount: primary,
    checkpoint,
    calculatedBalanceMinor: calculated?.amountMinor ?? null,
    balanceKind,
    verificationLabel: checkpoint
      ? formatRelativeVerificationSv(checkpoint.verifiedAt, now)
      : null,
    todaySpendingMinor: todaySpending.amountMinor,
    monthSpendingMinor: monthSpending.amountMinor,
    safeToSpendTodayMinor: safe.today.amountMinor,
    safeToSpendWeekMinor: safe.week.amountMinor,
    freeMinor: safe.free.amountMinor,
    reservedMinor,
    bufferMinor,
    daysUntilIncome,
    recentTransactions: accountTx.slice(0, 8),
    currency,
  };
}

function emptySnapshot(
  profile: Profile,
  accounts: Account[],
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
    daysUntilIncome: 17,
    recentTransactions: [],
    currency: profile.primaryCurrency,
  };
}
