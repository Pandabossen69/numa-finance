-- =============================================================================
-- NUMA isolated schema bootstrap
-- Host project may be shared (e.g. NextStep leads staging).
-- ALL NUMA objects live under schema `numa` + bucket `numa-source-media`.
-- Do NOT create NUMA tables in `public`.
-- =============================================================================

create extension if not exists "pgcrypto";

create schema if not exists numa;

comment on schema numa is 'NUMA personal finance app — isolated from other apps on this project';

grant usage on schema numa to postgres, anon, authenticated, service_role;
grant all on schema numa to postgres, service_role;
grant all on all tables in schema numa to postgres, service_role;
grant all on all sequences in schema numa to postgres, service_role;
grant all on all routines in schema numa to postgres, service_role;

alter default privileges in schema numa
  grant all on tables to postgres, service_role;
alter default privileges in schema numa
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema numa
  grant usage, select on sequences to authenticated;

-- ---------------------------------------------------------------------------
-- Enums (namespaced in numa)
-- ---------------------------------------------------------------------------

do $$ begin
  create type numa.account_type as enum (
    'checking', 'savings', 'cash', 'credit', 'investment', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.transaction_type as enum (
    'expense', 'income', 'transfer', 'cash_withdrawal', 'refund', 'adjustment', 'unknown'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.transaction_direction as enum ('debit', 'credit');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.transaction_source as enum (
    'manual', 'receipt_camera', 'price_camera', 'screenshot', 'sms',
    'bank_import', 'api', 'adjustment'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.transaction_status as enum (
    'pending_sync', 'confirmed', 'needs_review', 'voided'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.sync_status as enum (
    'saved', 'pending_sync', 'synced', 'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.observation_kind as enum (
    'screenshot', 'receipt', 'price', 'sms', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.observation_status as enum (
    'uploaded', 'extracting', 'extracted', 'needs_review', 'processed', 'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.candidate_status as enum (
    'pending', 'validated', 'duplicate', 'needs_review', 'confirmed', 'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.reconciliation_state as enum (
    'reconciled', 'calculated_since_verification', 'needs_review',
    'discrepancy', 'stale_verification'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.plan_category_kind as enum (
    'mandatory', 'expected', 'flexible', 'goal', 'buffer'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type numa.currency_code as enum ('THB', 'SEK');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles (NUMA-only; does not replace any public.profiles from other apps)
-- ---------------------------------------------------------------------------

create table if not exists numa.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Användare',
  timezone text not null default 'Asia/Bangkok',
  primary_currency numa.currency_code not null default 'THB',
  reference_currency numa.currency_code not null default 'SEK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint numa_profiles_timezone_nonempty check (char_length(trim(timezone)) > 0)
);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table if not exists numa.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references numa.profiles (id) on delete cascade,
  name text not null,
  institution text,
  account_type numa.account_type not null default 'checking',
  currency numa.currency_code not null,
  masked_identifier text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint numa_accounts_name_nonempty check (char_length(trim(name)) > 0)
);

create index if not exists numa_accounts_user_id_idx on numa.accounts (user_id);
create unique index if not exists numa_accounts_one_default_per_user
  on numa.accounts (user_id)
  where is_default = true and is_active = true;

-- ---------------------------------------------------------------------------
-- Balance checkpoints
-- ---------------------------------------------------------------------------

create table if not exists numa.balance_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references numa.profiles (id) on delete cascade,
  account_id uuid not null references numa.accounts (id) on delete cascade,
  balance_minor bigint not null,
  currency numa.currency_code not null,
  verified_at timestamptz not null,
  source text not null,
  source_observation_id uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint numa_balance_checkpoints_source_nonempty check (char_length(trim(source)) > 0)
);

create index if not exists numa_balance_checkpoints_account_verified_idx
  on numa.balance_checkpoints (account_id, verified_at desc);

-- ---------------------------------------------------------------------------
-- Source observations
-- ---------------------------------------------------------------------------

create table if not exists numa.source_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references numa.profiles (id) on delete cascade,
  kind numa.observation_kind not null,
  storage_path text,
  institution_hint text,
  account_hint text,
  status numa.observation_status not null default 'uploaded',
  captured_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists numa_source_observations_user_id_idx
  on numa.source_observations (user_id, created_at desc);

alter table numa.balance_checkpoints
  drop constraint if exists numa_balance_checkpoints_source_observation_id_fkey;

alter table numa.balance_checkpoints
  add constraint numa_balance_checkpoints_source_observation_id_fkey
  foreign key (source_observation_id) references numa.source_observations (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- Extraction runs + candidates
-- ---------------------------------------------------------------------------

create table if not exists numa.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references numa.source_observations (id) on delete cascade,
  user_id uuid not null references numa.profiles (id) on delete cascade,
  provider text not null,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  raw_metadata jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists numa.extracted_transaction_candidates (
  id uuid primary key default gen_random_uuid(),
  extraction_run_id uuid not null references numa.extraction_runs (id) on delete cascade,
  observation_id uuid not null references numa.source_observations (id) on delete cascade,
  user_id uuid not null references numa.profiles (id) on delete cascade,
  direction numa.transaction_direction,
  amount_minor bigint,
  currency numa.currency_code,
  balance_after_minor bigint,
  occurred_at timestamptz,
  description text,
  confidence numeric(5,4),
  fingerprint text,
  status numa.candidate_status not null default 'pending',
  canonical_transaction_id uuid,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint numa_candidates_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index if not exists numa_candidates_fingerprint_idx
  on numa.extracted_transaction_candidates (user_id, fingerprint)
  where fingerprint is not null;

-- ---------------------------------------------------------------------------
-- Canonical transactions
-- ---------------------------------------------------------------------------

create table if not exists numa.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references numa.profiles (id) on delete cascade,
  account_id uuid not null references numa.accounts (id) on delete restrict,
  counter_account_id uuid references numa.accounts (id) on delete set null,
  direction numa.transaction_direction not null,
  transaction_type numa.transaction_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency numa.currency_code not null,
  occurred_at timestamptz not null,
  description text not null default '',
  merchant text,
  category text,
  source numa.transaction_source not null,
  status numa.transaction_status not null default 'confirmed',
  balance_after_minor bigint,
  fingerprint text,
  source_observation_id uuid references numa.source_observations (id) on delete set null,
  sync_status numa.sync_status not null default 'synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists numa_transactions_account_occurred_idx
  on numa.transactions (account_id, occurred_at desc);

create index if not exists numa_transactions_user_occurred_idx
  on numa.transactions (user_id, occurred_at desc);

create unique index if not exists numa_transactions_user_fingerprint_unique
  on numa.transactions (user_id, fingerprint)
  where fingerprint is not null and status <> 'voided';

alter table numa.extracted_transaction_candidates
  drop constraint if exists numa_candidates_canonical_transaction_id_fkey;

alter table numa.extracted_transaction_candidates
  add constraint numa_candidates_canonical_transaction_id_fkey
  foreign key (canonical_transaction_id) references numa.transactions (id)
  on delete set null;

create table if not exists numa.transaction_observation_links (
  transaction_id uuid not null references numa.transactions (id) on delete cascade,
  observation_id uuid not null references numa.source_observations (id) on delete cascade,
  user_id uuid not null references numa.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (transaction_id, observation_id)
);

-- ---------------------------------------------------------------------------
-- FX + reconciliation + plan stubs
-- ---------------------------------------------------------------------------

create table if not exists numa.fx_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references numa.profiles (id) on delete cascade,
  transaction_id uuid references numa.transactions (id) on delete set null,
  original_amount_minor bigint not null,
  original_currency numa.currency_code not null,
  reference_currency numa.currency_code not null,
  rate numeric(18, 8) not null check (rate > 0),
  converted_amount_minor bigint not null,
  rate_as_of timestamptz not null,
  rate_source text not null,
  created_at timestamptz not null default now()
);

create table if not exists numa.reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references numa.profiles (id) on delete cascade,
  account_id uuid not null references numa.accounts (id) on delete cascade,
  expected_balance_minor bigint not null,
  observed_balance_minor bigint not null,
  difference_minor bigint not null,
  currency numa.currency_code not null,
  state numa.reconciliation_state not null,
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists numa_reconciliation_issues_open_idx
  on numa.reconciliation_issues (user_id, account_id)
  where resolved_at is null;

create table if not exists numa.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references numa.profiles (id) on delete cascade,
  name text not null,
  kind numa.plan_category_kind not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency numa.currency_code not null,
  cadence text,
  next_due_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table numa.profiles enable row level security;
alter table numa.accounts enable row level security;
alter table numa.balance_checkpoints enable row level security;
alter table numa.source_observations enable row level security;
alter table numa.extraction_runs enable row level security;
alter table numa.extracted_transaction_candidates enable row level security;
alter table numa.transactions enable row level security;
alter table numa.transaction_observation_links enable row level security;
alter table numa.fx_conversions enable row level security;
alter table numa.reconciliation_issues enable row level security;
alter table numa.plan_items enable row level security;

drop policy if exists numa_profiles_select_own on numa.profiles;
drop policy if exists numa_profiles_update_own on numa.profiles;
drop policy if exists numa_profiles_insert_own on numa.profiles;
create policy numa_profiles_select_own on numa.profiles
  for select using (auth.uid() = id);
create policy numa_profiles_update_own on numa.profiles
  for update using (auth.uid() = id);
create policy numa_profiles_insert_own on numa.profiles
  for insert with check (auth.uid() = id);

drop policy if exists numa_accounts_owner_all on numa.accounts;
create policy numa_accounts_owner_all on numa.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_checkpoints_owner_all on numa.balance_checkpoints;
create policy numa_checkpoints_owner_all on numa.balance_checkpoints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_observations_owner_all on numa.source_observations;
create policy numa_observations_owner_all on numa.source_observations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_extraction_runs_owner_all on numa.extraction_runs;
create policy numa_extraction_runs_owner_all on numa.extraction_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_candidates_owner_all on numa.extracted_transaction_candidates;
create policy numa_candidates_owner_all on numa.extracted_transaction_candidates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_transactions_owner_all on numa.transactions;
create policy numa_transactions_owner_all on numa.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_tx_obs_links_owner_all on numa.transaction_observation_links;
create policy numa_tx_obs_links_owner_all on numa.transaction_observation_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_fx_owner_all on numa.fx_conversions;
create policy numa_fx_owner_all on numa.fx_conversions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_reconciliation_owner_all on numa.reconciliation_issues;
create policy numa_reconciliation_owner_all on numa.reconciliation_issues
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_plan_items_owner_all on numa.plan_items;
create policy numa_plan_items_owner_all on numa.plan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auth hook: ONLY writes numa.profiles — never touches other apps' tables.
-- Named distinctly so it does not collide with other projects' triggers.
-- ---------------------------------------------------------------------------

create or replace function numa.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = numa, public
as $$
begin
  insert into numa.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Användare')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists numa_on_auth_user_created on auth.users;
create trigger numa_on_auth_user_created
  after insert on auth.users
  for each row execute function numa.handle_new_user();

-- ---------------------------------------------------------------------------
-- Private storage bucket for NUMA media only
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('numa-source-media', 'numa-source-media', false)
on conflict (id) do nothing;

drop policy if exists numa_source_media_select_own on storage.objects;
drop policy if exists numa_source_media_insert_own on storage.objects;
drop policy if exists numa_source_media_update_own on storage.objects;
drop policy if exists numa_source_media_delete_own on storage.objects;

create policy numa_source_media_select_own
on storage.objects for select
using (
  bucket_id = 'numa-source-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy numa_source_media_insert_own
on storage.objects for insert
with check (
  bucket_id = 'numa-source-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy numa_source_media_update_own
on storage.objects for update
using (
  bucket_id = 'numa-source-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy numa_source_media_delete_own
on storage.objects for delete
using (
  bucket_id = 'numa-source-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);
