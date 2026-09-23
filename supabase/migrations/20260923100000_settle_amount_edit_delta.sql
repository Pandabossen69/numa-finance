-- QA on plan item 99c4ef7a-1e8e-4ea3-916e-f905300649ae «Dator»:
-- Betald wrote a 44k plan_settle row, then the amount edit voided it and
-- inserted a confirmed 45k row at the same timestamp. Rörelser hid the void
-- and showed one −45k (ledger list was right). På kontona already included
-- the −44k, and the new row applied −45k again. saldo_delta must be
-- −(new−old) only.
--
-- Confirmed plan_settle rows are the settled amount. Rows dated before the
-- latest checkpoint stay as they are (they are already in that balance).
-- The open window — on or after the checkpoint — is only the difference.
-- A booking that is still inside the window is updated in place and keeps
-- its occurred_at, so a later checkpoint cannot see the full price twice.
--
-- The one-row unique index blocked the frozen payment plus its delta.
-- settle_plan_item locks the plan row first, so two taps cannot both insert.

drop index if exists numa.numa_transactions_one_settle_per_plan;
drop index if exists public.numa_transactions_one_settle_per_plan;

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
  v_already_native bigint := 0;
  v_after_native bigint := 0;
  v_booked_thb bigint := 0;
  v_booked_native bigint := 0;
  v_window_native bigint := 0;
  v_fx numeric;
  v_is_income boolean := false;
  v_direction numa.transaction_direction;
  v_tx_type numa.transaction_type;
  v_old_synth numa.transactions%rowtype;
  v_keeper numa.transactions%rowtype;
  v_has_keeper boolean := false;
  v_keeper_matches boolean := false;
  v_checkpoint_at timestamptz;
  v_frozen_thb bigint := 0;
  v_desired_window bigint := 0;
  v_magnitude bigint := 0;
  v_new_id uuid;
  v_new_settled_at timestamptz;
  v_new_settled_minor bigint;
  v_new_remaining timestamptz;
  v_saldo_delta_thb bigint := 0;
  v_saldo_delta_native bigint := 0;
  v_cached jsonb;
  v_label text;
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

  v_is_income := lower(coalesce(v_item.cadence, '')) = 'income';
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

  if found and v_account.id is null then
    select * into v_account
    from numa.accounts
    where id = v_old_synth.account_id
      and user_id = v_uid;
  end if;

  if v_account.id is not null then
    select c.verified_at into v_checkpoint_at
    from numa.balance_checkpoints c
    where c.user_id = v_uid
      and c.account_id = v_account.id
    order by c.verified_at desc
    limit 1;
  end if;

  select coalesce(sum(
    case
      when (v_is_income and direction = 'credit')
        or (not v_is_income and direction = 'debit')
      then coalesce(thb_minor, amount_minor)
      else -coalesce(thb_minor, amount_minor)
    end
  ), 0)
  into v_already_booked_thb
  from numa.transactions
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed';

  select coalesce(sum(
    case
      when (v_is_income and direction = 'credit')
        or (not v_is_income and direction = 'debit')
      then amount_minor
      else -amount_minor
    end
  ), 0)
  into v_already_native
  from numa.transactions
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed';

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

  v_frozen_thb := 0;
  if v_checkpoint_at is not null then
    select coalesce(sum(
      case
        when (v_is_income and direction = 'credit')
          or (not v_is_income and direction = 'debit')
        then coalesce(thb_minor, amount_minor)
        else -coalesce(thb_minor, amount_minor)
      end
    ), 0)
    into v_frozen_thb
    from numa.transactions
    where user_id = v_uid
      and plan_item_id = v_item.id
      and ledger_origin = 'plan_settle'
      and status = 'confirmed'
      and occurred_at < v_checkpoint_at;
  end if;

  v_desired_window := v_synth_target - v_frozen_thb;

  select * into v_keeper
  from numa.transactions
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed'
    and (v_checkpoint_at is null or occurred_at >= v_checkpoint_at)
  order by occurred_at desc
  limit 1
  for update;
  v_has_keeper := found;

  v_keeper_matches := v_has_keeper
    and v_desired_window > 0
    and (
      (v_is_income and v_keeper.direction = 'credit' and v_keeper.transaction_type = 'income')
      or (not v_is_income and v_keeper.direction = 'debit' and v_keeper.transaction_type = 'expense')
    );

  -- Never void a booking that is already inside the checkpoint.
  update numa.transactions
  set status = 'voided', updated_at = v_now
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed'
    and (v_checkpoint_at is null or occurred_at >= v_checkpoint_at)
    and (
      not v_keeper_matches
      or id is distinct from v_keeper.id
    );

  v_label := coalesce(nullif(btrim(v_item.name), ''), 'Planpost');

  if v_desired_window <> 0 then
    v_magnitude := abs(v_desired_window);
    if v_desired_window > 0 then
      if v_is_income then
        v_direction := 'credit';
        v_tx_type := 'income';
      else
        v_direction := 'debit';
        v_tx_type := 'expense';
      end if;
    else
      if v_is_income then
        v_direction := 'debit';
        v_tx_type := 'adjustment';
      else
        v_direction := 'credit';
        v_tx_type := 'adjustment';
      end if;
    end if;

    if v_keeper_matches then
      v_fx := case
        when v_keeper.currency = 'THB' then 1
        else coalesce(v_keeper.fx_rate, numa_internal.account_fx_rate(v_account))
      end;
      if v_keeper.currency <> 'THB' and (v_fx is null or v_fx <= 0) then
        raise exception 'account has no exchange rate';
      end if;
      if v_keeper.currency = 'THB' then
        v_window_native := v_magnitude;
      else
        v_window_native := round(v_magnitude / v_fx);
      end if;
      update numa.transactions
      set
        amount_minor = v_window_native,
        thb_minor = v_magnitude,
        fx_rate = v_fx,
        description = v_label,
        merchant = nullif(btrim(v_item.name), ''),
        updated_at = v_now
      where id = v_keeper.id
        and user_id = v_uid;
    else
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
        v_window_native := v_magnitude;
      else
        v_window_native := round(v_magnitude / v_fx);
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
        v_window_native, v_account.currency, v_magnitude, v_fx, v_now, 'settlement',
        v_now,
        v_label,
        nullif(btrim(v_item.name), ''),
        'manual', 'confirmed', 'synced',
        v_item.id, 'plan_settle', null,
        p_client_mutation_id, v_now, v_now
      );
    end if;
  end if;

  select coalesce(sum(
    case
      when (v_is_income and direction = 'credit')
        or (not v_is_income and direction = 'debit')
      then amount_minor
      else -amount_minor
    end
  ), 0)
  into v_after_native
  from numa.transactions
  where user_id = v_uid
    and plan_item_id = v_item.id
    and ledger_origin = 'plan_settle'
    and status = 'confirmed';

  if v_is_income then
    v_saldo_delta_thb := v_synth_target - v_already_booked_thb;
    v_saldo_delta_native := v_after_native - v_already_native;
  else
    v_saldo_delta_thb := -(v_synth_target - v_already_booked_thb);
    v_saldo_delta_native := -(v_after_native - v_already_native);
  end if;

  v_booked_thb := v_synth_target;
  if v_synth_target > 0 and v_account.id is not null then
    v_fx := numa_internal.account_fx_rate(v_account);
    if v_account.currency = 'THB' or v_fx is null or v_fx <= 0 then
      v_booked_native := v_synth_target;
    else
      v_booked_native := round(v_synth_target / v_fx);
    end if;
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
