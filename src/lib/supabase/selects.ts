/** Narrow PostgREST projections for menu snapshot reads (schema `numa`). */

/** supabase-js types only accept `"*"` without generated Database types. */
export function numaSelect(columns: string): "*" {
  return columns as "*";
}

export const PROFILE_SELECT = [
  "id",
  "display_name",
  "timezone",
  "primary_currency",
  "reference_currency",
  "created_at",
  "updated_at",
  "onboarding_saldo_at",
  "onboarding_completed_at",
  "getting_started_completed_at",
  "getting_started_collapsed",
].join(", ");

export const ACCOUNT_SELECT = [
  "id",
  "user_id",
  "name",
  "institution",
  "account_type",
  "kind",
  "currency",
  "masked_identifier",
  "is_active",
  "is_default",
  "created_at",
  "updated_at",
].join(", ");

export const PLAN_ITEM_SELECT = [
  "id",
  "user_id",
  "name",
  "kind",
  "amount_minor",
  "currency",
  "cadence",
  "next_due_at",
  "is_active",
  "settled_at",
  "settled_minor",
  "remaining_due_at",
  "created_at",
  "updated_at",
].join(", ");

export const CHECKPOINT_SELECT = [
  "id",
  "user_id",
  "account_id",
  "balance_minor",
  "currency",
  "thb_minor",
  "fx_rate",
  "fx_as_of",
  "fx_source",
  "verified_at",
  "source",
  "source_observation_id",
  "note",
  "created_at",
].join(", ");

/** Columns Hem / Plan / Analys / Rörelser need from the ledger window. */
export const LEDGER_TRANSACTION_SELECT = [
  "id",
  "user_id",
  "account_id",
  "counter_account_id",
  "direction",
  "transaction_type",
  "amount_minor",
  "currency",
  "occurred_at",
  "description",
  "merchant",
  "category",
  "source",
  "status",
  "balance_after_minor",
  "fingerprint",
  "source_observation_id",
  "transfer_group_id",
  "sync_status",
  "created_at",
  "updated_at",
].join(", ");
