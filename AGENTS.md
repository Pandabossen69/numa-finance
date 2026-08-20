<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

NUMA is a single Next.js 16 (App Router, Turbopack) PWA. Standard scripts live in `package.json` (`dev`, `build`, `lint`, `typecheck`, `test`, `icons`) and the README documents the quick start. The update script already runs `npm ci` + `npm run icons` on boot, so dependencies and PWA icons are ready.

### Auth gate requires Supabase — local JSON mode is effectively blocked

Despite the README implying a keyless "local JSON" mode, `src/lib/supabase/middleware.ts` (wired via `src/proxy.ts`) **fails closed**: with no `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, every non-public route redirects to `/logga-in`, and the sign-in/sign-up server actions throw "Supabase is not configured". So to actually use the app (reach `/idag`, enter a saldo, etc.) you need a working Supabase backend. In this environment we run a **local Supabase stack**.

### Bringing services up (not in the update script — do this per session)

Docker and the `supabase` CLI are pre-installed in the snapshot, but nothing starts them automatically (there is no systemd in the container). Each session, before running the app end-to-end:

1. Start the Docker daemon (needs `sudo`, runs in the foreground — use a tmux/background terminal):
   `sudo dockerd > /tmp/dockerd.log 2>&1 &` — the daemon is configured for `fuse-overlayfs` with the containerd snapshotter disabled (required for Docker 29). Verify with `sudo docker info | grep "Storage Driver"`.
2. Start Supabase from the repo root: `sudo -E supabase start` (first boot pulls images; later boots are fast). It applies everything in `supabase/migrations/` to a fresh DB.
3. Create `.env.local` (gitignored) pointing at the local stack. The anon/service keys are printed by `supabase start` (and by `supabase status`):
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>`
4. Start the app with `npm run dev` (must be started/restarted *after* `.env.local` exists — Next only reads env at startup).

Studio is at `http://127.0.0.1:54323`; Postgres is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

### Non-obvious gotchas

- The app queries Postgres **schema `numa`** (not `public`). `supabase/config.toml` has been set to expose `numa` under `[api] schemas` / `extra_search_path`; if PostgREST returns "schema must be one of the following", re-check that edit.
- Sign-up works only because local `enable_confirmations = false` and the `numa_on_auth_user_created` trigger inserts the `numa.profiles` row. Email is auto-confirmed locally (Mailpit at `http://127.0.0.1:54324`).
- The app treats `localhost`/`127.0.0.1` as canonical, so no production redirect happens locally. Access it via `http://localhost:3000`.
- `npm run lint` currently reports pre-existing errors/warnings in the repo (e.g. `prefer-const` in the store repositories). This is existing code state, not an environment problem.
