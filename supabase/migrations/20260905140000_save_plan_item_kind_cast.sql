-- Fix save_plan_item INSERT/UPDATE: p_kind and p_currency arrive as text
-- from PostgREST, but plan_items.kind/currency are enums. Postgres rejects
-- the implicit assignment and COALESCE(text, enum). Cast after validating
-- against the live enum so invalid values raise a short Swedish error.

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
  v_kind numa.plan_category_kind;
  v_currency numa.currency_code;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_amount_minor is not null and p_amount_minor < 0 then
    raise exception 'Belopp kan inte vara negativt';
  end if;

  if p_kind is not null and btrim(p_kind) <> '' then
    begin
      v_kind := btrim(p_kind)::numa.plan_category_kind;
    exception
      when invalid_text_representation then
        raise exception 'Ogiltig plantyp';
    end;
  elsif p_id is null then
    raise exception 'Ogiltig plantyp';
  end if;

  if p_currency is not null and btrim(p_currency) <> '' then
    begin
      v_currency := btrim(p_currency)::numa.currency_code;
    exception
      when invalid_text_representation then
        raise exception 'Ogiltig valuta';
    end;
  elsif p_id is null then
    raise exception 'Ogiltig valuta';
  end if;

  if p_id is null then
    insert into numa.plan_items (
      user_id, name, kind, amount_minor, currency, cadence,
      next_due_at, is_active, settled_at, settled_minor, remaining_due_at,
      created_at, updated_at
    ) values (
      v_uid, btrim(p_name), v_kind, p_amount_minor, v_currency,
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
      kind = coalesce(v_kind, kind),
      amount_minor = coalesce(p_amount_minor, amount_minor),
      currency = coalesce(v_currency, currency),
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
