-- P0/P1: historical FX on ledger rows, multi-payment allocations,
-- mutation keys, atomic plan+ledger, 30-day image purge.

alter table numa.transactions
  add column if not exists thb_minor bigint,
  add column if not exists fx_rate numeric,
  add column if not exists fx_as_of timestamptz,
  add column if not exists fx_source text,
  add column if not exists client_mutation_id uuid;

update numa.transactions
set
  thb_minor = amount_minor,
  fx_rate = 1,
  fx_as_of = coalesce(occurred_at, created_at),
  fx_source = 'identity'
where currency = 'THB'
  and thb_minor is null;

create unique index if not exists numa_transactions_user_mutation_uidx
  on numa.transactions (user_id, client_mutation_id)
  where client_mutation_id is not null;

drop index if exists numa.numa_transactions_one_confirmed_link_per_plan;

create table if not exists numa.plan_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_item_id uuid not null references numa.plan_items (id) on delete cascade,
  transaction_id uuid not null references numa.transactions (id) on delete cascade,
  allocated_canonical_minor bigint not null check (allocated_canonical_minor > 0),
  allocated_native_minor bigint not null check (allocated_native_minor > 0),
  currency text not null,
  fx_rate numeric,
  client_mutation_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  unique (plan_item_id, transaction_id)
);

create unique index if not exists numa_plan_alloc_user_mutation_uidx
  on numa.plan_payment_allocations (user_id, client_mutation_id)
  where client_mutation_id is not null;

create index if not exists numa_plan_alloc_plan_idx
  on numa.plan_payment_allocations (user_id, plan_item_id);

alter table numa.plan_payment_allocations enable row level security;

drop policy if exists numa_plan_alloc_owner_all on numa.plan_payment_allocations;
create policy numa_plan_alloc_owner_all on numa.plan_payment_allocations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on numa.plan_payment_allocations to authenticated;
grant all on numa.plan_payment_allocations to service_role;

-- Backfill one allocation per existing confirmed link.
insert into numa.plan_payment_allocations (
  user_id,
  plan_item_id,
  transaction_id,
  allocated_canonical_minor,
  allocated_native_minor,
  currency,
  fx_rate,
  created_at
)
select
  t.user_id,
  t.linked_plan_item_id,
  t.id,
  coalesce(t.thb_minor, t.amount_minor),
  t.amount_minor,
  t.currency,
  t.fx_rate,
  t.updated_at
from numa.transactions t
where t.linked_plan_item_id is not null
  and t.status = 'confirmed'
  and t.ledger_origin = 'external'
on conflict (plan_item_id, transaction_id) do nothing;

-- Align plan flags with backfilled allocations so partial links stay partial.
update numa.plan_items p
set
  settled_minor = least(p.amount_minor, a.allocated),
  settled_at = case
    when a.allocated >= p.amount_minor then coalesce(p.settled_at, timezone('utc', now()))
    else null
  end,
  remaining_due_at = case
    when a.allocated > 0 and a.allocated < p.amount_minor
      then coalesce(p.remaining_due_at, p.next_due_at)
    else case when a.allocated >= p.amount_minor then null else p.remaining_due_at end
  end
from (
  select plan_item_id, sum(allocated_canonical_minor) as allocated
  from numa.plan_payment_allocations
  group by plan_item_id
) a
where p.id = a.plan_item_id;

create table if not exists numa.mutation_keys (
  user_id uuid not null,
  mutation_id uuid not null,
  kind text not null,
  result jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, mutation_id)
);

alter table numa.mutation_keys enable row level security;
drop policy if exists numa_mutation_keys_owner_all on numa.mutation_keys;
create policy numa_mutation_keys_owner_all on numa.mutation_keys
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on numa.mutation_keys to authenticated;
grant all on numa.mutation_keys to service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function numa_internal.account_fx_rate(p_account numa.accounts)
returns numeric
language plpgsql
stable
security definer
set search_path = numa, numa_internal, pg_temp
as $$
declare
  v_rate numeric;
begin
  if p_account.currency = 'THB' then
    return 1;
  end if;
  select c.fx_rate into v_rate
  from numa.balance_checkpoints c
  where c.account_id = p_account.id
    and c.user_id = p_account.user_id
    and c.fx_rate is not null
    and c.fx_rate > 0
  order by c.verified_at desc
  limit 1;
  return v_rate;
