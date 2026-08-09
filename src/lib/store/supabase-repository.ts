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
  type ExtractedTransactionCandidate,
  type Profile,
  type SourceObservation,
  type TransactionSource,
} from "@/domain/finance";
import { money, type CurrencyCode } from "@/domain/money";
import { createExtractionProvider } from "@/domain/imports";
import { rankForOnTrackDays } from "@/domain/gamification";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mapAccount,
  mapCandidate,
  mapCheckpoint,
  mapExtractionRun,
  mapObservation,
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

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const profile = await getProfile();
  const accounts = await listAccounts();
  const primary = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;

  if (!primary) {
    const progress = await getUserProgress();
    return emptySnapshot(profile, accounts, progress);
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

  const progress = await getUserProgress();

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
    progress,
  };
}

function emptySnapshot(
  profile: Profile,
  accounts: Account[],
  progress: UserProgress | null,
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

  const { data: obsRow, error: obsError } = await supabase
    .from("source_observations")
    .insert({
      user_id: userId,
      kind: "receipt",
      storage_path: storagePath,
      status: "extracting",
      notes: "Kvitto uppladdat — väntar på läsning",
    })
    .select("*")
    .single();
  if (obsError) throw new Error(obsError.message);
  const observation = mapObservation(obsRow);

  const provider = createExtractionProvider();
  const imageBase64 = Buffer.from(input.bytes).toString("base64");
  const extraction = await provider.extract({
    observationId: observation.id,
    storagePath,
    imageBase64,
    mimeType: input.mimeType,
  });

  const succeeded =
    extraction.provider !== "none" && extraction.candidates.length > 0;
  const runStatus = extraction.provider === "none" ? "failed" : "succeeded";

  const { data: runRow, error: runError } = await supabase
    .from("extraction_runs")
    .insert({
      observation_id: observation.id,
      user_id: userId,
      provider: extraction.provider,
      status: runStatus,
      raw_metadata: extraction.rawMetadata,
      finished_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (runError) throw new Error(runError.message);
  mapExtractionRun(runRow);

  let candidate: ExtractedTransactionCandidate | null = null;
  const first = extraction.candidates[0];
  if (first) {
    const { data: candRow, error: candError } = await supabase
      .from("extracted_transaction_candidates")
      .insert({
        extraction_run_id: runRow.id,
        observation_id: observation.id,
        user_id: userId,
        direction: first.direction,
        amount_minor: first.amountMinor,
        currency: first.currency,
        balance_after_minor: first.balanceAfterMinor,
        occurred_at: first.occurredAt,
        description: first.description,
        confidence: first.confidence,
        status: "needs_review",
        raw_payload: first.rawPayload,
      })
      .select("*")
      .single();
    if (candError) throw new Error(candError.message);
    candidate = mapCandidate(candRow);
  }

  await supabase
    .from("source_observations")
    .update({
      status: succeeded ? "needs_review" : "uploaded",
      notes:
        extraction.provider === "none"
          ? "Bild sparad. Autoläsning är av — ange belopp själv."
          : succeeded
            ? "Vi hittade ett belopp — bekräfta innan det sparas."
            : "Kunde inte läsa beloppet automatiskt — ange själv.",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", observation.id);

  const refreshed = (await getObservation(observation.id)) ?? observation;
  const profile = await getProfile();

  let ocrStatus: ReceiptUploadResult["ocrStatus"] = "ok";
  if (extraction.provider === "none") ocrStatus = "unavailable";
  else if (!first?.amountMinor) ocrStatus = "failed";

  return {
    observation: refreshed,
    candidate,
    suggestedAmountMinor: first?.amountMinor ?? null,
    suggestedDescription: first?.description ?? null,
    currency: first?.currency ?? profile.primaryCurrency,
    ocrStatus,
    message:
      ocrStatus === "unavailable"
        ? "Autoläsning är av. Ange beloppet från kvittot."
        : ocrStatus === "failed"
          ? "Vi kunde inte läsa beloppet säkert. Kontrollera och fyll i själv."
          : null,
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

  if (input.candidateId) {
    const supabase = await createSupabaseServerClient();
    const { data: cand, error } = await supabase
      .from("extracted_transaction_candidates")
      .select("*")
      .eq("user_id", userId)
      .eq("id", input.candidateId)
      .eq("observation_id", input.observationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cand) throw new Error("Kandidaten hittades inte");
  }

  const tx = await createManualExpense({
    accountId: input.accountId,
    amountMinor: input.amountMinor,
    description: input.description,
    category: input.category,
    source: "receipt_camera",
    sourceObservationId: input.observationId,
  });

  const supabase = await createSupabaseServerClient();
  if (input.candidateId) {
    await supabase
      .from("extracted_transaction_candidates")
      .update({
        status: "confirmed",
        canonical_transaction_id: tx.id,
        amount_minor: input.amountMinor,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("id", input.candidateId);
  }

  await supabase
    .from("source_observations")
    .update({
      status: "processed",
      notes: "Bekräftad och sparad som utgift",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", input.observationId);

  return tx;
}
