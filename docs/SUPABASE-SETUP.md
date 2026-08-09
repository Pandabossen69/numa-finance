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

## Apply schema (one-time)

1. Open Supabase → **NextStep leads staging** → **SQL Editor**
2. Paste and run the full contents of:
   `supabase/migrations/20260809000000_numa_schema.sql`
3. Confirm success (no errors).

## Expose schema to the Data API

1. **Project Settings → Data API** (or API → Exposed schemas)
2. Add `numa` to the exposed schemas list (keep `public` for the other app)
3. Save

Without this step, the JS client cannot query `numa.*`.

## Local env

`.env.local` (gitignored) should contain:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)

## Auth (required for RLS)

NUMA uses Supabase Auth. For solo use, disable email confirmation:

1. Authentication → Providers → Email
2. Turn **off** “Confirm email”
3. Save

Then open `/logga-in`, create an account, and use the app.

## Security

If a `service_role` key was pasted into chat or a screenshot, **rotate it** in  
**Settings → API Keys** after setup, then update `.env.local` / Vercel env.
