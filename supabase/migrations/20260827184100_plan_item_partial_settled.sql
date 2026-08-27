-- Delvis klar: amount already received/paid, plus when the remainder is due.
alter table numa.plan_items
  add column if not exists settled_minor bigint,
  add column if not exists remaining_due_at timestamptz;

comment on column numa.plan_items.settled_minor is
  'Amount already received/paid on this occurrence (minor units). Null = nothing marked unless settled_at is set.';

comment on column numa.plan_items.remaining_due_at is
  'When the remaining amount after Delvis klar is expected. Null = use next_due_at.';
