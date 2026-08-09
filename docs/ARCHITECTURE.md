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

### Persistence (Phase 0)

- **Default:** local JSON store at `.data/numa-store.json` (single-user foundation slice)
- **Production path:** Supabase Postgres + Auth + RLS (`supabase/migrations`)
- Repository functions in `lib/store/repository.ts` are the app-facing API

Switching the repository to Supabase should not require rewriting domain logic.

### Balance model

```
latest verified checkpoint
+ later credits
- later debits
= calculated current balance
```

Cached editable balances are never the source of truth.

### Import pipeline (future)

1. Upload source → private storage
2. Extraction run
3. Structured candidates
4. Deterministic validation
5. Fingerprint / duplicate check
6. Reconciliation check
7. User review if needed
8. Confirm → canonical transaction
9. Recalculate derived state

### FX

`FxProvider` abstraction exists. Phase 0 ships `StaticFxProvider` only — no live rate hardcoded into historical records.

### Offline

Manual expenses record `syncStatus` (`saved` | `pending_sync` | …). Phase 0 does not ship a full offline DB, but the model leaves room for optimistic local save + sync.
