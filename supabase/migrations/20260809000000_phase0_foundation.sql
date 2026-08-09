-- NUMA Phase 0 foundation schema
-- Money amounts are integer minor units. Timestamps are timestamptz.
-- RLS is enabled on all user-owned tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.account_type as enum (
    'checking', 'savings', 'cash', 'credit', 'investment', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_type as enum (
    'expense', 'income', 'transfer', 'cash_withdrawal', 'refund', 'adjustment', 'unknown'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_direction as enum ('debit', 'credit');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_source as enum (
    'manual', 'receipt_camera', 'price_camera', 'screenshot', 'sms',
    'bank_import', 'api', 'adjustment'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.transaction_status as enum (
    'pending_sync', 'confirmed', 'needs_review', 'voided'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.sync_status as enum (
    'saved', 'pending_sync', 'synced', 'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.observation_kind as enum (
    'screenshot', 'receipt', 'price', 'sms', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.observation_status as enum (
    'uploaded', 'extracting', 'extracted', 'needs_review', 'processed', 'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.candidate_status as enum (
    'pending', 'validated', 'duplicate', 'needs_review', 'confirmed', 'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.reconciliation_state as enum (
    'reconciled', 'calculated_since_verification', 'needs_review',
    'discrepancy', 'stale_verification'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.plan_category_kind as enum (
    'mandatory', 'expected', 'flexible', 'goal', 'buffer'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.currency_code as enum ('THB', 'SEK');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Användare',
  timezone text not null default 'Asia/Bangkok',
  primary_currency public.currency_code not null default 'THB',
  reference_currency public.currency_code not null default 'SEK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_timezone_nonempty check (char_length(trim(timezone)) > 0)
);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  institution text,
  account_type public.account_type not null default 'checking',
  currency public.currency_code not null,
  masked_identifier text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_name_nonempty check (char_length(trim(name)) > 0)
);

create index if not exists accounts_user_id_idx on public.accounts (user_id);
create unique index if not exists accounts_one_default_per_user
  on public.accounts (user_id)
  where is_default = true and is_active = true;

-- ---------------------------------------------------------------------------
-- Balance checkpoints (verified external balances)
-- ---------------------------------------------------------------------------

create table if not exists public.balance_checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  balance_minor bigint not null,
  currency public.currency_code not null,
  verified_at timestamptz not null,
  source text not null,
  source_observation_id uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint balance_checkpoints_source_nonempty check (char_length(trim(source)) > 0)
);

create index if not exists balance_checkpoints_account_verified_idx
  on public.balance_checkpoints (account_id, verified_at desc);

-- ---------------------------------------------------------------------------
-- Source observations (screenshots, receipts, etc.) — NOT transactions
-- ---------------------------------------------------------------------------

create table if not exists public.source_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.observation_kind not null,
  storage_path text,
  institution_hint text,
  account_hint text,
  status public.observation_status not null default 'uploaded',
  captured_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_observations_user_id_idx
  on public.source_observations (user_id, created_at desc);

alter table public.balance_checkpoints
  drop constraint if exists balance_checkpoints_source_observation_id_fkey;

alter table public.balance_checkpoints
  add constraint balance_checkpoints_source_observation_id_fkey
  foreign key (source_observation_id) references public.source_observations (id)
  on delete set null;

-- ---------------------------------------------------------------------------
-- Extraction runs + candidates
-- ---------------------------------------------------------------------------

create table if not exists public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.source_observations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  raw_metadata jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.extracted_transaction_candidates (
  id uuid primary key default gen_random_uuid(),
  extraction_run_id uuid not null references public.extraction_runs (id) on delete cascade,
  observation_id uuid not null references public.source_observations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  direction public.transaction_direction,
  amount_minor bigint,
  currency public.currency_code,
  balance_after_minor bigint,
  occurred_at timestamptz,
  description text,
  confidence numeric(5,4),
  fingerprint text,
  status public.candidate_status not null default 'pending',
  canonical_transaction_id uuid,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidates_confidence_range check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create index if not exists candidates_fingerprint_idx
  on public.extracted_transaction_candidates (user_id, fingerprint)
  where fingerprint is not null;

-- ---------------------------------------------------------------------------
-- Canonical transactions
-- ---------------------------------------------------------------------------

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  counter_account_id uuid references public.accounts (id) on delete set null,
  direction public.transaction_direction not null,
  transaction_type public.transaction_type not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  occurred_at timestamptz not null,
  description text not null default '',
  merchant text,
  category text,
  source public.transaction_source not null,
  status public.transaction_status not null default 'confirmed',
  balance_after_minor bigint,
  fingerprint text,
  source_observation_id uuid references public.source_observations (id) on delete set null,
  sync_status public.sync_status not null default 'synced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_account_occurred_idx
  on public.transactions (account_id, occurred_at desc);

create index if not exists transactions_user_occurred_idx
  on public.transactions (user_id, occurred_at desc);

create unique index if not exists transactions_user_fingerprint_unique
  on public.transactions (user_id, fingerprint)
  where fingerprint is not null and status <> 'voided';

alter table public.extracted_transaction_candidates
  drop constraint if exists extracted_transaction_candidates_canonical_transaction_id_fkey;

alter table public.extracted_transaction_candidates
  add constraint extracted_transaction_candidates_canonical_transaction_id_fkey
  foreign key (canonical_transaction_id) references public.transactions (id)
  on delete set null;

-- Many observations may reference one transaction via candidates.
-- Optional explicit link table for multi-source provenance.
create table if not exists public.transaction_observation_links (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  observation_id uuid not null references public.source_observations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (transaction_id, observation_id)
);

-- ---------------------------------------------------------------------------
-- FX conversion records (preserve historical rates)
-- ---------------------------------------------------------------------------

create table if not exists public.fx_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  original_amount_minor bigint not null,
  original_currency public.currency_code not null,
  reference_currency public.currency_code not null,
  rate numeric(18, 8) not null check (rate > 0),
  converted_amount_minor bigint not null,
  rate_as_of timestamptz not null,
  rate_source text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reconciliation issues
-- ---------------------------------------------------------------------------

create table if not exists public.reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  expected_balance_minor bigint not null,
  observed_balance_minor bigint not null,
  difference_minor bigint not null,
  currency public.currency_code not null,
  state public.reconciliation_state not null,
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reconciliation_issues_open_idx
  on public.reconciliation_issues (user_id, account_id)
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- Planning stubs (Phase 1+)
-- ---------------------------------------------------------------------------

create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind public.plan_category_kind not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency public.currency_code not null,
  cadence text,
  next_due_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Storage bucket note (create via dashboard/API):
--   private bucket: source-media
--   no public policies; serve via signed URLs only
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.balance_checkpoints enable row level security;
alter table public.source_observations enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.extracted_transaction_candidates enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_observation_links enable row level security;
alter table public.fx_conversions enable row level security;
alter table public.reconciliation_issues enable row level security;
alter table public.plan_items enable row level security;

-- Profiles
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id);
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

-- Generic owner policies
create policy accounts_owner_all on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy checkpoints_owner_all on public.balance_checkpoints
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy observations_owner_all on public.source_observations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy extraction_runs_owner_all on public.extraction_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy candidates_owner_all on public.extracted_transaction_candidates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy transactions_owner_all on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tx_obs_links_owner_all on public.transaction_observation_links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy fx_owner_all on public.fx_conversions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy reconciliation_owner_all on public.reconciliation_issues
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy plan_items_owner_all on public.plan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Användare'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
