-- Manual Klar: mark a plan occurrence as paid (expense) or received (income)
-- without deleting the row. Independent of ledger matching.
alter table numa.plan_items
  add column if not exists settled_at timestamptz;

comment on column numa.plan_items.settled_at is
  'When the user marked this occurrence Klar (paid/received). Null = still open.';
