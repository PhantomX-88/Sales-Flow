-- ============================================================
-- PHASE 4 TEST SUITE — run in the Supabase SQL Editor AFTER
-- schema.sql. Fixtures are self-contained and re-runnable.
--
-- Assertion-based: raises an exception (fails the run) on the first
-- broken expectation and prints PASS notices as it goes.
--
-- Covered: owner-only reassignment, sub-user/outsider rejection,
-- new-owner-must-be-active-member, history rows written with actor,
-- bulk reassign moves only open deals, closed deals keep their owner,
-- bulk helper rejects same-user and non-owner callers, in-app
-- notification activity created for the new owner, audit entries
-- written, idempotent reassign (same owner = no-op, no duplicate
-- history).
-- ============================================================

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'owner_a@phase4.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'rep_a@phase4.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rep A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'rep_b@phase4.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rep B"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'owner_b@phase4.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner B"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
values
  ('00000000-0000-4000-8000-0000000000a1', 'Owner A'),
  ('00000000-0000-4000-8000-0000000000a3', 'Rep A'),
  ('00000000-0000-4000-8000-0000000000a4', 'Rep B'),
  ('00000000-0000-4000-8000-0000000000b1', 'Owner B')
on conflict (id) do update set full_name = excluded.full_name;

insert into public.organizations (id, name, slug, tag, created_by, onboarding_completed)
values
  ('00000000-0000-4000-8000-aaaa00000001', 'Phase4 Org A', 'phase4-org-a', 'phase4-a', '00000000-0000-4000-8000-0000000000a1', true)
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a3', 'sales_rep', 'active'),
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a4', 'sales_rep', 'active')
on conflict (organization_id, user_id) do update set status = 'active', role = excluded.role;

-- One org-wide deal owned by the OWNER rep, one open + one closed deal for Rep A.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase4.test"}', false);

insert into public.opportunities (id, organization_id, company, stage, value, probability, owner, owner_id, created_by, expected_close_date, created_date)
values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-aaaa00000001', 'Phase4 Deal Wide', 'Negotiation', 5000, 50, 'Owner A', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', current_date, current_date),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-aaaa00000001', 'Phase4 Deal Open A', 'Proposal', 1500, 60, 'Rep A', '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a3', current_date, current_date),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-aaaa00000001', 'Phase4 Deal Closed A', 'Closed Won', 2500, 100, 'Rep A', '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a3', current_date, current_date)
on conflict (id) do update set owner_id = excluded.owner_id, stage = excluded.stage;

-- Fresh history/notification/audit state for the fixtures so the tests are
-- re-runnable with deterministic counts.
delete from public.opportunity_history where opportunity_id in ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000e2','00000000-0000-4000-8000-0000000000e3');
delete from public.activities where text like 'Reassigned to you:%';
delete from public.audit_log where action in ('opportunity.reassigned', 'opportunity.bulk_reassigned');

-- TEST 1: sub-user cannot call reassign_opportunity -----------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase4.test"}', false);

do $$
begin
  perform public.reassign_opportunity(
    '00000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-0000000000a4'
  );
  raise exception 'FAIL: sales_rep reassigned an opportunity';
exception
  when others then
    if sqlerrm <> 'Only an organization owner can reassign opportunities.' then
      raise exception 'FAIL: unexpected sub-user reassignment error: %', sqlerrm;
    end if;
    raise notice 'PASS: sub-user cannot reassign opportunities';
end $$;

-- TEST 2: reassign to a non-member is rejected (owner calling) -----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase4.test"}', false);

do $$
begin
  perform public.reassign_opportunity(
    '00000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-0000000000b1'::uuid  -- owner of another org, not a member here
  );
  raise exception 'FAIL: reassigned to a non-member';
exception
  when others then
    if sqlerrm <> 'The new owner must be an active member of the organization.' then
      raise exception 'FAIL: unexpected non-member error: %', sqlerrm;
    end if;
    raise notice 'PASS: reassign to a non-member is rejected';
end $$;

-- TEST 3: owner reassigns one deal; history + notification + audit ------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase4.test"}', false);

select public.reassign_opportunity(
  '00000000-0000-4000-8000-0000000000e1',
  '00000000-0000-4000-8000-0000000000a4'
);

do $$
declare
  v_owner uuid;
  v_history integer;
  v_activity integer;
  v_audit integer;
begin
  select owner_id into v_owner
  from public.opportunities
  where id = '00000000-0000-4000-8000-0000000000e1';
  if v_owner is distinct from '00000000-0000-4000-8000-0000000000a4' then
    raise exception 'FAIL: owner_id is % after reassignment', v_owner;
  end if;

  select count(*) into v_history
  from public.opportunity_history
  where opportunity_id = '00000000-0000-4000-8000-0000000000e1'
    and old_owner_id = '00000000-0000-4000-8000-0000000000a1'
    and new_owner_id = '00000000-0000-4000-8000-0000000000a4'
    and actor_id = '00000000-0000-4000-8000-0000000000a1';
  if v_history <> 1 then
    raise exception 'FAIL: % history rows written, expected 1', v_history;
  end if;

  select count(*) into v_activity
  from public.activities
  where opportunity_id = '00000000-0000-4000-8000-0000000000e1'
    and text like 'Reassigned to you:%';
  if v_activity <> 1 then
    raise exception 'FAIL: % reassignment notifications, expected 1', v_activity;
  end if;

  select count(*) into v_audit
  from public.audit_log
  where action = 'opportunity.reassigned'
    and entity_id = '00000000-0000-4000-8000-0000000000e1';
  if v_audit <> 1 then
    raise exception 'FAIL: % audit rows, expected 1', v_audit;
  end if;

  raise notice 'PASS: reassign updates owner, writes history, notifies, audits';
