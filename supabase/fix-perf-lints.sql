-- ============================================================
-- FIX — Supabase linter PERFORMANCE warnings (0003 / 0006 /
-- 0009 / 0005 / 0001). Run in the SQL Editor after fix-linter-
-- grants.sql. Idempotent.
--
-- 0006 multiple_permissive_policies (24 warnings): the legacy
--   combined `*_sales_rep_access FOR ALL` policies overlapped the
--   per-command set. SECURITY NOTE: because permissive policies OR
--   together, those FOR ALL policies ALSO granted sub-users DELETE
--   on their own opportunities — a real hole vs the spec (sub-user
--   deletion must go through the Phase 5 approval flow). Dropping
--   them closes all 24 warnings AND the hole; the per-command
--   policies below carry the same Phase 5 semantics (soft-deleted
--   rows invisible to sub-users).
-- 0003 auth_rls_initplan: every policy now wraps auth.uid() in
--   (select auth.uid()) so it is evaluated once per query.
-- 0009/0005: legacy duplicate + unused indexes dropped (canonical
--   schema names kept). 0001: one hot-path index added; the rest
--   of the INFO findings are accepted (legacy columns/tables the
--   app never filters on) — documented in the README.
-- ============================================================

-- 1) Remove the overlapping FOR ALL policies everywhere.
drop policy if exists opportunities_sales_rep_access on public.opportunities;
drop policy if exists activities_sales_rep_access on public.activities;

-- 2) Recreate the canonical per-command policies (identical to
--    schema.sql PHASE 3 section).
drop policy if exists opportunities_owner_access on public.opportunities;
drop policy if exists opportunities_select on public.opportunities;
drop policy if exists opportunities_insert on public.opportunities;
drop policy if exists opportunities_update on public.opportunities;
drop policy if exists opportunities_delete on public.opportunities;

create policy opportunities_select on public.opportunities
  for select using (
    public.is_organization_owner(organization_id)
    or (
      owner_id = (select auth.uid())
      and public.is_organization_member(organization_id)
      and deleted_at is null
    )
  );

create policy opportunities_insert on public.opportunities
  for insert with check (
    public.is_organization_owner(organization_id)
    or (
      public.is_organization_member(organization_id)
      and (owner_id = (select auth.uid()) or owner_id is null)
      and deleted_at is null
    )
  );

create policy opportunities_update on public.opportunities
  for update
  using (
    public.is_organization_owner(organization_id)
    or (
      owner_id = (select auth.uid())
      and public.is_organization_member(organization_id)
      and deleted_at is null
    )
  )
  with check (
    public.is_organization_owner(organization_id)
    or (
      public.is_organization_member(organization_id)
      and (owner_id = (select auth.uid()) or owner_id is null)
      and deleted_at is null
    )
  );

create policy opportunities_delete on public.opportunities
  for delete using (public.is_organization_owner(organization_id));

drop policy if exists activities_owner_access on public.activities;
drop policy if exists activities_select on public.activities;
drop policy if exists activities_insert on public.activities;
drop policy if exists activities_update on public.activities;
drop policy if exists activities_delete on public.activities;

create policy activities_select on public.activities
  for select using (
    public.is_organization_owner(organization_id)
    or public.owns_opportunity(opportunity_id, organization_id)
  );

create policy activities_insert on public.activities
  for insert with check (
    public.is_organization_owner(organization_id)
    or public.owns_opportunity(opportunity_id, organization_id)
  );

create policy activities_update on public.activities
  for update
  using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

create policy activities_delete on public.activities
  for delete using (public.is_organization_owner(organization_id));

-- 3) owns_opportunity: initplan-wrapped auth.uid() + soft-delete guard.
create or replace function public.owns_opportunity(
  target_opportunity_id uuid,
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = target_opportunity_id
      and o.organization_id = target_organization_id
      and o.owner_id = (select auth.uid())
      -- Soft-deleted deals are invisible to sub-users entirely (Phase 5).
      and o.deleted_at is null
      and exists (
        select 1
        from public.organization_members m
        where m.organization_id = o.organization_id
          and m.user_id = (select auth.uid())
          and m.status = 'active'
      )
  );
$$;

-- 4) Remaining initplan fixes: drop + recreate the five flagged
--    policies with (select auth.uid()).
drop policy if exists organization_members_select_self_or_owner on public.organization_members;
create policy organization_members_select_self_or_owner on public.organization_members
  for select using (user_id = (select auth.uid()) or public.is_organization_owner(organization_id));

drop policy if exists profiles_select_own_or_teammate on public.profiles;
create policy profiles_select_own_or_teammate on public.profiles
  for select using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members me
      join public.organization_members them on them.organization_id = me.organization_id
      where me.user_id = (select auth.uid())
        and me.status = 'active'
        and them.user_id = profiles.id
    )
  );

drop policy if exists sales_targets_select_owner_or_self on public.sales_targets;
create policy sales_targets_select_owner_or_self on public.sales_targets
  for select using (
    (user_id = (select auth.uid()) and public.is_organization_member(organization_id))
    or public.is_organization_owner(organization_id)
  );

drop policy if exists opportunity_history_select on public.opportunity_history;
create policy opportunity_history_select on public.opportunity_history
  for select using (
    public.is_organization_owner(organization_id)
    or (
      ((select auth.uid()) in (old_owner_id, new_owner_id))
      and public.is_organization_member(organization_id)
    )
  );

drop policy if exists deletion_requests_select on public.deletion_requests;
create policy deletion_requests_select on public.deletion_requests
  for select using (
    public.is_organization_owner(organization_id)
    or (
      requested_by = (select auth.uid())
      and public.is_organization_member(organization_id)
    )
  );

-- 5) Index hygiene: drop legacy duplicate + unused indexes (the
--    canonical schema names stay), add the audit-feed covering index.
drop index if exists public.idx_activities_org;
drop index if exists public.idx_opportunities_org;
drop index if exists public.idx_opportunities_owner;
drop index if exists public.idx_members_org;
drop index if exists public.idx_org_members_org;
drop index if exists public.idx_members_user;
drop index if exists public.idx_org_members_user;
drop index if exists public.idx_sales_targets_org;
drop index if exists public.idx_targets_org;
drop index if exists public.idx_opportunities_stage;
drop index if exists public.idx_opportunities_close_date;

do $patch$
begin
  -- May back a UNIQUE constraint on older databases; guarded either way.
  begin
    execute 'drop index if exists public.organization_members_organization_id_user_id_key';
  exception when others then
    raise notice 'note: could not drop organization_members_organization_id_user_id_key (%)', sqlerrm;
  end;
end
$patch$;

create index if not exists audit_log_organization_id_idx
  on public.audit_log (organization_id, created_at desc);

-- 6) Verification A — must return ZERO rows: any remaining policy with
--    a bare auth.uid() outside a (select ...).
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and (qual like '%auth.uid()%' and qual not like '%(select auth.uid())%')
     or (with_check like '%auth.uid()%' and with_check not like '%(select auth.uid())%')
order by tablename, policyname;

-- 7) Verification B — must return ZERO rows: no table should have more
--    than one permissive policy per (role, action) pair anymore.
select schemaname, tablename, roles, cmd, count(*) as policy_count
from pg_policies
where schemaname = 'public'
group by schemaname, tablename, roles, cmd
having count(*) > 1
order by tablename, cmd;
