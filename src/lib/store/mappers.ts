import type {
  Account,
  BalanceCheckpoint,
  CanonicalTransaction,
  Profile,
  SourceObservation,
} from "@/domain/finance";
import type { CurrencyCode } from "@/domain/money";

type DbProfile = {
  id: string;
  display_name: string;
  timezone: string;
  primary_currency: CurrencyCode;
  reference_currency: CurrencyCode;
  created_at: string;
  updated_at: string;
};

type DbAccount = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  account_type: Account["accountType"];
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
  };
}

export function mapAccount(row: DbAccount): Account {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    institution: row.institution,
    accountType: row.account_type,
    currency: row.currency,
    maskedIdentifier: row.masked_identifier,
    isActive: row.is_active,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCheckpoint(row: DbCheckpoint): BalanceCheckpoint {
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    balanceMinor: Number(row.balance_minor),
    currency: row.currency,
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
