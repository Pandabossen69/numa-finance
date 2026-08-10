# Roadmap

Phases are planning structure, not a contract.
Product north star: answer the seven money questions every day — and make
staying on plan feel like competing with yesterday’s you.

## North-star loop (always protect this)

1. **Know truth** — saldo + checkpoints (manual / SMS / screenshot)
2. **Plan money** — reserved, buffer, flexible, next income
3. **Live day** — tryggt idag + plus/minus pulse after every entry
4. **Capture fast** — + sheet: fota / belopp / uppdatera saldo in seconds
5. **Stay honest** — review uncertain OCR; never silent ledger writes
6. **Level up** — streak / rank from discipline (later: world place, never wealth)

Multi-user is already in the data model (`user_id` + RLS). Ship solo quality
first; social is a layer on public progress fields only.

---

## Phase 0 — Foundation (shipped)

- Next.js app, Swedish mobile shell, PWA foundation
- Money/finance domain (integer minor units, safe-to-spend, checkpoints)
- Supabase schema `numa` + RLS + auth
- Accounts, manual expense/income/transfer/cash, receipt capture path
- Observation model for future screenshot imports
- Thin gamification tables (`user_progress`)

## Now — Daily cockpit reliability (current focus)

Goal: opening NUMA on the phone always shows a usable **Idag**.

- [x] + sheet: lägg till / uppdatera saldo without broken Link navigation
- [ ] Idag never blank (loading + error + safe money coercion)
- [ ] Saldo save → immediate visible balance / tryggt idag
- [ ] Default account + recent categories polish
- [ ] Clear Swedish states: i synk / behöver uppdateras / saknar plan

## Phase 1 — Core daily finance + personal game

- Recurring “måste betalas” with due dates feeding runway
- Richer Plan editor (mandatory / flexible / goal / buffer / next income)
- Day close → streak / on-track persistence (deterministic)
- SEK reference on large totals only
- Cash runway card: “räcker till nästa inkomst?”

## Phase 2 — Bangkok Bank screenshot intelligence

- Upload SMS screenshot → extraction candidates (not ledger)
- Bangkok Bank parser + balance-after sequence validation
- Fingerprint dedupe across overlapping screenshots
- Confirm / review UI in natural Swedish
- Checkpoint from bank-reported available balance

## Phase 3 — Camera intelligence

- Receipt / checkout / price capture polish
- “Vi hittade ฿X” confirm vs tryggt idag (already started on `/fota`)
- Merchant + category suggestions with review gates

## Phase 4 — Forecasting & “Kan jag köpa det här?”

- Month/year projected balance
- Affordability simulation (non-mutating)
- Goal pacing vs safe-to-spend
- Risk callouts when a purchase threatens obligations

## Phase 5 — Automation

- Broader bank imports / SMS companion if feasible
- Auto-categorization with always-on review for low confidence
- Stronger offline: optimistic save + sync status

## Phase 6 — Social progress + polish

- Optional world leaderboard (discipline score only — never balances)
- Shareable progress cards
- Ask NUMA, notifications, widgets where useful
- Analytics depth without dashboard clutter

---

## Explicit non-goals (keep refusing these)

- Ranking by wealth / bank balance
- OCR auto-confirm into the ledger
- Treating expected income as money available today
- Counting transfers or ATM withdrawals as spending
- English UI, crypto aesthetics, desktop-first layout