end $$;

-- TEST 4: idempotent reassign — same owner no-op, no duplicate rows ------
do $$
declare
  v_history integer;
begin
  perform public.reassign_opportunity(
    '00000000-0000-4000-8000-0000000000e1',
    '00000000-0000-4000-8000-0000000000a4'
  );
  select count(*) into v_history
  from public.opportunity_history
  where opportunity_id = '00000000-0000-4000-8000-0000000000e1';
  if v_history <> 1 then
    raise exception 'FAIL: idempotent reassign produced % history rows', v_history;
  end if;
  raise notice 'PASS: reassigning to the current owner is a no-op (no duplicate history)';
end $$;

-- TEST 5: bulk reassign moves only OPEN deals ----------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase4.test"}', false);

do $$
declare
  v_moved integer;
  v_open_owner uuid;
  v_closed_owner uuid;
begin
  select public.bulk_reassign(
    '00000000-0000-4000-8000-0000000000a3',
    '00000000-0000-4000-8000-0000000000a4'
  ) into v_moved;
  if v_moved <> 1 then
    raise exception 'FAIL: bulk_reassign moved % deals, expected 1', v_moved;
  end if;

  select owner_id into v_open_owner
  from public.opportunities
  where id = '00000000-0000-4000-8000-0000000000e2';
  if v_open_owner is distinct from '00000000-0000-4000-8000-0000000000a4' then
    raise exception 'FAIL: open deal owner is %, expected rep_b', v_open_owner;
  end if;

  select owner_id into v_closed_owner
  from public.opportunities
  where id = '00000000-0000-4000-8000-0000000000e3';
  if v_closed_owner is distinct from '00000000-0000-4000-8000-0000000000a3' then
    raise exception 'FAIL: closed deal owner changed to %', v_closed_owner;
  end if;

  if (select count(*) from public.opportunity_history
      where opportunity_id = '00000000-0000-4000-8000-0000000000e2'
        and new_owner_id = '00000000-0000-4000-8000-0000000000a4') <> 1 then
    raise exception 'FAIL: bulk reassign did not write history for the open deal';
  end if;

  if (select count(*) from public.activities
      where opportunity_id = '00000000-0000-4000-8000-0000000000e2'
        and text like 'Reassigned to you:%') <> 1 then
    raise exception 'FAIL: bulk reassign did not notify the new owner';
  end if;

  if (select count(*) from public.audit_log
      where action = 'opportunity.bulk_reassigned') <> 1 then
    raise exception 'FAIL: bulk reassign did not write the audit entry';
  end if;

  raise notice 'PASS: bulk reassign moves open deals only, with history, notification and audit';
end $$;

-- TEST 6: bulk reassign rejects same-user and non-owner callers ----------
do $$
begin
  perform public.bulk_reassign(
    '00000000-0000-4000-8000-0000000000a3',
    '00000000-0000-4000-8000-0000000000a3'
  );
  raise exception 'FAIL: bulk_reassign allowed source = target';
exception
  when others then
    if sqlerrm <> 'Source and target owner must be different members.' then
      raise exception 'FAIL: unexpected same-user error: %', sqlerrm;
    end if;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase4.test"}', false);

do $$
begin
  perform public.bulk_reassign(
    '00000000-0000-4000-8000-0000000000a4',
    '00000000-0000-4000-8000-0000000000a3'
  );
  raise exception 'FAIL: sales_rep ran bulk_reassign';
exception
  when others then
    if sqlerrm <> 'Only an organization owner can reassign opportunities.' then
      raise exception 'FAIL: unexpected sub-user bulk error: %', sqlerrm;
    end if;
    raise notice 'PASS: bulk reassign rejects same-user and non-owner callers';
end $$;

-- Cleanup ---------------------------------------------------------------
delete from public.opportunity_history where organization_id = '00000000-0000-4000-8000-aaaa00000001';
delete from public.audit_log where organization_id = '00000000-0000-4000-8000-aaaa00000001' and action in ('opportunity.reassigned','opportunity.bulk_reassigned');
delete from public.activities where organization_id = '00000000-0000-4000-8000-aaaa00000001' and text like 'Reassigned to you:%';
delete from public.opportunities where id in ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000e2','00000000-0000-4000-8000-0000000000e3');
delete from public.organization_members where organization_id = '00000000-0000-4000-8000-aaaa00000001';
delete from public.organizations where id = '00000000-0000-4000-8000-aaaa00000001';

raise notice 'ALL PHASE 4 TESTS PASSED';
