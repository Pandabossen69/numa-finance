-- Additional external payments after Delvis must not void the synthetic
-- remainder. Only a fully settled (Klar) row replaces synthetics on link.

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
    v_settled := numa_internal.plan_allocated_sum(v_uid, v_item.id);
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
