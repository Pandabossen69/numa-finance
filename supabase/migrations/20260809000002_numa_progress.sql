-- NUMA progress foundation (multi-user ready, leaderboard-safe fields only)
-- Private finance stays in accounts/transactions. This layer stores discipline progress.

create table if not exists numa.user_progress (
  user_id uuid primary key references numa.profiles (id) on delete cascade,
  level integer not null default 1 check (level >= 1),
  rank_id text not null default 'start',
  on_track_days integer not null default 0 check (on_track_days >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  -- Relative discipline score for future global ranking (not wealth).
  discipline_score integer not null default 0 check (discipline_score >= 0),
  -- Opt-in later for appearing on public leaderboards.
  leaderboard_visible boolean not null default false,
  display_name_public text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table numa.user_progress is
  'Personal game progress. Safe fields for future global rank; never store balances here.';

create table if not exists numa.progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references numa.profiles (id) on delete cascade,
  event_type text not null,
  delta_score integer not null default 0,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists numa_progress_events_user_created_idx
  on numa.progress_events (user_id, created_at desc);

-- Future leaderboard reads can order by discipline_score where leaderboard_visible.
create index if not exists numa_user_progress_leaderboard_idx
  on numa.user_progress (discipline_score desc, updated_at desc)
  where leaderboard_visible = true;

alter table numa.user_progress enable row level security;
alter table numa.progress_events enable row level security;

drop policy if exists numa_user_progress_owner_all on numa.user_progress;
create policy numa_user_progress_owner_all on numa.user_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists numa_progress_events_owner_all on numa.progress_events;
create policy numa_progress_events_owner_all on numa.progress_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on numa.user_progress to authenticated;
grant select, insert, update, delete on numa.progress_events to authenticated;
grant all on numa.user_progress to service_role;
grant all on numa.progress_events to service_role;

-- Ensure a progress row exists when a NUMA profile is created.
create or replace function numa.ensure_user_progress()
returns trigger
language plpgsql
security definer
set search_path = numa, public
as $$
begin
  insert into numa.user_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists numa_profiles_ensure_progress on numa.profiles;
create trigger numa_profiles_ensure_progress
  after insert on numa.profiles
  for each row execute function numa.ensure_user_progress();
