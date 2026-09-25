-- Ångra must clear the chip even if a bank row is still linked.
-- A smaller linked payment must not downgrade Betald to Delvis.

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

  -- Ångra is a user tap. Linked bank cash must not resurrect Delvis.
  if not p_settled then
    v_target := 0;
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
  v_settled bigint;
  v_settled_before bigint;
  v_allocated_before bigint;
  v_replace boolean;
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

  v_amount := coalesce(v_tx.thb_minor, case when v_tx.currency = 'THB' then v_tx.amount_minor else null end);
  if v_amount is null then
    raise exception 'wrong currency';
  end if;

  v_allocated_before := numa_internal.plan_allocated_sum(v_uid, v_item.id);
  v_settled_before := case
    when v_item.settled_minor is not null then v_item.settled_minor
    when v_item.settled_at is not null then v_item.amount_minor
    else 0
  end;
  v_replace := (v_item.amount_minor - v_settled_before) <= 0;

  if v_replace then
    if v_amount > (v_item.amount_minor - v_allocated_before) then
      raise exception 'over allocation';
    end if;
  elsif v_amount > (v_item.amount_minor - v_settled_before) then
    raise exception 'over allocation';
  end if;

  if v_replace then
    update numa.transactions
    set status = 'voided', updated_at = v_now
    where user_id = v_uid
      and plan_item_id = v_item.id
      and ledger_origin = 'plan_settle'
      and status = 'confirmed';
    get diagnostics v_voided = row_count;
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

  if v_replace then
    -- Keep Betald when a smaller bank row is linked. Över still uses allocated.
    v_settled := greatest(v_settled_before, numa_internal.plan_allocated_sum(v_uid, v_item.id));
  else
    v_settled := least(v_item.amount_minor, v_settled_before + v_amount);
  end if;

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
