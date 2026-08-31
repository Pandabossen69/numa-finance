-- Link a plan settle (Mottagen / Betald / Delvis) to at most one confirmed
-- ledger row so Hem saldo moves with the tap, and Ångra can reverse it.
-- Real bank/SMS rows never get this FK — only the synthetic settle write.

alter table numa.transactions
  add column if not exists plan_item_id uuid
    references numa.plan_items (id) on delete set null;

create index if not exists numa_transactions_plan_item_idx
  on numa.transactions (user_id, plan_item_id)
  where plan_item_id is not null and status <> 'voided';

-- One live settle booking per plan row. Parallel Mottagen taps cannot
-- insert two credits. Undo voids the row; a later tap may insert again.
create unique index if not exists numa_transactions_one_settle_per_plan
  on numa.transactions (plan_item_id)
  where plan_item_id is not null and status = 'confirmed';

comment on column numa.transactions.plan_item_id is
  'Synthetic settle booking for this plan occurrence. Null for bank/SMS/manual rows. Void-only — never edit a bank row via this link.';
