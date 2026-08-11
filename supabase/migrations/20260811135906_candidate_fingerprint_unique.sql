-- Prevent the same Bangkok Bank SMS fingerprint from sitting twice as an
-- active candidate (needs_review / confirmed / duplicate). Rejected/voided
-- statuses can keep history without blocking.
create unique index if not exists numa_candidates_user_fingerprint_unique
  on numa.extracted_transaction_candidates (user_id, fingerprint)
  where fingerprint is not null
    and status in ('pending', 'needs_review', 'confirmed', 'duplicate');
