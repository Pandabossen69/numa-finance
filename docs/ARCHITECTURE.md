# Architecture

## Principles

1. UI never owns authoritative financial math.
2. Canonical transactions are the source of change; derived values are computed.
3. Screenshots/receipts are **observations**, not transactions.
4. AI/OCR produces candidates only; confirmation creates canonical rows.
5. Money uses integer minor units; no float ledger math.
6. Historical FX conversions keep their original rate metadata.

## Layers

```
app/ (routes, Swedish UI)
  → features/ (server actions, feature UI)
    → lib/store (repository / persistence)
      → domain/ (money, finance, forecasting, imports)
```

### Domain

- `domain/money` — Money, formatting, FX provider abstraction
- `domain/finance` — balances, spending filters, fingerprints, reconciliation, safe-to-spend, timezone helpers
- `domain/imports` — extraction provider interface, bank message parsers
- `domain/forecasting` — affordability simulation stub (non-mutating)

### Persistence

- **Dev-only fallback:** local JSON store at `.data/numa-store.json` — **single tenant**. Never use for multi-user production.
- **Production / multi-user:** Supabase Postgres + Auth + RLS (`supabase/migrations`), schema `numa` only
- Repository facade: `lib/store/repository.ts` — production refuses to boot without Supabase (`assertMultiUserSafeBackend`)

### Multi-user isolation

Every read/write path must be scoped to the authenticated `user_id`:

1. Auth session → `user_id`
2. RLS (`auth.uid() = user_id`)
3. Repository queries also filter `user_id` (defense in depth)
4. Storage paths: `{userId}/...` in bucket `numa-source-media` (`lib/store/isolation.ts`)
5. Domain math stays pure (no global user state)

Switching repository implementation should not require rewriting domain logic.

### Balance model

```
latest verified checkpoint
+ later credits
- later debits
= calculated current balance
```

Cached editable balances are never the source of truth.

### Import / receipt pipeline

1. Upload source → private storage (`{userId}/...`)
2. Extraction run (OpenAI Vision when `OPENAI_API_KEY` is set; otherwise manual amount)
3. Structured candidates (never ledger writes)
4. User confirm with safe-to-spend impact
5. Confirm → canonical transaction (`source: receipt_camera`)
6. Recalculate derived state + optional on-track progress touch

UI entry: `/fota` and **+ → Fota kvitto**.

### FX

`FxProvider` abstraction exists. Phase 0 ships `StaticFxProvider` only — no live rate hardcoded into historical records.

### Offline

Manual expenses record `syncStatus` (`saved` | `pending_sync` | …). Phase 0 does not ship a full offline DB, but the model leaves room for optimistic local save + sync.
