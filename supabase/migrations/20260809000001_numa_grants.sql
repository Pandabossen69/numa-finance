-- NUMA: table grants for Data API roles (RLS still enforces row access)
-- Safe to re-run.

grant usage on schema numa to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema numa
  to anon, authenticated;

grant usage, select on all sequences in schema numa
  to anon, authenticated;

grant all on all tables in schema numa to service_role;
grant all on all sequences in schema numa to service_role;
grant all on all routines in schema numa to service_role;

alter default privileges in schema numa
  grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema numa
  grant usage, select on sequences to anon, authenticated;

alter default privileges in schema numa
  grant all on tables to service_role;

alter default privileges in schema numa
  grant all on sequences to service_role;

alter default privileges in schema numa
  grant all on routines to service_role;
