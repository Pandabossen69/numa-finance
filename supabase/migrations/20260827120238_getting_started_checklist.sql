-- Dismissible Kom igång checklist on Hem. Owner RLS already covers profile updates.

alter table numa.profiles
  add column if not exists getting_started_completed_at timestamptz,
  add column if not exists getting_started_collapsed boolean not null default false;

comment on column numa.profiles.getting_started_completed_at is
  'Set when the Kom igång checklist is finished or dismissed after all steps have data.';
comment on column numa.profiles.getting_started_collapsed is
  'True when the user minimized Kom igång to the restore chip.';
