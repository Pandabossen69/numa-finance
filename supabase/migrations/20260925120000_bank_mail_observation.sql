-- Spec Y step 1: Bangkok Bank notification mail enters the same confirmation
-- queue as screenshots (source_observations → extraction_runs → candidates).
-- NUMA Data applies this file. Do not run it against a shared database from
-- the app or from a laptop that is pointed at production.
--
-- Postgres 12+ allows ADD VALUE inside a migration transaction, but the new
-- enum value cannot be used until this migration commits. This file only
-- adds the value and dedupe indexes; it does not insert rows.

alter type numa.observation_kind add value if not exists 'bank_mail';

alter table numa.source_observations
  add column if not exists external_message_id text,
  add column if not exists bank_reference text;

comment on column numa.source_observations.external_message_id is
  'RFC Message-ID for a bank notification mail. Dedupes a repost of the same mail.';

comment on column numa.source_observations.bank_reference is
  'Bangkok Bank Reference no. from the payment-confirmation mail. Dedupes a second copy of the same payment.';

create unique index if not exists numa_source_observations_user_message_id_unique
  on numa.source_observations (user_id, external_message_id)
  where external_message_id is not null;

create unique index if not exists numa_source_observations_user_bank_reference_unique
  on numa.source_observations (user_id, bank_reference)
  where bank_reference is not null;
