# Supabase setup (shared project, isolated NUMA schema)

NUMA shares the Supabase **project host** with NextStep leads staging, but must never share tables.

## Isolation rules

| Concern | NUMA value |
|---------|------------|
| Postgres schema | `numa` |
| Tables | `numa.accounts`, `numa.transactions`, … |
| Storage bucket | `numa-source-media` |
| Auth trigger | `numa_on_auth_user_created` → `numa.handle_new_user()` |
| RLS policies | prefixed `numa_*` |

Do **not** put NUMA tables in `public`.

## Apply schema (one-time / incremental)

1. Open Supabase → **NextStep leads staging** → **SQL Editor**
2. Run migrations in order if not already applied:
   - `supabase/migrations/20260809000000_numa_schema.sql`
   - `supabase/migrations/20260809000001_numa_grants.sql`
   - `supabase/migrations/20260809000002_numa_progress.sql` (levels / streak / future leaderboard)
   - `supabase/migrations/20260809000003_transfer_group.sql` (paired transfer/cash legs)
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
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to the browser)
- `OPENAI_API_KEY` (server only — enables receipt vision OCR; without it, `/fota` still works with manual amount entry)

Production **requires** Supabase. The local JSON store (`.data/`) is single-tenant/dev-only.

## Auth (required for RLS)

NUMA uses Supabase Auth with e-post + lösenord. Both flows work with email
confirmation **on** or **off** — the app tells the user in Swedish what to do
next either way.

Open `/logga-in`, create an account, and use the app.

### Redirect URLs (needed for confirmation and password reset)

Supabase only follows redirect links it recognises:

1. **Authentication → URL Configuration**
2. Set **Site URL** to the deployed origin (e.g. `https://numa.example.com`)
3. Add these **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://<your-domain>/auth/callback`

The app builds the link as `<origin>/auth/callback`, where `<origin>` is
`NEXT_PUBLIC_SITE_URL` when set, otherwise the request host. Set
`NEXT_PUBLIC_SITE_URL` in production so the link always matches the allow-list.

### Forgot password

`/glomt-losenord` sends a recovery mail through Supabase. The link lands on
`/auth/callback`, which creates a recovery session and forwards to
`/aterstall-losenord` where the user picks a new password. Open the link on the
same device that requested it — the PKCE verifier lives in that browser.

If mails never arrive, check **Authentication → Emails** (templates and SMTP);
the default Supabase SMTP is heavily rate limited.

## Security

If a `service_role` key was pasted into chat or a screenshot, **rotate it** in  
**Settings → API Keys** after setup, then update `.env.local` / Vercel env.
