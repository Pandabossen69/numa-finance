# Roadmap

Phases are planning structure, not a contract.

## Phase 0 — Foundation (shipped)

- Repository + Next.js app
- Domain money/finance engines
- Swedish mobile shell + PWA foundation
- Accounts, checkpoints, manual expenses
- Observation model + import entry point
- Supabase schema + RLS
- Tests for critical money/balance behavior

## Accelerated (multi-user + daily capture)

- Multi-user hardening: storage path isolation, defense-in-depth `user_id` filters, prod requires Supabase
- Receipt camera flow (`/fota`): upload → vision/manual → confirm vs tryggt idag → ledger
- OpenAI Vision provider behind `ExtractionProvider` (candidates only)
- Live Plan/Analys from snapshot; thin streak/rank via `user_progress`
- Still deferred: full recurring plan engine, Bangkok Bank screenshot OCR end-to-end, world leaderboard UI

## Phase 1 — Core daily finance + personal game loop

- Better manual transactions (income, transfers, cash withdrawal) *(wired in + sheet)*
- Recurring expenses
- Monthly plans + reservations
- Richer Idag screen with live day pulse *(partially live)*
- Persist streak / on-track days / personal level *(thin touch wired)*
- Default account / recent categories polish

## Phase 2 — Screenshot intelligence

- Private media upload *(receipt path live)*
- OCR/vision provider *(OpenAI wired for receipts)*
- Bangkok Bank parser against extracted text
- Candidates, duplicates, reconciliation, checkpoints

## Phase 3 — Camera intelligence

- Receipt / checkout / price capture *(receipt confirm live)*
- Confirm “Vi hittade ฿X” *(live)*
- Merchant/category suggestions

## Phase 4 — Forecasting

- Daily safe-to-spend maturity
- Cash runway to next income
- Month/year forecast
- Goals + affordability simulation (“Kan jag köpa det här?”)

## Phase 5 — Automation

- SMS/companion input if feasible
- Broader bank imports
- Auto-categorization with review gates

## Phase 6 — Social progress + polish

- Global leaderboard (discipline score, place in world) — no balances
- Shareable progress cards
- Analytics depth
- Ask NUMA
- Stronger offline
- Notifications / widgets where applicable
