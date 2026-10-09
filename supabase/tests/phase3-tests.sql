-- ============================================================
-- PHASE 3 TEST SUITE — run in the Supabase SQL Editor AFTER:
--   1. supabase/patch-01-targets-relax.sql
--   2. supabase/patch-02-accept-invitation.sql
--   3. supabase/schema.sql  (Phase 3 RLS section)
--   4. supabase/tests/phase2-tests.sql (optional, should still pass)
--
-- Assertion-based: raises on the first broken expectation and prints
-- PASS notices. Re-runnable: fixed UUIDs, cleaned up at the end.
--
-- Covered: member sees only own deals, cross-org isolation, member
-- create -> owner_id = self, owner_id/org/created_by tampering, member
-- has no DELETE, activity scoping + next_step/due_date persistence,
-- owner org-wide read/write, personal target visibility, deactivated
-- member loses access immediately.
-- ============================================================

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '33330000-0000-4000-8000-0000000000f1', 'authenticated', 'authenticated', 'owner@phase3.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Phase3 Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33330000-0000-4000-8000-0000000000f2', 'authenticated', 'authenticated', 'rep@phase3.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Phase3 Rep"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33330000-0000-4000-8000-0000000000f3', 'authenticated', 'authenticated', 'other@phase3.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Other Owner"}', now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, tag, created_by, onboarding_completed)
values
  ('44440000-0000-4000-8000-000000000001', 'Phase3 Org A', 'phase3-org-a', 'phase3-a', '33330000-0000-4000-8000-0000000000f1', true),
  ('44440000-0000-4000-8000-000000000002', 'Phase3 Org B', 'phase3-org-b', 'phase3-b', '33330000-0000-4000-8000-0000000000f3', true)
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('44440000-0000-4000-8000-000000000001', '33330000-0000-4000-8000-0000000000f1', 'owner', 'active'),
  ('44440000-0000-4000-8000-000000000001', '33330000-0000-4000-8000-0000000000f2', 'sales_rep', 'active'),
  ('44440000-0000-4000-8000-000000000002', '33330000-0000-4000-8000-0000000000f3', 'owner', 'active')
on conflict (organization_id, user_id) do update set role = excluded.role, status = excluded.status;

-- Fixture opportunities. The ownership trigger requires an authenticated
-- caller, so claims are set to the creating owner for each insert.
select set_config('request.jwt.claims',
  '{"sub":"33330000-0000-4000-8000-0000000000f1","role":"authenticated","email":"owner@phase3.test"}', false);

insert into public.opportunities (id, organization_id, company, stage, value, probability, owner, owner_id, created_by, expected_close_date, created_date)
values
  ('55550000-0000-4000-8000-000000000001', '44440000-0000-4000-8000-000000000001', 'Owner Deal', 'Proposal', 10000, 70, 'Phase3 Owner', '33330000-0000-4000-8000-0000000000f1', '33330000-0000-4000-8000-0000000000f1', current_date, current_date),
  ('55550000-0000-4000-8000-000000000002', '44440000-0000-4000-8000-000000000001', 'Rep Deal', 'Discovery', 5000, 40, 'Phase3 Rep', '33330000-0000-4000-8000-0000000000f2', '33330000-0000-4000-8000-0000000000f1', current_date, current_date),
  ('55550000-0000-4000-8000-000000000004', '44440000-0000-4000-8000-000000000001', 'Owner Deletable', 'Lead', 100, 10, 'Phase3 Owner', '33330000-0000-4000-8000-0000000000f1', '33330000-0000-4000-8000-0000000000f1', current_date, current_date)
on conflict (id) do nothing;

select set_config('request.jwt.claims',
  '{"sub":"33330000-0000-4000-8000-0000000000f3","role":"authenticated","email":"other@phase3.test"}', false);

insert into public.opportunities (id, organization_id, company, stage, value, probability, owner, owner_id, created_by, expected_close_date, created_date)
values
  ('55550000-0000-4000-8000-000000000003', '44440000-0000-4000-8000-000000000002', 'Foreign Deal', 'Lead', 7000, 10, 'Other Owner', '33330000-0000-4000-8000-0000000000f3', '33330000-0000-4000-8000-0000000000f3', current_date, current_date)
on conflict (id) do nothing;

select set_config('request.jwt.claims', '', false);

