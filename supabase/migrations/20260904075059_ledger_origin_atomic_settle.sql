-- Explicit ledger origin + plan link, plus atomic settlement.
-- plan_item_id remains the synthetic-settle marker only.
-- linked_plan_item_id is a user-confirmed link on a real (external) row.
-- Account balances are derived from checkpoints + ledger — this RPC never
-- writes a stored running balance.

alter table numa.transactions
  add column if not exists ledger_origin text not null default 'external';

alter table numa.transactions
  drop constraint if exists numa_transactions_ledger_origin_check;

alter table numa.transactions
  add constraint numa_transactions_ledger_origin_check
  check (ledger_origin in ('external', 'plan_settle'));

alter table numa.transactions
  add column if not exists linked_plan_item_id uuid
    references numa.plan_items (id) on delete set null;

update numa.transactions
set ledger_origin = 'plan_settle'
where plan_item_id is not null
  and ledger_origin is distinct from 'plan_settle';

create index if not exists numa_transactions_linked_plan_item_idx
  on numa.transactions (user_id, linked_plan_item_id)
  where linked_plan_item_id is not null;

create unique index if not exists numa_transactions_one_confirmed_link_per_plan
  on numa.transactions (user_id, linked_plan_item_id)
  where linked_plan_item_id is not null
    and status = 'confirmed';

grant usage on schema numa_internal to authenticated;

-- ---------------------------------------------------------------------------
-- Internal atomic settlement. SECURITY DEFINER lives in numa_internal.
-- ---------------------------------------------------------------------------

create or replace function numa_internal.settle_plan_item(
  p_item_id uuid,
  p_settled boolean,
  p_target_settled_minor bigint default null,
  p_remaining_due_at timestamptz default null,
  p_account_id uuid default null
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
  v_already_booked bigint := 0;
  v_booked bigint := 0;
  v_skip_book boolean := false;
  v_kind text;
  v_direction numa.transaction_direction;
  v_tx_type numa.transaction_type;
  v_old_synth numa.transactions%rowtype;
  v_new_id uuid;
  v_new_settled_at timestamptz;
  v_new_settled_minor bigint;
  v_new_remaining timestamptz;
  v_saldo_delta bigint := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
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

  if not p_settled then
    v_target := 0;
  elsif p_target_settled_minor is null then
    v_target := v_amount;
  else
    v_target := greatest(0, least(v_amount, p_target_settled_minor));
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
    -- Delvis: settled_at stays null; remaining date is the rest.
    v_new_settled_at := null;
    v_new_settled_minor := v_target;
    v_new_remaining := coalesce(p_remaining_due_at, v_item.remaining_due_at, v_item.next_due_at);
  end if;

  if coalesce(v_item.settled_minor, 0) = coalesce(v_new_settled_minor, 0)
     and v_item.settled_at is not distinct from v_new_settled_at
     and v_item.remaining_due_at is not distinct from v_new_remaining
  then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'item', to_jsonb(v_item),
      'booked_minor', 0,
      'saldo_delta', 0,
      'account_id', null,
      'skipped_because_funded', false
    );
  end if;

  -- A confirmed external row already linked to this item means the user
  -- booked the payment themselves. Never also write a synthetic settle.
  if exists (
    select 1
    from numa.transactions t
    where t.user_id = v_uid
      and t.linked_plan_item_id = v_item.id
      and t.status = 'confirmed'
      and t.ledger_origin = 'external'
  ) then
    v_skip_book := true;
  end if;

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
    v_already_booked := v_old_synth.amount_minor;
    if v_account.id is null then
      select * into v_account
      from numa.accounts
      where id = v_old_synth.account_id
        and user_id = v_uid;
    end if;
  end if;

  update numa.transactions
  set
    status = 'voided',
    updated_at = v_now
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed';

  if not v_skip_book and v_target > 0 then
    if v_account.id is null then
      raise exception 'no account for settlement booking';
    end if;

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
      id,
      user_id,
      account_id,
      direction,
      transaction_type,
      amount_minor,
      currency,
      occurred_at,
      description,
      merchant,
      source,
      status,
      sync_status,
      plan_item_id,
      ledger_origin,
      linked_plan_item_id,
      created_at,
      updated_at
    ) values (
      v_new_id,
      v_uid,
      v_account.id,
      v_direction,
      v_tx_type,
      v_target,
      v_account.currency,
      v_now,
      coalesce(nullif(btrim(v_item.name), ''), 'Planpost'),
      nullif(btrim(v_item.name), ''),
      'manual',
      'confirmed',
      'synced',
      v_item.id,
      'plan_settle',
      null,
      v_now,
      v_now
    );

    v_booked := v_target;
  end if;

  if v_skip_book then
    v_booked := 0;
    v_saldo_delta := 0;
  elsif v_kind = 'income' or lower(coalesce(v_item.cadence, '')) = 'income' then
    v_saldo_delta := v_booked - v_already_booked;
  else
    v_saldo_delta := -(v_booked - v_already_booked);
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

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'item', to_jsonb(v_item),
    'booked_minor', v_booked,
    'saldo_delta', v_saldo_delta,
    'account_id', v_account.id,
    'skipped_because_funded', v_skip_book
  );
