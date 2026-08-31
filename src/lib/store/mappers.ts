import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
  ExtractedTransactionCandidate,
  ExtractionRun,
  PlanItem,
  Profile,
  SourceObservation,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";
import type { UserProgress } from "./types-progress";

type DbProfile = {
  id: string;
  display_name: string;
  timezone: string;
  primary_currency: CurrencyCode;
  reference_currency: CurrencyCode;
  created_at: string;
  updated_at: string;
  onboarding_saldo_at?: string | null;
  onboarding_completed_at?: string | null;
  getting_started_completed_at?: string | null;
  getting_started_collapsed?: boolean | null;
};

type DbAccount = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  account_type: Account["accountType"];
  kind?: Account["kind"] | null;
  currency: CurrencyCode;
  masked_identifier: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type DbCheckpoint = {
  id: string;
  user_id: string;
  account_id: string;
  balance_minor: number;
  currency: CurrencyCode;
  thb_minor?: number | null;
  fx_rate?: number | string | null;
  fx_as_of?: string | null;
  fx_source?: string | null;
  verified_at: string;
  source: string;
  source_observation_id: string | null;
  note: string | null;
  created_at: string;
};

type DbTransaction = {
  id: string;
  user_id: string;
  account_id: string;
  counter_account_id: string | null;
  direction: CanonicalTransaction["direction"];
  transaction_type: CanonicalTransaction["transactionType"];
  amount_minor: number;
  currency: CurrencyCode;
  occurred_at: string;
  description: string;
  merchant: string | null;
  category: string | null;
  source: CanonicalTransaction["source"];
  status: CanonicalTransaction["status"];
  balance_after_minor: number | null;
  fingerprint: string | null;
  source_observation_id: string | null;
  transfer_group_id?: string | null;
  plan_item_id?: string | null;
  sync_status: CanonicalTransaction["syncStatus"];
  created_at: string;
  updated_at: string;
};

type DbObservation = {
  id: string;
  user_id: string;
  kind: SourceObservation["kind"];
  storage_path: string | null;
  institution_hint: string | null;
  account_hint: string | null;
  status: SourceObservation["status"];
  captured_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapProfile(row: DbProfile): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    timezone: row.timezone,
    primaryCurrency: row.primary_currency,
    referenceCurrency: row.reference_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    onboardingSaldoAt: row.onboarding_saldo_at ?? null,
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    gettingStartedCompletedAt: row.getting_started_completed_at ?? null,
    gettingStartedCollapsed: Boolean(row.getting_started_collapsed),
  };
}

function inferKindFromRow(row: DbAccount): Account["kind"] {
  if (row.kind) return row.kind;
  if (row.account_type === "cash") return "cash";
  if (row.currency === "THB") return "thai_bank";
  if (row.currency === "SEK") return "swedish_bank";
  const inst = (row.institution ?? row.name ?? "").toLowerCase();
  if (inst.includes("revolut")) return "revolut";
  if (inst.includes("bunq")) return "bunq";
  return "other";
}