-- Fixture activities (owner + rep own one each; rep's carries a reminder).
insert into public.activities (id, organization_id, opportunity_id, type, text, next_step, due_date, created_at)
values
  ('66660000-0000-4000-8000-000000000001', '44440000-0000-4000-8000-000000000001', '55550000-0000-4000-8000-000000000001', 'note', 'Owner noted pricing feedback', null, null, now() - interval '1 hour'),
  ('66660000-0000-4000-8000-000000000002', '44440000-0000-4000-8000-000000000001', '55550000-0000-4000-8000-000000000002', 'call', 'Rep called about renewal', 'Send renewal quote', current_date + 3, now() - interval '30 minutes'),
  ('66660000-0000-4000-8000-000000000003', '44440000-0000-4000-8000-000000000002', '55550000-0000-4000-8000-000000000003', 'note', 'Foreign org activity', null, null, now() - interval '2 hours')
on conflict (id) do nothing;

-- Fixture personal targets.
insert into public.sales_targets (organization_id, user_id, target_amount, period, source)
values
  ('44440000-0000-4000-8000-000000000001', '33330000-0000-4000-8000-0000000000f1', 9000, 'monthly', 'manual'),
  ('44440000-0000-4000-8000-000000000001', '33330000-0000-4000-8000-0000000000f2', 5000, 'monthly', 'manual')
on conflict (organization_id, user_id) do update
set target_amount = excluded.target_amount, period = excluded.period;

select set_config('request.jwt.claims', '', false);

-- TEST 1: sub-user sees only their own opportunities -----------------------
do $t3$
declare v_count int; v_id uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.opportunities;
  if v_count <> 1 then
    raise exception 'FAIL: rep sees % opportunities, expected 1', v_count;
  end if;
  select id into v_id from public.opportunities;
  if v_id <> '55550000-0000-4000-8000-000000000002'::uuid then
    raise exception 'FAIL: rep sees the wrong opportunity %', v_id;
  end if;
  raise notice 'PASS: sub-user sees only their own opportunities';
end $t3$;
reset role;

-- TEST 2: cross-org isolation for sub-user ---------------------------------
do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.opportunities
  where organization_id = '44440000-0000-4000-8000-000000000002';
  if v_count <> 0 then
    raise exception 'FAIL: rep sees % rows of another org', v_count;
  end if;
  raise notice 'PASS: cross-org isolation (sub-user reads nothing from other orgs)';
end $t3$;
reset role;

-- TEST 3: owner sees the whole organization --------------------------------
do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f1","role":"authenticated","email":"owner@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.opportunities;
  if v_count <> 3 then
    raise exception 'FAIL: owner sees % opportunities, expected 3', v_count;
  end if;
  select count(*) into v_count from public.opportunities
  where organization_id = '44440000-0000-4000-8000-000000000002';
  if v_count <> 0 then
    raise exception 'FAIL: owner sees % rows of another org', v_count;
  end if;
  raise notice 'PASS: owner sees all own-org opportunities and no foreign rows';
end $t3$;
reset role;

-- TEST 4: sub-user create -> owner_id/created_by = self --------------------
do $t3$
declare v_owner uuid; v_creator uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  insert into public.opportunities (id, organization_id, company, stage, value, probability, owner, expected_close_date, created_date)
  values ('55550000-0000-4000-8000-000000000005', '44440000-0000-4000-8000-000000000001', 'Rep Created', 'Lead', 1234, 10, 'Phase3 Rep', current_date, current_date);
  select owner_id, created_by into v_owner, v_creator
  from public.opportunities where id = '55550000-0000-4000-8000-000000000005';
  if v_owner is distinct from '33330000-0000-4000-8000-0000000000f2'::uuid then
    raise exception 'FAIL: owner_id = %, expected the creating sub-user', v_owner;
  end if;
  if v_creator is distinct from '33330000-0000-4000-8000-0000000000f2'::uuid then
    raise exception 'FAIL: created_by = %, expected the creating sub-user', v_creator;
  end if;
  raise notice 'PASS: sub-user create sets owner_id and created_by to self';
end $t3$;
reset role;

-- TEST 5: sub-user cannot change organization_id (trigger) -----------------
do $t3$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  update public.opportunities
  set organization_id = '44440000-0000-4000-8000-000000000002'
  where id = '55550000-0000-4000-8000-000000000002';
  raise exception 'FAIL: organization_id was changed';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'organization_id cannot be changed.' then
      raise notice 'PASS: sub-user cannot change organization_id';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $t3$;
reset role;

-- TEST 6: sub-user cannot change owner_id (trigger) ------------------------
do $t3$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  update public.opportunities
  set owner_id = '33330000-0000-4000-8000-0000000000f1'
  where id = '55550000-0000-4000-8000-000000000002';
  raise exception 'FAIL: owner_id was changed by a sub-user';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'Only an organization owner can reassign opportunities.' then
      raise notice 'PASS: sub-user cannot change owner_id';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $t3$;
reset role;

-- TEST 7: sub-user cannot change created_by (trigger) ----------------------
do $t3$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  update public.opportunities set created_by = null where id = '55550000-0000-4000-8000-000000000002';
  raise exception 'FAIL: created_by was changed';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'created_by cannot be changed.' then
      raise notice 'PASS: sub-user cannot change created_by';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $t3$;
reset role;

-- TEST 8: sub-user can move stage on their own deal ------------------------
do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  update public.opportunities set stage = 'Qualified' where id = '55550000-0000-4000-8000-000000000002';
  select count(*) into v_count from public.opportunities
  where id = '55550000-0000-4000-8000-000000000002' and stage = 'Qualified';
  if v_count <> 1 then
    raise exception 'FAIL: sub-user could not move their own deal to Qualified';
  end if;
  raise notice 'PASS: sub-user can edit stage on their own deal';
end $t3$;
reset role;

-- TEST 9: sub-user cannot edit someone else''s deal ------------------------
do $t3$
declare v_stage text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  update public.opportunities set stage = 'Closed Lost' where id = '55550000-0000-4000-8000-000000000001';
  select stage into v_stage from public.opportunities where id = '55550000-0000-4000-8000-000000000001';
  if v_stage <> 'Proposal' then
    raise exception 'FAIL: sub-user modified the owner''s deal (stage=%)', v_stage;
  end if;
  raise notice 'PASS: sub-user cannot edit deals they do not own';
end $t3$;
reset role;

-- TEST 10: sub-user has no DELETE path (0 rows affected) --------------------
do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  delete from public.opportunities
  where id in ('55550000-0000-4000-8000-000000000001', '55550000-0000-4000-8000-000000000002');
  select count(*) into v_count from public.opportunities
  where id in ('55550000-0000-4000-8000-000000000001', '55550000-0000-4000-8000-000000000002');
  if v_count <> 2 then
    raise exception 'FAIL: sub-user deleted % deals', 2 - v_count;
  end if;
  raise notice 'PASS: sub-user cannot delete opportunities (no delete policy)';
end $t3$;
reset role;

-- TEST 11: owner can edit any deal in the org and delete directly ----------
do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f1","role":"authenticated","email":"owner@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  update public.opportunities set stage = 'Negotiation' where id = '55550000-0000-4000-8000-000000000002';
  select count(*) into v_count from public.opportunities
  where id = '55550000-0000-4000-8000-000000000002' and stage = 'Negotiation';
  if v_count <> 1 then
    raise exception 'FAIL: owner could not edit a sub-user''s deal';
  end if;
  delete from public.opportunities where id = '55550000-0000-4000-8000-000000000004';
  select count(*) into v_count from public.opportunities
  where id = '55550000-0000-4000-8000-000000000004';
  if v_count <> 0 then
    raise exception 'FAIL: owner could not delete directly';
  end if;
  raise notice 'PASS: owner edits any deal and deletes directly (no approval)';
end $t3$;
reset role;

-- TEST 12: sub-user sees only activities on their own deals ----------------
do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.activities;
  if v_count <> 1 then
    raise exception 'FAIL: rep sees % activities, expected 1', v_count;
  end if;
  select count(*) into v_count from public.activities
  where id = '66660000-0000-4000-8000-000000000003';
  if v_count <> 0 then
    raise exception 'FAIL: rep sees another org''s activity';
  end if;
  raise notice 'PASS: sub-user sees only activities on their own deals';
end $t3$;
reset role;

-- TEST 13: sub-user logs an activity with next step + due date -------------
do $t3$
declare v_next text; v_due date;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  insert into public.activities (organization_id, opportunity_id, type, text, next_step, due_date)
  values ('44440000-0000-4000-8000-000000000001', '55550000-0000-4000-8000-000000000002', 'follow-up', 'Rep logged follow-up', 'Send contract draft', current_date + 2);
  select next_step, due_date into v_next, v_due
  from public.activities
  where type = 'follow-up' and opportunity_id = '55550000-0000-4000-8000-000000000002';
  if v_next <> 'Send contract draft' then
    raise exception 'FAIL: next_step not persisted (%)', v_next;
  end if;
  if v_due is null then
    raise exception 'FAIL: due_date not persisted';
  end if;
  raise notice 'PASS: sub-user logs activities with next step and due date';
end $t3$;
reset role;

-- TEST 14: sub-user cannot log an activity on someone else''s deal ---------
do $t3$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  insert into public.activities (organization_id, opportunity_id, type, text)
  values ('44440000-0000-4000-8000-000000000001', '55550000-0000-4000-8000-000000000001', 'note', 'Rep snooping on owner deal');
  raise exception 'FAIL: sub-user logged an activity on the owner''s deal';
exception
  when insufficient_privilege then
    raise notice 'PASS: sub-user cannot log activities on deals they do not own';
end $t3$;
reset role;

-- TEST 15: sub-user cannot edit or delete activities -----------------------
do $t3$
declare v_count int; v_text text;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  update public.activities set text = 'tampered' where id = '66660000-0000-4000-8000-000000000001';
  delete from public.activities where id = '66660000-0000-4000-8000-000000000002';
  select count(*) into v_count from public.activities
  where id in ('66660000-0000-4000-8000-000000000001', '66660000-0000-4000-8000-000000000002');
  if v_count <> 2 then
    raise exception 'FAIL: sub-user deleted % activities', 2 - v_count;
  end if;
  select text into v_text from public.activities where id = '66660000-0000-4000-8000-000000000001';
  if v_text = 'tampered' then
    raise exception 'FAIL: sub-user edited the owner''s activity';
  end if;
  raise notice 'PASS: sub-user cannot edit or delete activities';
end $t3$;
reset role;

-- TEST 16: owner sees and manages all activities in the org ----------------
do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f1","role":"authenticated","email":"owner@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.activities
  where organization_id = '44440000-0000-4000-8000-000000000001';
  if v_count < 3 then
    raise exception 'FAIL: owner sees % org activities, expected >= 3', v_count;
  end if;
  select count(*) into v_count from public.activities
  where id = '66660000-0000-4000-8000-000000000003';
  if v_count <> 0 then
    raise exception 'FAIL: owner sees another org''s activity';
  end if;
  raise notice 'PASS: owner sees all activities org-wide, never foreign orgs';
end $t3$;
reset role;

-- TEST 17: personal target visibility -------------------------------------
do $t3$
declare v_count int; v_amount numeric;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.sales_targets;
  if v_count <> 1 then
    raise exception 'FAIL: rep sees % target rows, expected 1', v_count;
  end if;
  select target_amount into v_amount from public.sales_targets;
  if v_amount <> 5000 then
    raise exception 'FAIL: rep target = %, expected 5000', v_amount;
  end if;
  raise notice 'PASS: sub-user reads only their own personal target';
end $t3$;
reset role;

do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f1","role":"authenticated","email":"owner@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.sales_targets;
  if v_count <> 2 then
    raise exception 'FAIL: owner sees % target rows, expected 2', v_count;
  end if;
  raise notice 'PASS: owner reads all target rows in the org';
end $t3$;
reset role;

-- TEST 18: deactivating the sub-user revokes access immediately ------------
update public.organization_members
set status = 'inactive'
where organization_id = '44440000-0000-4000-8000-000000000001'
  and user_id = '33330000-0000-4000-8000-0000000000f2';

do $t3$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33330000-0000-4000-8000-0000000000f2","role":"authenticated","email":"rep@phase3.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.opportunities;
  if v_count <> 0 then
    raise exception 'FAIL: deactivated sub-user still sees % deals', v_count;
  end if;
  select count(*) into v_count from public.activities;
  if v_count <> 0 then
    raise exception 'FAIL: deactivated sub-user still sees % activities', v_count;
  end if;
  select count(*) into v_count from public.sales_targets;
  if v_count <> 0 then
    raise exception 'FAIL: deactivated sub-user still sees % target rows', v_count;
  end if;
  raise notice 'PASS: deactivated sub-user loses access immediately';
end $t3$;
reset role;

-- Restore for a clean re-run.
update public.organization_members
set status = 'active'
where organization_id = '44440000-0000-4000-8000-000000000001'
  and user_id = '33330000-0000-4000-8000-0000000000f2';

-- Cleanup -----------------------------------------------------------------
do $t3$
begin
  delete from public.activities
  where organization_id in ('44440000-0000-4000-8000-000000000001', '44440000-0000-4000-8000-000000000002');
  delete from public.opportunities
  where organization_id in ('44440000-0000-4000-8000-000000000001', '44440000-0000-4000-8000-000000000002');
  delete from public.sales_targets
  where organization_id in ('44440000-0000-4000-8000-000000000001', '44440000-0000-4000-8000-000000000002');
  delete from public.audit_log
  where organization_id in ('44440000-0000-4000-8000-000000000001', '44440000-0000-4000-8000-000000000002');
  delete from public.organization_members
  where organization_id in ('44440000-0000-4000-8000-000000000001', '44440000-0000-4000-8000-000000000002');
  delete from public.organizations
  where id in ('44440000-0000-4000-8000-000000000001', '44440000-0000-4000-8000-000000000002');
  delete from auth.users
  where id in ('33330000-0000-4000-8000-0000000000f1', '33330000-0000-4000-8000-0000000000f2', '33330000-0000-4000-8000-0000000000f3');
exception when others then
  raise notice 'cleanup note (fixtures may linger): %', sqlerrm;
end $t3$;

select set_config('request.jwt.claims', '', false);
do $t3$ begin raise notice 'ALL PHASE 3 TESTS PASSED'; end $t3$;