end;
$$;

create or replace function numa_internal.plan_allocated_sum(p_uid uuid, p_item_id uuid)
returns bigint
language sql
stable
security definer
set search_path = numa, numa_internal, pg_temp
as $$
  select coalesce(sum(allocated_canonical_minor), 0)
  from numa.plan_payment_allocations
  where user_id = p_uid
    and plan_item_id = p_item_id;
$$;

-- ---------------------------------------------------------------------------
-- Settlement: native + THB, allocations reduce the synthetic booking.
-- ---------------------------------------------------------------------------

drop function if exists numa.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid);
drop function if exists numa_internal.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid);

create or replace function numa_internal.settle_plan_item(
  p_item_id uuid,
  p_settled boolean,
  p_target_settled_minor bigint default null,
  p_remaining_due_at timestamptz default null,
  p_account_id uuid default null,
  p_client_mutation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = numa, numa_internal, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_item numa.plan_items%rowtype;
  v_account numa.accounts%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_amount bigint;
  v_target bigint;
  v_allocated bigint := 0;
  v_synth_target bigint := 0;
  v_already_booked_thb bigint := 0;
  v_booked_thb bigint := 0;
  v_booked_native bigint := 0;
  v_fx numeric;
  v_kind text;
  v_direction numa.transaction_direction;
  v_tx_type numa.transaction_type;
  v_old_synth numa.transactions%rowtype;
  v_new_id uuid;
  v_new_settled_at timestamptz;
  v_new_settled_minor bigint;
  v_new_remaining timestamptz;
  v_saldo_delta_thb bigint := 0;
  v_saldo_delta_native bigint := 0;
  v_cached jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_client_mutation_id is not null then
    select result into v_cached
    from numa.mutation_keys
    where user_id = v_uid
      and mutation_id = p_client_mutation_id;
    if found then
      return v_cached;
    end if;
  end if;

  select * into v_item
  from numa.plan_items
  where id = p_item_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'plan item not found';
  end if;

  v_amount := v_item.amount_minor;
  if v_amount is null or v_amount <= 0 then
    raise exception 'plan item has no amount';
  end if;

  v_allocated := numa_internal.plan_allocated_sum(v_uid, v_item.id);

  if not p_settled then
    v_target := v_allocated;
  elsif p_target_settled_minor is null then
    v_target := v_amount;
  else
    v_target := greatest(v_allocated, least(v_amount, p_target_settled_minor));
  end if;

  if v_target <= 0 then
    v_new_settled_at := null;
    v_new_settled_minor := null;
    v_new_remaining := null;
  elsif v_target >= v_amount then
    v_new_settled_at := coalesce(v_item.settled_at, v_now);
    v_new_settled_minor := v_amount;
    v_new_remaining := null;
  else
    v_new_settled_at := null;
    v_new_settled_minor := v_target;
    v_new_remaining := coalesce(p_remaining_due_at, v_item.remaining_due_at, v_item.next_due_at);
  end if;

  v_synth_target := greatest(0, v_target - v_allocated);

  if p_account_id is not null then
    select * into v_account
    from numa.accounts
    where id = p_account_id
      and user_id = v_uid;
    if not found then
      raise exception 'account not found';
    end if;
  else
    select * into v_account
    from numa.accounts
    where user_id = v_uid
      and is_default = true
      and is_active = true
    limit 1;
  end if;

  select * into v_old_synth
  from numa.transactions
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed'
  order by occurred_at desc
  limit 1
  for update;

  if found then
    v_already_booked_thb := coalesce(v_old_synth.thb_minor, v_old_synth.amount_minor);
    if v_account.id is null then
      select * into v_account
      from numa.accounts
      where id = v_old_synth.account_id
        and user_id = v_uid;
    end if;
  end if;

  if coalesce(v_item.settled_minor, 0) = coalesce(v_new_settled_minor, 0)
     and v_item.settled_at is not distinct from v_new_settled_at
     and v_item.remaining_due_at is not distinct from v_new_remaining
     and v_already_booked_thb = v_synth_target
  then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'item', to_jsonb(v_item),
      'booked_minor', 0,
      'booked_native_minor', 0,
      'booked_canonical_minor', 0,
      'saldo_delta', 0,
      'saldo_delta_native', 0,
      'account_id', null,
      'skipped_because_funded', v_allocated > 0 and v_synth_target = 0
    );
  end if;

  update numa.transactions
  set status = 'voided', updated_at = v_now
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed';

  if v_synth_target > 0 then
    if v_account.id is null then
      raise exception 'no account for settlement booking';
    end if;

    v_fx := numa_internal.account_fx_rate(v_account);
    if v_account.currency <> 'THB' and (v_fx is null or v_fx <= 0) then
      raise exception 'account has no exchange rate';
    end if;
    if v_fx is null then
      v_fx := 1;
    end if;

    if v_account.currency = 'THB' then
      v_booked_native := v_synth_target;
    else
      v_booked_native := round(v_synth_target / v_fx);
    end if;
    v_booked_thb := v_synth_target;

    if lower(coalesce(v_item.cadence, '')) = 'income' then
      v_kind := 'income';
      v_direction := 'credit';
      v_tx_type := 'income';
    else
      v_kind := 'expense';
      v_direction := 'debit';
      v_tx_type := 'expense';
    end if;

    v_new_id := gen_random_uuid();
    insert into numa.transactions (
      id, user_id, account_id, direction, transaction_type,
      amount_minor, currency, thb_minor, fx_rate, fx_as_of, fx_source,
      occurred_at, description, merchant, source, status, sync_status,
      plan_item_id, ledger_origin, linked_plan_item_id,
      client_mutation_id, created_at, updated_at
    ) values (
      v_new_id, v_uid, v_account.id, v_direction, v_tx_type,
      v_booked_native, v_account.currency, v_booked_thb, v_fx, v_now, 'settlement',
      v_now,
      coalesce(nullif(btrim(v_item.name), ''), 'Planpost'),
      nullif(btrim(v_item.name), ''),
      'manual', 'confirmed', 'synced',
      v_item.id, 'plan_settle', null,
      p_client_mutation_id, v_now, v_now
    );
  end if;

  if v_kind = 'income' or lower(coalesce(v_item.cadence, '')) = 'income' then
    v_saldo_delta_thb := v_booked_thb - v_already_booked_thb;
    v_saldo_delta_native := v_booked_native - coalesce(v_old_synth.amount_minor, 0);
  else
    v_saldo_delta_thb := -(v_booked_thb - v_already_booked_thb);
    v_saldo_delta_native := -(v_booked_native - coalesce(v_old_synth.amount_minor, 0));
  end if;

  update numa.plan_items
  set
    settled_at = v_new_settled_at,
    settled_minor = v_new_settled_minor,
    remaining_due_at = v_new_remaining,
    updated_at = v_now
  where id = v_item.id
    and user_id = v_uid
  returning * into v_item;

  v_cached := jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'item', to_jsonb(v_item),
    'booked_minor', v_booked_thb,
    'booked_native_minor', v_booked_native,
    'booked_canonical_minor', v_booked_thb,
    'saldo_delta', v_saldo_delta_thb,
    'saldo_delta_native', v_saldo_delta_native,
    'account_id', v_account.id,
    'skipped_because_funded', v_synth_target = 0 and v_allocated > 0
  );

  if p_client_mutation_id is not null then
    insert into numa.mutation_keys (user_id, mutation_id, kind, result)
    values (v_uid, p_client_mutation_id, 'settle', v_cached)
    on conflict (user_id, mutation_id) do nothing;
  end if;

  return v_cached;
