-- «Betala senare»: when the owner plans to pay this occurrence.
-- The plan month stays next_due_at. Null means use next_due_at.
-- RLS is unchanged (numa_plan_items_owner_all already covers the row).

alter table numa.plan_items
  add column if not exists planned_pay_at timestamptz;

comment on column numa.plan_items.planned_pay_at is
  'When the owner plans to pay this occurrence. Null = next_due_at. Does not change the plan month.';