end;
$$;

revoke all on function numa_internal.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid) from public;
grant execute on function numa_internal.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid) to authenticated;
grant execute on function numa_internal.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid) to service_role;

create or replace function numa.settle_plan_item(
  p_item_id uuid,
  p_settled boolean,
  p_target_settled_minor bigint default null,
  p_remaining_due_at timestamptz default null,
  p_account_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = numa, numa_internal, pg_temp
as $$
begin
  return numa_internal.settle_plan_item(
    p_item_id,
    p_settled,
    p_target_settled_minor,
    p_remaining_due_at,
    p_account_id
  );
end;
$$;

revoke all on function numa.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid) from public;
grant execute on function numa.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid) to authenticated;
grant execute on function numa.settle_plan_item(uuid, boolean, bigint, timestamptz, uuid) to service_role;

-- Confirm an imported/manual row as payment for a plan item.
create or replace function numa_internal.link_transaction_to_plan_item(
  p_transaction_id uuid,
  p_item_id uuid
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
  v_now timestamptz := timezone('utc', now());
  v_target bigint;
  v_already bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
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

  -- Void any synthetic booking for this item so we never double-count.
  update numa.transactions
  set status = 'voided', updated_at = v_now
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed';

  update numa.transactions
  set
    linked_plan_item_id = v_item.id,
    updated_at = v_now
  where id = v_tx.id
    and user_id = v_uid;

  v_already := coalesce(v_item.settled_minor, 0);
  v_target := least(v_item.amount_minor, v_already + v_tx.amount_minor);

  update numa.plan_items
  set
    settled_at = case
      when v_target >= v_item.amount_minor then coalesce(v_item.settled_at, v_now)
      else null
    end,
    settled_minor = case when v_target > 0 then v_target else null end,
    remaining_due_at = case
      when v_target > 0 and v_target < v_item.amount_minor
        then coalesce(v_item.remaining_due_at, v_item.next_due_at)
      else null
    end,
    updated_at = v_now
  where id = v_item.id
    and user_id = v_uid
  returning * into v_item;

  return jsonb_build_object(
    'ok', true,
    'item', to_jsonb(v_item),
    'transaction_id', v_tx.id
  );
end;
$$;

revoke all on function numa_internal.link_transaction_to_plan_item(uuid, uuid) from public;
grant execute on function numa_internal.link_transaction_to_plan_item(uuid, uuid) to authenticated;
grant execute on function numa_internal.link_transaction_to_plan_item(uuid, uuid) to service_role;

create or replace function numa.link_transaction_to_plan_item(
  p_transaction_id uuid,
  p_item_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = numa, numa_internal, pg_temp
as $$
begin
  return numa_internal.link_transaction_to_plan_item(p_transaction_id, p_item_id);
end;
$$;

revoke all on function numa.link_transaction_to_plan_item(uuid, uuid) from public;
grant execute on function numa.link_transaction_to_plan_item(uuid, uuid) to authenticated;
grant execute on function numa.link_transaction_to_plan_item(uuid, uuid) to service_role;
