-- NUMA: admin-created users only.
-- Move security-definer helpers out of the exposed `numa` schema,
-- revoke PUBLIC/anon EXECUTE, keep profile creation on Auth insert,
-- and reaffirm owner-only RLS.

create schema if not exists numa_internal;

comment on schema numa_internal is
  'Private NUMA helpers (security definer). Not exposed on the Data API.';

revoke all on schema numa_internal from public;
revoke all on schema numa_internal from anon, authenticated;
grant usage on schema numa_internal to postgres, supabase_auth_admin, service_role;
grant all on schema numa_internal to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Auth hook: empty numa.profiles row for every new Auth user (admin create
-- and any leftover public signup). Defaults: Användare / Asia/Bangkok / THB.
-- ---------------------------------------------------------------------------

create or replace function numa_internal.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = numa, pg_temp
as $$
begin
  insert into numa.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Användare')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function numa_internal.handle_new_user() from public;
revoke execute on function numa_internal.handle_new_user() from anon, authenticated;
grant execute on function numa_internal.handle_new_user()
  to postgres, supabase_auth_admin, service_role;

drop trigger if exists numa_on_auth_user_created on auth.users;
create trigger numa_on_auth_user_created
  after insert on auth.users
  for each row execute function numa_internal.handle_new_user();

drop function if exists numa.handle_new_user();

-- Progress helper lives in the progress migration; move it if present.
do $$
begin
  if to_regprocedure('numa.ensure_user_progress()') is not null
     and to_regclass('numa.user_progress') is not null then
    execute $fn$
      create or replace function numa_internal.ensure_user_progress()
      returns trigger
      language plpgsql
      security definer
      set search_path = numa, pg_temp
      as $body$
      begin
        insert into numa.user_progress (user_id)
        values (new.id)
        on conflict (user_id) do nothing;
        return new;
      end;
      $body$;
    $fn$;
    execute 'revoke all on function numa_internal.ensure_user_progress() from public';
    execute 'revoke execute on function numa_internal.ensure_user_progress() from anon, authenticated';
    execute 'grant execute on function numa_internal.ensure_user_progress() to postgres, service_role';
    execute 'drop trigger if exists numa_profiles_ensure_progress on numa.profiles';
    execute 'create trigger numa_profiles_ensure_progress after insert on numa.profiles for each row execute function numa_internal.ensure_user_progress()';
    execute 'drop function if exists numa.ensure_user_progress()';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: every table in numa, owner-only policies (auth.uid()).
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'numa' and c.relkind = 'r'
  loop
    execute format('alter table numa.%I enable row level security', r.relname);
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'numa' and c.relkind = 'v'
  loop
    execute format('alter view numa.%I set (security_invoker = true)', r.relname);
  end loop;
end $$;

-- Anon must not read/write NUMA tables even if a policy were mis-set.
revoke select, insert, update, delete on all tables in schema numa from anon;
alter default privileges in schema numa
  revoke select, insert, update, delete on tables from anon;

-- Reaffirm owner policies (idempotent). Profiles use id, not user_id.
drop policy if exists numa_profiles_select_own on numa.profiles;
drop policy if exists numa_profiles_update_own on numa.profiles;
drop policy if exists numa_profiles_insert_own on numa.profiles;
create policy numa_profiles_select_own on numa.profiles
  for select using (auth.uid() = id);
create policy numa_profiles_update_own on numa.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
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

do $$
begin
  if to_regclass('numa.user_progress') is not null then
    execute 'alter table numa.user_progress enable row level security';
    execute 'drop policy if exists numa_user_progress_owner_all on numa.user_progress';
    execute 'create policy numa_user_progress_owner_all on numa.user_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
  if to_regclass('numa.progress_events') is not null then
    execute 'alter table numa.progress_events enable row level security';
    execute 'drop policy if exists numa_progress_events_owner_all on numa.progress_events';
    execute 'create policy numa_progress_events_owner_all on numa.progress_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;
end $$;
