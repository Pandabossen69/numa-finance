# Gamification

NUMA should feel as motivating as a game — especially as a PWA on your phone —
but **money truth always wins**.

## Product intent

- **Now:** one primary user (you). The app must already feel alive: live plus/minus, progress, levels.
- **Later:** many users. Same personal game against *your own* economy, plus optional **global standing** (level / rank / place in the world).
- Saving money should feel rewarding — streaks, levels, ranks — without becoming childish or crypto-like.

The game is: **compete with yesterday’s you**, then optionally **see how disciplined you are vs others** — never “who has the biggest bank account”.

## Non-negotiable

1. Gamification is a **progress layer** on top of the finance engine.
2. It must never invent a second budget, balance, or ledger.
3. Live “plus / minus today” uses the same inputs as safe-to-spend and spending.
4. Levels / ranks / scores come from **deterministic discipline outcomes**, e.g.:
   - on-track days
   - streak length
   - surplus vs plan (relative, not absolute wealth)
   - verification freshness / data integrity (optional bonus)
5. **Public / shareable stats never expose bank balances, account numbers, or raw transactions** unless the user explicitly opts in to share amounts.
6. Multi-user from day one in the **data model** (every row is `user_id`-scoped). Leaderboards are aggregations over public progress fields — not a redesign later.

## Two layers of competition

| Layer | Audience | What it shows |
|-------|----------|----------------|
| **Self** | Only you | Plus/minus today, streak, personal level, “better than last week” |
| **World** (later) | Optional public | Level, rank title, on-track score, world place — **not** THB/SEK balances |

World ranking answers: “Vilken plats ligger jag på?” based on discipline score, not net worth.

## Core loop (current → near)

1. Today plan = safe-to-spend today.
2. Confirmed expense updates spent today → **Dagens läge** (plus / jämnt / minus).
3. Ending the day on-track increments streak / on-track days.
4. On-track days + surplus metrics unlock **levels / ranks**.
5. Later: a public progress row feeds **global leaderboard** (place, top lists).

## Score philosophy (fair across incomes)

Do **not** rank by “who saved the most baht”.

Prefer relative / discipline metrics, for example:

- % of days on-track in rolling 30 days
- current streak
- times finished the day in surplus vs plan
- consistency after importing/verifying balances

That way a student and a high earner can compete fairly.

## Data foundation (multi-user ready)

Planned tables in schema `numa` (see migrations):

- `user_progress` — per-user level, streak, score, rank id, updated_at
- `progress_events` — audit of why score/streak changed (day closed on-track, etc.)
- Later: materialized/public view or RPC for leaderboard reads with RLS that only exposes non-sensitive fields

Auth already uses Supabase users; RLS keeps private finance private.

## PWA

Installable home-screen app is part of the fun: fast open, thumb + , live pulse after each entry. Gamification moments should feel native (subtle motion, clear feedback), not noisy.

## What we will not do

- Pay-to-win points
- Ranking by absolute wealth
- Public bank details
- OCR auto-confirm awarding ranks on uncertain data
- Crypto / neon “leaderboard dashboard” aesthetics