end;
$$;

revoke all on function numa_internal.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid, uuid) from public;
grant execute on function numa_internal.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid, uuid) to authenticated;
grant execute on function numa_internal.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid, uuid) to service_role;

create or replace function numa.settle_plan_item(
  p_item_id uuid,
  p_settled boolean,
  p_target_settled_minor bigint default null,
  p_remaining_due_at timestamptz default null,
  p_account_id uuid default null,
  p_client_mutation_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = numa, numa_internal, pg_temp
as $$
begin
  return numa_internal.settle_plan_item(
    p_item_id, p_settled, p_target_settled_minor,
    p_remaining_due_at, p_account_id, p_client_mutation_id
  );
end;
$$;

revoke all on function numa.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid, uuid) from public;
grant execute on function numa.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid, uuid) to authenticated;
grant execute on function numa.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Allocation link: multiple partial payments, idempotent, validates.
-- ---------------------------------------------------------------------------

drop function if exists numa.link_transaction_to_plan_item(uuid, uuid);
drop function if exists numa_internal.link_transaction_to_plan_item(uuid, uuid);

create or replace function numa_internal.link_transaction_to_plan_item(
  p_transaction_id uuid,
  p_item_id uuid,
  p_client_mutation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = numa, numa_internal, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tx numa.transactions%rowtype;
  v_item numa.plan_items%rowtype;
  v_account numa.accounts%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_amount bigint;
  v_remaining bigint;
  v_settled bigint;
  v_voided int := 0;
  v_cached jsonb;
  v_existing numa.plan_payment_allocations%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_client_mutation_id is not null then
    select result into v_cached
    from numa.mutation_keys
    where user_id = v_uid
      and mutation_id = p_client_mutation_id;
    if found then
      return v_cached;
    end if;
  end if;

  select * into v_tx
  from numa.transactions
  where id = p_transaction_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'transaction not found';
  end if;

  if v_tx.ledger_origin = 'plan_settle' or v_tx.plan_item_id is not null then
    raise exception 'cannot link a synthetic settlement row';
  end if;

  if v_tx.status <> 'confirmed' then
    raise exception 'transaction is not confirmed';
  end if;

  select * into v_item
  from numa.plan_items
  where id = p_item_id
    and user_id = v_uid
  for update;

  if not found then
    raise exception 'plan item not found';
  end if;

  select * into v_account
  from numa.accounts
  where id = v_tx.account_id
    and user_id = v_uid;
  if not found then
    raise exception 'account not found';
  end if;

  if v_tx.currency is distinct from v_item.currency then
    raise exception 'wrong currency';
  end if;

  if lower(coalesce(v_item.cadence, '')) = 'income' then
    if v_tx.direction <> 'credit' or v_tx.transaction_type <> 'income' then
      raise exception 'wrong direction';
    end if;
  else
    if v_tx.direction <> 'debit' or v_tx.transaction_type <> 'expense' then
      raise exception 'wrong direction';
    end if;
  end if;

  select * into v_existing
  from numa.plan_payment_allocations
  where plan_item_id = v_item.id
    and transaction_id = v_tx.id;

  if found then
    v_cached := jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'item', to_jsonb(v_item),
      'transaction_id', v_tx.id,
      'allocated_canonical_minor', v_existing.allocated_canonical_minor,
      'voided_synthetic', 0
    );
    if p_client_mutation_id is not null then
      insert into numa.mutation_keys (user_id, mutation_id, kind, result)
      values (v_uid, p_client_mutation_id, 'link', v_cached)
      on conflict (user_id, mutation_id) do nothing;
    end if;
    return v_cached;
  end if;

  update numa.transactions
  set status = 'voided', updated_at = v_now
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed';
  get diagnostics v_voided = row_count;

  v_amount := coalesce(v_tx.thb_minor, case when v_tx.currency = 'THB' then v_tx.amount_minor else null end);
  if v_amount is null then
    raise exception 'wrong currency';
  end if;

  v_remaining := v_item.amount_minor - numa_internal.plan_allocated_sum(v_uid, v_item.id);
  if v_amount > v_remaining then
    raise exception 'over allocation';
  end if;

  insert into numa.plan_payment_allocations (
    user_id, plan_item_id, transaction_id,
    allocated_canonical_minor, allocated_native_minor,
    currency, fx_rate, client_mutation_id, created_at
  ) values (
    v_uid, v_item.id, v_tx.id,
    v_amount, v_tx.amount_minor,
    v_tx.currency, coalesce(v_tx.fx_rate, 1),
    p_client_mutation_id, v_now
  );

  update numa.transactions
  set linked_plan_item_id = v_item.id, updated_at = v_now
  where id = v_tx.id
    and user_id = v_uid;

  v_settled := numa_internal.plan_allocated_sum(v_uid, v_item.id);

  update numa.plan_items
  set
    settled_at = case
      when v_settled >= v_item.amount_minor then coalesce(v_item.settled_at, v_now)
      else null
    end,
    settled_minor = case when v_settled > 0 then least(v_item.amount_minor, v_settled) else null end,
    remaining_due_at = case
      when v_settled > 0 and v_settled < v_item.amount_minor
        then coalesce(v_item.remaining_due_at, v_item.next_due_at)
      else null
    end,
    updated_at = v_now
  where id = v_item.id
    and user_id = v_uid
  returning * into v_item;

  v_cached := jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'item', to_jsonb(v_item),
    'transaction_id', v_tx.id,
    'allocated_canonical_minor', v_amount,
    'voided_synthetic', v_voided
  );

  if p_client_mutation_id is not null then
    insert into numa.mutation_keys (user_id, mutation_id, kind, result)
    values (v_uid, p_client_mutation_id, 'link', v_cached)
    on conflict (user_id, mutation_id) do nothing;
  end if;

  return v_cached;
