# Product vision

NUMA is a personal financial control system.

It continuously maintains a verifiable model of real balances, income, expenses, transfers, recurring costs, planned expenses, savings goals, reserved money, future obligations, daily spending, monthly/annual planning, safe spending capacity, and forecasts.

## Core questions

At any moment the product should answer:

1. Hur mycket pengar har jag?
2. Hur mycket av pengarna är redan planerade eller reserverade?
3. Hur mycket kan jag faktiskt använda?
4. Hur mycket kan jag tryggt spendera idag?
5. Kommer pengarna räcka till nästa inkomst?
6. Hur påverkar dagens köp resten av månaden och året?
7. Stämmer NUMA fortfarande överens med mitt riktiga banksaldo?

## User context

- Primary language: Swedish
- Primary operational currency: **THB**
- Secondary reference currency: **SEK**
- Default timezone: `Asia/Bangkok` (user-configurable)

SEK is shown for larger amounts and planning totals, not next to every small purchase.

## Experience direction

NUMA should feel as engaging as a small game — but the game is **your own economy**:

- Live feedback: plus / minus vs today’s plan
- Levels and ranks for staying on track
- Later: optional world standing (“plats i världen”) based on discipline, not wealth
- Built as a mobile PWA first so opening NUMA feels natural every day

Start with one user; architecture stays multi-user from the beginning (`user_id` + RLS). See `docs/GAMIFICATION.md`.

## What NUMA is not

- Not a crypto dashboard
- Not an accounting package for bookkeepers
- Not a screenshot-to-ledger autopilot without review
- Not a place where expected future income is treated as money already available
- Not a wealth flex leaderboard (no ranking by bank balance)
