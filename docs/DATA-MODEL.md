# Data model

## Core entities

### profiles
User settings: timezone, primary/reference currency.

### accounts
Named financial accounts with currency, institution, masked identifier, active/default flags.
No hardcoded bank list.

### balance_checkpoints
Verified external balance observations (SMS, manual verification, import).
Forward calculation starts from the latest checkpoint.

### transactions (canonical)
Confirmed financial events. Amounts in minor units. Optional fingerprint for idempotency.
Optional `balance_after_minor` when bank-reported.

### source_observations
Screenshots, receipts, SMS captures, etc. **Not** 1:1 with transactions.

### extraction_runs
One processing attempt against an observation.

### extracted_transaction_candidates
Structured proposals with confidence + fingerprint. Status machine includes `needs_review`, `duplicate`, `confirmed`.

### transaction_observation_links
Many observations may evidence one canonical transaction.

### fx_conversions
Preserves original amount, rate, converted amount, timestamp, source.

### reconciliation_issues
Discrepancies between expected calculated balance and newly observed bank balance. Never silent overwrite.

### plan_items
Monthly planning buckets (mandatory / expected / flexible / goal / buffer).
Active totals feed reserved + buffer into safe-to-spend. Optional `next_due_at`
(especially the “Nästa inkomst” row) sets runway days.

## Deduplication philosophy

Never dedupe by amount alone.

Prefer high-confidence fingerprints including:

- institution
- masked account
- direction
- amount (minor)
- balance after (when present)
- channel / occurred_at when available

Ambiguity → review, not auto-merge.

## Security

- RLS on all user-owned tables (`auth.uid() = user_id`)
- Private storage bucket for source media (signed URLs only)
- Secrets only in env vars
- `.env.example` has no real secrets

## Local Phase 0 store

Mirrors the conceptual model in `.data/numa-store.json` for the vertical slice without requiring credentials.