end;
$$;

revoke all on function numa_internal.link_transaction_to_plan_item(uuid, uuid, uuid) from public;
grant execute on function numa_internal.link_transaction_to_plan_item(uuid, uuid, uuid) to authenticated;
grant execute on function numa_internal.link_transaction_to_plan_item(uuid, uuid, uuid) to service_role;

create or replace function numa.link_transaction_to_plan_item(
  p_transaction_id uuid,
  p_item_id uuid,
  p_client_mutation_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = numa, numa_internal, pg_temp
as $$
begin
  return numa_internal.link_transaction_to_plan_item(
    p_transaction_id, p_item_id, p_client_mutation_id
  );
end;
$$;

revoke all on function numa.link_transaction_to_plan_item(uuid, uuid, uuid) from public;
grant execute on function numa.link_transaction_to_plan_item(uuid, uuid, uuid) to authenticated;
grant execute on function numa.link_transaction_to_plan_item(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic plan write + ledger reconcile
-- ---------------------------------------------------------------------------

create or replace function numa_internal.reconcile_plan_settle_ledger(p_item numa.plan_items)
returns void
language plpgsql
security definer
set search_path = numa, numa_internal, pg_temp
as $$
declare
  v_target bigint := coalesce(p_item.settled_minor, 0);
begin
  if v_target < 0 then
    v_target := 0;
  end if;
  perform numa_internal.settle_plan_item(
    p_item.id,
    v_target > 0,
    v_target,
    p_item.remaining_due_at,
    null,
    null
  );
end;
$$;

create or replace function numa_internal.save_plan_item(
  p_id uuid,
  p_name text,
  p_kind text,
  p_amount_minor bigint,
  p_currency text,
  p_cadence text,
  p_next_due_at timestamptz,
  p_is_active boolean,
  p_settled_at timestamptz,
  p_settled_minor bigint,
  p_remaining_due_at timestamptz,
  p_sync_ledger boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = numa, numa_internal, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_item numa.plan_items%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_amount_minor is not null and p_amount_minor < 0 then
    raise exception 'Belopp kan inte vara negativt';
  end if;

  if p_id is null then
    insert into numa.plan_items (
      user_id, name, kind, amount_minor, currency, cadence,
      next_due_at, is_active, settled_at, settled_minor, remaining_due_at,
      created_at, updated_at
    ) values (
      v_uid, btrim(p_name), p_kind, p_amount_minor, p_currency,
      coalesce(p_cadence, 'monthly'), p_next_due_at,
      coalesce(p_is_active, true), p_settled_at, p_settled_minor,
      p_remaining_due_at, v_now, v_now
    )
    returning * into v_item;
  else
    select * into v_item
    from numa.plan_items
    where id = p_id and user_id = v_uid
    for update;
    if not found then
      raise exception 'plan item not found';
    end if;

    update numa.plan_items
    set
      name = coalesce(nullif(btrim(p_name), ''), name),
      kind = coalesce(p_kind, kind),
      amount_minor = coalesce(p_amount_minor, amount_minor),
      currency = coalesce(p_currency, currency),
      cadence = coalesce(p_cadence, cadence),
      next_due_at = case when p_next_due_at is null and p_id is not null
        then next_due_at else coalesce(p_next_due_at, next_due_at) end,
      is_active = coalesce(p_is_active, is_active),
      settled_at = case when p_settled_at is null and p_settled_minor is null
        then settled_at else p_settled_at end,
      settled_minor = case when p_settled_minor is null and p_settled_at is null
        then settled_minor else p_settled_minor end,
      remaining_due_at = case
        when p_remaining_due_at is null
          and p_settled_at is null
          and p_settled_minor is null
        then remaining_due_at
        else p_remaining_due_at
      end,
      updated_at = v_now
    where id = p_id and user_id = v_uid
    returning * into v_item;
  end if;

  if p_sync_ledger and coalesce(v_item.settled_minor, 0) >= 0 then
    perform numa_internal.reconcile_plan_settle_ledger(v_item);
    select * into v_item from numa.plan_items where id = v_item.id;
  end if;

  return jsonb_build_object('ok', true, 'item', to_jsonb(v_item));
end;
$$;

create or replace function numa.save_plan_item(
  p_id uuid,
  p_name text,
  p_kind text,
  p_amount_minor bigint,
  p_currency text,
  p_cadence text,
  p_next_due_at timestamptz,
  p_is_active boolean,
  p_settled_at timestamptz,
  p_settled_minor bigint,
  p_remaining_due_at timestamptz,
  p_sync_ledger boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = numa, numa_internal, pg_temp
as $$
begin
  return numa_internal.save_plan_item(
    p_id, p_name, p_kind, p_amount_minor, p_currency, p_cadence,
    p_next_due_at, p_is_active, p_settled_at, p_settled_minor,
    p_remaining_due_at, p_sync_ledger
  );
end;
$$;

revoke all on function numa_internal.save_plan_item(uuid, text, text, bigint, text, text, timestamptz, boolean, timestamptz, bigint, timestamptz, boolean) from public;
grant execute on function numa_internal.save_plan_item(uuid, text, text, bigint, text, text, timestamptz, boolean, timestamptz, bigint, timestamptz, boolean) to authenticated;
grant execute on function numa_internal.save_plan_item(uuid, text, text, bigint, text, text, timestamptz, boolean, timestamptz, bigint, timestamptz, boolean) to service_role;
grant execute on function numa.save_plan_item(uuid, text, text, bigint, text, text, timestamptz, boolean, timestamptz, bigint, timestamptz, boolean) to authenticated;
grant execute on function numa.save_plan_item(uuid, text, text, bigint, text, text, timestamptz, boolean, timestamptz, bigint, timestamptz, boolean) to service_role;

create or replace function numa_internal.delete_plan_item(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = numa, numa_internal, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update numa.transactions
  set status = 'voided', updated_at = v_now
  where user_id = v_uid
    and plan_item_id = p_id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed';

  delete from numa.plan_payment_allocations
  where user_id = v_uid
    and plan_item_id = p_id;

  update numa.plan_items
  set is_active = false, updated_at = v_now
  where id = p_id
    and user_id = v_uid;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function numa.delete_plan_item(p_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = numa, numa_internal, pg_temp
as $$
begin
  return numa_internal.delete_plan_item(p_id);
end;
$$;

revoke all on function numa_internal.delete_plan_item(uuid) from public;
grant execute on function numa_internal.delete_plan_item(uuid) to authenticated;
grant execute on function numa_internal.delete_plan_item(uuid) to service_role;
grant execute on function numa.delete_plan_item(uuid) to authenticated;
grant execute on function numa.delete_plan_item(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 30-day observation image purge
-- ---------------------------------------------------------------------------

create or replace function numa_internal.purge_expired_source_images(
  p_now timestamptz default timezone('utc', now()),
  p_retention_days int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = numa, numa_internal, pg_temp
as $$
declare
  v_cutoff timestamptz := p_now - make_interval(days => p_retention_days);
  v_count int := 0;
begin
  update numa.source_observations
  set
    storage_path = null,
    notes = coalesce(notes, '') || case
      when notes is null or notes = '' then 'Bild raderad efter 30 dagar'
      else ' · Bild raderad efter 30 dagar'
    end,
    updated_at = p_now
  where storage_path is not null
    and captured_at <= v_cutoff;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'purged', v_count, 'cutoff', v_cutoff);
end;
$$;

create or replace function numa.purge_expired_source_images(
  p_now timestamptz default timezone('utc', now()),
  p_retention_days int default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = numa, numa_internal, pg_temp
as $$
begin
  -- Invoker wrapper is for service-role / cron. Authenticated users cannot
  -- purge other people's images — the internal fn has no user filter by
  -- design (retention is global). Only service_role should call this.
  if auth.role() is distinct from 'service_role' then
    raise exception 'not allowed';
  end if;
  return numa_internal.purge_expired_source_images(p_now, p_retention_days);
end;
$$;

revoke all on function numa.purge_expired_source_images(timestamptz, int) from public;
grant execute on function numa.purge_expired_source_images(timestamptz, int) to service_role;
grant execute on function numa_internal.purge_expired_source_images(timestamptz, int) to service_role;
