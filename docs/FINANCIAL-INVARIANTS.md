# Financial invariants

These are non-negotiable.

1. **Never silently guess financial truth.** Uncertainty → review state.
2. **Every financial change originates from a traceable transaction/event.**
3. **One canonical dataset** feeds balances, budgets, forecasts, and plans.
4. **Balance provenance must be visible:** verified vs calculated vs out of sync.
5. **AI/OCR never writes the canonical ledger directly.**
6. **History stays auditable.** Corrections leave evidence.
7. **No JS floating point for authoritative money.** Use integer minor units.

## Spending classification

| Type | Affects balance | Counts as spending |
|------|-----------------|--------------------|
| expense | yes (debit) | yes |
| income | yes (credit) | no |
| transfer | yes (move) | no |
| cash_withdrawal | yes (bank→cash) | no (not consumption by itself) |
| refund | yes | no (not normal income) |
| adjustment | yes | no (explicit correction) |
| unknown | directionally | no until classified |

## Expected vs actual money

Expected future income must never inflate “available today”.

## Safe to spend

Not `monthlyBudget / 30`.

Phase 0 computes free cash after reserved + buffer, then spreads across days until next income. Overspending today recalculates future allowance rather than marking the user as failed.
