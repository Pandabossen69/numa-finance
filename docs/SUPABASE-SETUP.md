# Supabase setup (shared project, isolated NUMA schema)

NUMA shares the Supabase **project host** with NextStep leads staging, but must never share tables.

## Isolation rules

| Concern         | NUMA value                                                      |
| --------------- | --------------------------------------------------------------- |
| Postgres schema | `numa`                                                          |
| Tables          | `numa.accounts`, `numa.transactions`, …                         |
| Storage bucket  | `numa-source-media`                                             |
| Auth trigger    | `numa_on_auth_user_created` → `numa_internal.handle_new_user()` |
| RLS policies    | prefixed `numa_*`                                               |

Do **not** put NUMA tables in `public`.

## Apply schema (one-time / incremental)

1. Open Supabase → **NextStep leads staging** → **SQL Editor**
2. Run migrations in order if not already applied:
   - `supabase/migrations/20260809000000_numa_schema.sql`
   - `supabase/migrations/20260809000001_numa_grants.sql`
   - `supabase/migrations/20260809000002_numa_progress.sql` (levels / streak / future leaderboard)
   - `supabase/migrations/20260811135906_candidate_fingerprint_unique.sql` (unique candidate fingerprints)
   - `supabase/migrations/20260814141040_transfer_group.sql` (pair transfer / cash legs)
   - `supabase/migrations/20260827104139_admin_only_user_lockdown.sql` (admin-only signup lock, private `handle_new_user`)
3. Confirm success (no errors).

## Expose schema to the Data API

1. **Project Settings → Data API** (or API → Exposed schemas)
2. Add `numa` to the exposed schemas list (keep `public` for the other app)
3. Save

Without this step, the JS client cannot query `numa.*`.

## Local / Vercel env

`.env.local` (gitignored) and Vercel project env should contain:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only — **required** for Mer → Ny användare; never `NEXT_PUBLIC_*`)
- `OPENAI_API_KEY` (server only — enables receipt vision OCR; without it, `/fota` still works with manual amount entry)

Production **requires** Supabase. The local JSON store (`.data/`) is single-tenant/dev-only.

## Auth

NUMA uses Supabase Auth. **Public self-signup is off** in the app. New accounts are created by the admin (Hugo) under **Mer → Ny användare** / **Inställningar → Ny användare**.

Do this in the dashboard as well (closing the UI is not enough — the anon key can still call Auth `signUp` until this is off):

1. Authentication → Providers → Email
2. Keep the **Email provider enabled** (otherwise nobody can log in)
3. Turn **off** “Allow new users to sign up” (global signup). Do **not** turn off the email provider itself.
4. Keep **Confirm email** off so admin-created users can log in immediately (the app also sets `email_confirm: true` on create). If Confirm email must stay on, admin create still confirms the address.
5. Save

Users log in at `/logga-in` with the e-post + lösenord Hugo set. Each user only sees their own plan, accounts, and transactions (RLS `auth.uid()`).

`SUPABASE_SERVICE_ROLE_KEY` must be set on Vercel **Preview and Production** (and `.env.local` for local). Without it, Ny användare fails closed with a Swedish error. Never put this key in `NEXT_PUBLIC_*`.

## Security

If a `service_role` key was pasted into chat or a screenshot, **rotate it** in  
**Settings → API Keys** after setup, then update `.env.local` / Vercel env.