export function mapAccount(row: DbAccount): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    institution: row.institution,
    accountType: row.account_type,
    kind: inferKindFromRow(row),
    currency: row.currency,
    maskedIdentifier: row.masked_identifier,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCheckpoint(row: DbCheckpoint): BalanceCheckpoint {
  const fxRaw = row.fx_rate;
  const fxRate =
    fxRaw == null || fxRaw === ""
      ? null
      : Number(fxRaw);
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    balanceMinor: Number(row.balance_minor),
    currency: row.currency,
    thbMinor:
      row.thb_minor == null ? null : Number(row.thb_minor),
    fxRate:
      fxRate != null && Number.isFinite(fxRate) ? fxRate : null,
    fxAsOf: row.fx_as_of ?? null,
    fxSource: row.fx_source ?? null,
    verifiedAt: row.verified_at,
    source: row.source,
    sourceObservationId: row.source_observation_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function mapTransaction(row: DbTransaction): CanonicalTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    counterAccountId: row.counter_account_id,
    direction: row.direction,
    transactionType: row.transaction_type,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    occurredAt: row.occurred_at,
    description: row.description,
    merchant: row.merchant,
    category: row.category,
    source: row.source,
    status: row.status,
    balanceAfterMinor:
      row.balance_after_minor == null ? null : Number(row.balance_after_minor),
    fingerprint: row.fingerprint,
    sourceObservationId: row.source_observation_id,
    transferGroupId: row.transfer_group_id ?? null,
    planItemId: row.plan_item_id ?? null,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapObservation(row: DbObservation): SourceObservation {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    storagePath: row.storage_path,
    institutionHint: row.institution_hint,
    accountHint: row.account_hint,
    status: row.status,
    capturedAt: row.captured_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type DbExtractionRun = {
  id: string;
  observation_id: string;
  user_id: string;
  provider: string;
  status: ExtractionRun["status"];
  raw_metadata: Record<string, unknown> | null;
  started_at: string;
  finished_at: string | null;
};

type DbCandidate = {
  id: string;
  extraction_run_id: string;
  observation_id: string;
  user_id: string;
  direction: ExtractedTransactionCandidate["direction"];
  amount_minor: number | null;
  currency: CurrencyCode | null;
  balance_after_minor: number | null;
  occurred_at: string | null;
  description: string | null;
  confidence: number | null;
  fingerprint: string | null;
  status: ExtractedTransactionCandidate["status"];
  canonical_transaction_id: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type DbUserProgress = {
  user_id: string;
  level: number;
  rank_id: string;
  on_track_days: number;
  current_streak: number;
  best_streak: number;
  discipline_score: number;
  leaderboard_visible: boolean;
  updated_at: string;
  created_at: string;
};

export function mapExtractionRun(row: DbExtractionRun): ExtractionRun {
  return {
    id: row.id,
    observationId: row.observation_id,
    userId: row.user_id,
    provider: row.provider,
    status: row.status,
    rawMetadata: row.raw_metadata,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function mapCandidate(row: DbCandidate): ExtractedTransactionCandidate {
  return {
    id: row.id,
    extractionRunId: row.extraction_run_id,
    observationId: row.observation_id,
    userId: row.user_id,
    direction: row.direction,
    amountMinor: row.amount_minor == null ? null : Number(row.amount_minor),
    currency: row.currency,
    balanceAfterMinor:
      row.balance_after_minor == null ? null : Number(row.balance_after_minor),
    occurredAt: row.occurred_at,
    description: row.description,
    confidence: row.confidence == null ? null : Number(row.confidence),
    fingerprint: row.fingerprint,
    status: row.status,
    canonicalTransactionId: row.canonical_transaction_id,
    rawPayload: row.raw_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUserProgress(row: DbUserProgress): UserProgress {
  return {
    userId: row.user_id,
    level: row.level,
    rankId: row.rank_id,
    onTrackDays: row.on_track_days,
    currentStreak: row.current_streak,
    bestStreak: row.best_streak,
    disciplineScore: row.discipline_score,
    leaderboardVisible: row.leaderboard_visible,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

type DbPlanItem = {
  id: string;
  user_id: string;
  name: string;
  kind: PlanItem["kind"];
  amount_minor: number;
  currency: CurrencyCode;
  cadence: string | null;
  next_due_at: string | null;
  is_active: boolean;
  settled_at?: string | null;
  settled_minor?: number | null;
  remaining_due_at?: string | null;
  created_at: string;
  updated_at: string;
};

export function mapPlanItem(row: DbPlanItem): PlanItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    kind: row.kind,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    cadence: row.cadence,
    nextDueAt: row.next_due_at,
    isActive: row.is_active,
    settledAt: row.settled_at ?? null,
    settledMinor:
      row.settled_minor == null ? null : Number(row.settled_minor),
    remainingDueAt: row.remaining_due_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
