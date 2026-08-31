-- Multi-account FX: USD, account kind, checkpoint THB lock.

-- USD for Revolut/Bunq balances.
do $$ begin
  alter type numa.currency_code add value if not exists 'USD';
exception when duplicate_object then null;
end $$;

-- Where the money lives — drives which currencies are allowed.
do $$ begin
  create type numa.account_kind as enum (
    'thai_bank',
    'cash',
    'swedish_bank',
    'revolut',
    'bunq',
    'other'
  );
exception when duplicate_object then null;
end $$;

alter table numa.accounts
  add column if not exists kind numa.account_kind;

-- Existing rows: THB default → thai_bank, cash account_type → cash, else other.
update numa.accounts
set kind = case
  when account_type = 'cash' then 'cash'::numa.account_kind
  when currency = 'THB' and is_default then 'thai_bank'::numa.account_kind
  when currency = 'THB' then 'thai_bank'::numa.account_kind
  when currency = 'SEK' then 'swedish_bank'::numa.account_kind
  else 'other'::numa.account_kind
end
where kind is null;

alter table numa.accounts
  alter column kind set default 'other'::numa.account_kind;

alter table numa.accounts
  alter column kind set not null;

-- Checkpoint stores native balance (existing) plus the THB value locked at save.
alter table numa.balance_checkpoints
  add column if not exists thb_minor bigint;

alter table numa.balance_checkpoints
  add column if not exists fx_rate numeric(18, 8);

alter table numa.balance_checkpoints
  add column if not exists fx_as_of timestamptz;

alter table numa.balance_checkpoints
  add column if not exists fx_source text;

-- Backfill: THB checkpoints are 1:1.
update numa.balance_checkpoints
set
  thb_minor = balance_minor,
  fx_rate = 1,
  fx_as_of = verified_at,
  fx_source = 'identity'
where currency = 'THB' and thb_minor is null;

-- Non-THB without a rate yet: leave thb_minor null until the next verify
-- (totalSaldoThb skips unknown rather than inventing a rate).

comment on column numa.accounts.kind is
  'Product place: thai_bank/cash/swedish_bank/revolut/bunq/other — locks allowed currencies.';
comment on column numa.balance_checkpoints.thb_minor is
  'THB value of balance_minor locked at verify time. Null = not yet convertible.';
comment on column numa.balance_checkpoints.fx_rate is
  'Quote THB per 1 major unit of currency, locked at verify.';
