-- ============================================================
-- FIX — Supabase linter security warnings (0028 / 0029)
-- Run in the Supabase SQL Editor after schema.sql.
--
-- 0028 (anon can execute SECURITY DEFINER): REAL — trigger
--   functions inherited the PUBLIC default grant, so anonymous
--   callers could hit them via /rest/v1/rpc. Fixed below.
-- 0029 (authenticated can execute SECURITY DEFINER): partially
--   real — cron-only jobs lose their grant; the app's guarded
--   RPCs (accept_invitation, set_member_status, ...) keep theirs
--   BY DESIGN (each validates auth.uid() + role internally) and
--   are documented as accepted in the README.
--
-- EXECUTE on a trigger function is checked at CREATE TRIGGER
-- time, not when a trigger fires — revoking here cannot break
-- the ownership or last-owner guards.
-- ============================================================

-- 1) Trigger functions: never callable via the RPC endpoint.
revoke all on function public.enforce_active_owner_exists() from public, anon, authenticated;
revoke all on function public.enforce_opportunity_ownership() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 2) Cron / service-role only maintenance jobs.
do $patch$
begin
  if to_regprocedure('public.expire_stale_invitations()') is not null then
    execute 'revoke all on function public.expire_stale_invitations() from public, anon, authenticated';
    execute 'grant execute on function public.expire_stale_invitations() to service_role';
  end if;
  if to_regprocedure('public.purge_expired_soft_deletes()') is not null then
    execute 'revoke all on function public.purge_expired_soft_deletes() from public, anon, authenticated';
    execute 'grant execute on function public.purge_expired_soft_deletes() to service_role';
  end if;
end
$patch$;

-- 3) Legacy live-database leftovers (superseded years ago; zero
--    references anywhere in this codebase) — drop any signature.
do $patch$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_organization', 'is_org_member')
  loop
    execute format('drop function %s', v_fn.signature);
    raise notice 'dropped legacy function %', v_fn.signature;
  end loop;
end
$patch$;

-- 4) Verification A — this MUST return zero rows:
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
order by p.proname;

-- 5) Verification B — informational: remaining authenticated-executable
--    SECURITY DEFINER functions. Every row here must be a guarded RPC
--    that validates auth.uid()/role internally (see README).
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and has_function_privilege('authenticated', p.oid, 'execute')
order by p.proname;
