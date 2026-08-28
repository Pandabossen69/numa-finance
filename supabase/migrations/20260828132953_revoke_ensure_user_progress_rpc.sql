-- Trigger-only helper. Must not be callable as PostgREST RPC.
revoke execute on function numa.ensure_user_progress() from public;
revoke execute on function numa.ensure_user_progress() from anon;
revoke execute on function numa.ensure_user_progress() from authenticated;
