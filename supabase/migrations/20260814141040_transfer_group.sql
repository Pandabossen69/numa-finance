-- Pair transfer / cash_withdrawal legs so both sides share one group id.
-- Enables atomic multi-row inserts and exact void of the sibling leg.

alter table numa.transactions
  add column if not exists transfer_group_id uuid;

create index if not exists numa_transactions_transfer_group_idx
  on numa.transactions (user_id, transfer_group_id)
  where transfer_group_id is not null;

comment on column numa.transactions.transfer_group_id is
  'Shared id for debit+credit legs of a transfer or cash_withdrawal';
