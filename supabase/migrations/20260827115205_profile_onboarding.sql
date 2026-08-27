-- First-run onboarding for admin-created users.
-- Owner RLS on numa.profiles already allows users to update their own row.

alter table numa.profiles
  add column if not exists onboarding_saldo_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

comment on column numa.profiles.onboarding_saldo_at is
  'Set when the user saves a starting saldo during first-run onboarding.';
comment on column numa.profiles.onboarding_completed_at is
  'Set when first-run onboarding is finished (plan step done or skipped).';
