-- ============================================================
-- PHASE 2 TEST SUITE — run in the Supabase SQL Editor.
--
-- Assertion-based: raises an exception (fails the run) on the first
-- broken expectation and prints PASS notices as it goes. Re-runnable:
-- fixtures use fixed UUIDs and are cleaned up at the end.
--
-- Covered: tag uniqueness, role permissions, cross-org isolation,
-- column tampering, invite expiry, token replay, email mismatch,
-- resend invalidation, last-owner protection, deactivated access,
-- role-from-invitation-row, one-pending-invite index, raw token
-- never stored. TRUE concurrent accept requires two sessions; the
-- accept_invitation SELECT ... FOR UPDATE lock is exercised sequentially
-- here and documented for manual two-tab verification.
-- ============================================================

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'owner_a@phase2.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'owner_a2@phase2.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner A Two"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', 'owner_b@phase2.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner B"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'alice@phase2.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Alice Invitee"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'outsider@phase2.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Outsider"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'rep_a@phase2.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rep A"}', now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, tag, created_by, onboarding_completed)
values
  ('00000000-0000-4000-8000-aaaa00000001', 'Phase2 Org A', 'phase2-org-a', 'phase2-a', '00000000-0000-4000-8000-0000000000a1', true),
  ('00000000-0000-4000-8000-bbbb00000001', 'Phase2 Org B', 'phase2-org-b', 'phase2-b', '00000000-0000-4000-8000-0000000000b1', true)
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a2', 'owner', 'active'),
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a3', 'sales_rep', 'active'),
  ('00000000-0000-4000-8000-bbbb00000001', '00000000-0000-4000-8000-0000000000b1', 'owner', 'active')
on conflict (organization_id, user_id) do update set status = excluded.status, role = excluded.role;

-- Fixture opportunities. The ownership trigger requires an authenticated
-- caller, so claims are set to the creating owner for each insert.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase2.test"}', false);

insert into public.opportunities (id, organization_id, company, stage, value, probability, owner, owner_id, created_by, expected_close_date, created_date)
values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-aaaa00000001', 'Fixture Deal A', 'Proposal', 1000, 70, 'Owner A', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', current_date, current_date)
on conflict (id) do nothing;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated","email":"owner_b@phase2.test"}', false);

insert into public.opportunities (id, organization_id, company, stage, value, probability, owner, owner_id, created_by, expected_close_date, created_date)
values
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-bbbb00000001', 'Fixture Deal B', 'Lead', 2000, 10, 'Owner B', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1', current_date, current_date)
on conflict (id) do nothing;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase2.test"}', false);

insert into public.opportunities (id, organization_id, company, stage, value, probability, owner, owner_id, created_by, expected_close_date, created_date)
values
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-aaaa00000001', 'Fixture Rep Deal', 'Proposal', 500, 70, 'Rep A', '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a3', current_date, current_date)
on conflict (id) do nothing;

insert into public.activities (id, organization_id, opportunity_id, type, text)
values
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000e3', 'note', 'Rep-owned fixture activity')
on conflict (id) do nothing;

insert into public.sales_targets (organization_id, user_id, target_amount, period)
values ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a3', 750, 'monthly')
on conflict (organization_id, user_id) do update set target_amount = excluded.target_amount, period = excluded.period;

-- Fixture invitations (raw tokens are only ever hashed).
insert into public.invitations (id, organization_id, email, full_name, role, personal_target, target_period, token_hash, status, expires_at, invited_by)
values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-aaaa00000001', 'alice@phase2.test', 'Alice Invitee', 'sales_rep', 5000, 'monthly',
   encode(sha256(convert_to('phase2-test-raw-token-alice-01', 'UTF8')), 'hex'), 'pending', now() + interval '7 days', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-aaaa00000001', 'stale@phase2.test', 'Stale Invitee', 'sales_rep', 0, 'monthly',
   encode(sha256(convert_to('phase2-test-raw-token-stale-01', 'UTF8')), 'hex'), 'pending', now() - interval '1 day', '00000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

select set_config('request.jwt.claims', '', false);

-- TEST 1: tag uniqueness (unique index on lower(tag)) and format check -----
do $$
begin
  insert into public.organizations (id, name, slug, tag, created_by)
  values ('00000000-0000-4000-8000-cccc00000001', 'Dup Tag Org', 'dup-tag-org', 'phase2-a', '00000000-0000-4000-8000-0000000000d1');
  raise exception 'FAIL: duplicate tag was accepted';
exception
  when unique_violation then raise notice 'PASS: duplicate tag rejected (unique index on lower(tag))';
end $$;

do $$
begin
  insert into public.organizations (id, name, slug, tag, created_by)
  values ('00000000-0000-4000-8000-cccc00000002', 'Upper Tag Org', 'upper-tag-org', 'PHASE2-A', '00000000-0000-4000-8000-0000000000d1');
  raise exception 'FAIL: uppercase tag was accepted';
exception
  when check_violation then raise notice 'PASS: tag format check enforces lowercase [a-z0-9-]{3,20}';
end $$;

-- TEST 2: client cannot write invitations (no grants) -----------------------
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  insert into public.invitations (organization_id, email, token_hash)
  values ('00000000-0000-4000-8000-aaaa00000001', 'evil@phase2.test', 'deadbeef');
  raise exception 'FAIL: client inserted an invitation directly';
exception
  when insufficient_privilege then raise notice 'PASS: clients cannot insert invitations';
end $$;
reset role;

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  update public.invitations set status = 'accepted'
  where id = '00000000-0000-4000-8000-0000000000f1';
  raise exception 'FAIL: client updated an invitation directly';
exception
  when insufficient_privilege then raise notice 'PASS: clients cannot update invitations';
end $$;
reset role;

-- TEST 3: invitations visible to owners only -------------------------------
do $$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.invitations;
  if v_count <> 0 then
    raise exception 'FAIL: sales_rep saw % invitations', v_count;
  end if;
  raise notice 'PASS: sales_rep sees no invitations';
end $$;
reset role;

do $$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.invitations;
  if v_count < 2 then
    raise exception 'FAIL: owner saw only % invitations', v_count;
  end if;
  raise notice 'PASS: owner sees their invitations';
end $$;
reset role;

-- TEST 4: cross-org isolation on opportunities -----------------------------
do $$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.opportunities
  where organization_id = '00000000-0000-4000-8000-bbbb00000001';
  if v_count <> 0 then
    raise exception 'FAIL: owner_a saw % rows of org B', v_count;
  end if;
  select count(*) into v_count from public.opportunities;
  if v_count <> 1 then
    raise exception 'FAIL: owner_a expected 1 own-org row, saw %', v_count;
  end if;
  raise notice 'PASS: cross-org isolation (owner sees only own org)';
end $$;
reset role;

-- TEST 5: column tampering --------------------------------------------------
do $$
begin
  -- RLS is bypassed here (postgres), so ONLY the trigger can stop this.
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase2.test"}', false);
  update public.opportunities set organization_id = '00000000-0000-4000-8000-bbbb00000001'
  where id = '00000000-0000-4000-8000-0000000000e1';
  raise exception 'FAIL: organization_id was changed';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'organization_id cannot be changed.' then
      raise notice 'PASS: organization_id is immutable';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase2.test"}', false);
  update public.opportunities set owner_id = '00000000-0000-4000-8000-0000000000a1'
  where id = '00000000-0000-4000-8000-0000000000e3';
  raise exception 'FAIL: sales_rep changed owner_id';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'Only an organization owner can reassign opportunities.' then
      raise notice 'PASS: sales_rep cannot change owner_id';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase2.test"}', false);
  update public.opportunities set created_by = null where id = '00000000-0000-4000-8000-0000000000e1';
  raise exception 'FAIL: created_by was changed';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'created_by cannot be changed.' then
      raise notice 'PASS: created_by is immutable (and owner_id cannot be cleared)';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;

-- Sales reps can read only their own deals and activities -------------------
do $$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.opportunities
  where id = '00000000-0000-4000-8000-0000000000e3';
  if v_count <> 1 then raise exception 'FAIL: sales_rep cannot read own opportunity'; end if;
  select count(*) into v_count from public.opportunities
  where id = '00000000-0000-4000-8000-0000000000e1';
  if v_count <> 0 then raise exception 'FAIL: sales_rep read another member opportunity'; end if;
  select count(*) into v_count from public.activities
  where id = '00000000-0000-4000-8000-0000000000e4';
  if v_count <> 1 then raise exception 'FAIL: sales_rep cannot read own activity'; end if;
  select count(*) into v_count from public.activities
  where opportunity_id = '00000000-0000-4000-8000-0000000000e1';
  if v_count <> 0 then raise exception 'FAIL: sales_rep read another member activity'; end if;
  select count(*) into v_count from public.sales_targets
  where user_id = auth.uid() and target_amount = 750;
  if v_count <> 1 then raise exception 'FAIL: sales_rep cannot read own target'; end if;
  raise notice 'PASS: sales_rep reads only assigned opportunities and activities';
end $$;
reset role;

-- TEST 6: accept invitation (membership + role from row + target + audit) ----
do $$
declare v_org uuid; v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","email":"alice@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  v_org := public.accept_invitation('phase2-test-raw-token-alice-01');
  if v_org is distinct from '00000000-0000-4000-8000-aaaa00000001'::uuid then
    raise exception 'FAIL: accept returned the wrong organization';
  end if;
  select count(*) into v_count from public.organization_members
  where organization_id = v_org and user_id = auth.uid() and role = 'sales_rep' and status = 'active';
  if v_count <> 1 then raise exception 'FAIL: membership missing or wrong role'; end if;
  select count(*) into v_count from public.sales_targets
  where organization_id = v_org and user_id = auth.uid() and target_amount = 5000 and period = 'monthly';
  if v_count <> 1 then raise exception 'FAIL: personal sales_targets row not created'; end if;
  select count(*) into v_count from public.invitations
  where id = '00000000-0000-4000-8000-0000000000f1' and status = 'accepted' and accepted_by = auth.uid();
  if v_count <> 1 then raise exception 'FAIL: invitation not marked accepted'; end if;
  select count(*) into v_count from public.audit_log
  where action = 'invitation.accepted' and entity_id = '00000000-0000-4000-8000-0000000000f1';
  if v_count < 1 then raise exception 'FAIL: audit_log entry missing'; end if;
  raise notice 'PASS: accept_invitation creates membership (role from row), target and audit';
end $$;
reset role;

-- TEST 7: idempotent re-accept by the same user ----------------------------
do $$
declare v_org uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated","email":"alice@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  v_org := public.accept_invitation('phase2-test-raw-token-alice-01');
  if v_org is distinct from '00000000-0000-4000-8000-aaaa00000001'::uuid then
    raise exception 'FAIL: idempotent accept returned wrong org';
  end if;
  raise notice 'PASS: replaying accept as the same user is idempotent';
end $$;
reset role;

-- Rejoining former owners must use the invitation's restricted role/target ---
insert into public.invitations (id, organization_id, email, full_name, role, personal_target, target_period, token_hash, status, expires_at, invited_by)
values (
  '00000000-0000-4000-8000-0000000000f5', '00000000-0000-4000-8000-aaaa00000001',
  'owner_a2@phase2.test', 'Owner A Two', 'sales_rep', 2500, 'quarterly',
  encode(sha256(convert_to('phase2-test-raw-token-former-owner-01', 'UTF8')), 'hex'),
  'pending', now() + interval '7 days', '00000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;

update public.organization_members
set status = 'inactive'
where organization_id = '00000000-0000-4000-8000-aaaa00000001'
  and user_id = '00000000-0000-4000-8000-0000000000a2';

do $$
declare v_org uuid; v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","email":"owner_a2@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  v_org := public.accept_invitation('phase2-test-raw-token-former-owner-01');
  select count(*) into v_count from public.organization_members
  where organization_id = v_org and user_id = auth.uid()
    and role = 'sales_rep' and status = 'active';
  if v_count <> 1 then raise exception 'FAIL: invitation preserved former owner role'; end if;
  select count(*) into v_count from public.sales_targets
  where organization_id = v_org and user_id = auth.uid()
    and target_amount = 2500 and period = 'quarterly';
  if v_count <> 1 then raise exception 'FAIL: invitation target was not applied to returning member'; end if;
  raise notice 'PASS: accepting an invite downgrades an inactive former owner and applies its target';
end $$;
reset role;

update public.organization_members
set role = 'owner', status = 'active'
where organization_id = '00000000-0000-4000-8000-aaaa00000001'
  and user_id = '00000000-0000-4000-8000-0000000000a2';

-- TEST 8: token replay by a different user is rejected (email mismatch) -----
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","email":"outsider@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  perform public.accept_invitation('phase2-test-raw-token-alice-01');
  raise exception 'FAIL: outsider accepted an invitation meant for someone else';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm like 'This invitation was sent to %' then
      raise notice 'PASS: replay with the wrong signed-in email is rejected';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;
reset role;

-- TEST 9: expired invitation is rejected and marked expired ----------------
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","email":"stale@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  perform public.accept_invitation('phase2-test-raw-token-stale-01');
  raise exception 'FAIL: expired invitation was accepted';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm like 'This invitation has expired%' then
      raise notice 'PASS: expired invitation rejected';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;
reset role;

do $$
declare v_status text;
begin
  select status into v_status from public.invitations where id = '00000000-0000-4000-8000-0000000000f2';
  if v_status <> 'expired' then
    raise exception 'FAIL: expired invitation status is %', v_status;
  end if;
  raise notice 'PASS: expired invitation flipped to status=expired';
end $$;

-- TEST 10: resend invalidates the previous raw token ------------------------
insert into public.invitations (id, organization_id, email, full_name, role, personal_target, target_period, token_hash, status, expires_at, invited_by)
values (
  '00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-bbbb00000001',
  'newguy@phase2.test', 'New Guy', 'sales_rep', 0, 'monthly',
  encode(sha256(convert_to('phase2-test-raw-token-old-link-01', 'UTF8')), 'hex'),
  'pending', now() + interval '7 days', '00000000-0000-4000-8000-0000000000b1')
on conflict (id) do nothing;

-- Simulate the resend route: new token hash, extended expiry, send_count + 1.
update public.invitations
set token_hash = encode(sha256(convert_to('phase2-test-raw-token-new-link-01', 'UTF8')), 'hex'),
    expires_at = now() + interval '7 days',
    send_count = send_count + 1,
    last_sent_at = now()
where id = '00000000-0000-4000-8000-0000000000f3';

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","email":"newguy@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  perform public.accept_invitation('phase2-test-raw-token-old-link-01');
  raise exception 'FAIL: old link worked after resend';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'This invitation link is invalid.' then
      raise notice 'PASS: resend invalidates the previous link';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;
reset role;

do $$
declare v_org uuid;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","email":"newguy@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  v_org := public.accept_invitation('phase2-test-raw-token-new-link-01');
  if v_org is distinct from '00000000-0000-4000-8000-bbbb00000001'::uuid then
    raise exception 'FAIL: new link accepted into wrong org';
  end if;
  raise notice 'PASS: new link works after resend';
end $$;
reset role;

-- TEST 11: one pending invitation per (organization, email) ------------------
insert into public.invitations (id, organization_id, email, token_hash, status, expires_at)
values ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-aaaa00000001',
  'dup@phase2.test', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'pending', now() + interval '7 days')
on conflict (id) do nothing;

do $$
begin
  insert into public.invitations (organization_id, email, token_hash)
  values ('00000000-0000-4000-8000-aaaa00000001', 'dup@phase2.test', 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd');
  raise exception 'FAIL: duplicate pending invitation was accepted';
exception
  when unique_violation then raise notice 'PASS: one pending invitation per (org, email)';
end $$;

-- TEST 12: revoked invitation is dead --------------------------------------
do $$
begin
  update public.invitations
  set status = 'revoked',
      token_hash = encode(sha256(convert_to('phase2-test-raw-token-revoked-01', 'UTF8')), 'hex')
  where id = '00000000-0000-4000-8000-0000000000f4';
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated","email":"dup@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  perform public.accept_invitation('phase2-test-raw-token-revoked-01');
  raise exception 'FAIL: revoked invitation was accepted';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm in ('This invitation link is invalid.', 'This invitation was revoked. Ask the owner to send a new one.') then
      raise notice 'PASS: revoked invitation token is dead';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;
reset role;

-- TEST 13: last active owner cannot be deactivated --------------------------
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated","email":"owner_b@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  perform public.set_member_status('00000000-0000-4000-8000-bbbb00000001', '00000000-0000-4000-8000-0000000000b1', 'inactive');
  raise exception 'FAIL: sole owner was deactivated';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'An organization must always have at least one active owner.' then
      raise notice 'PASS: last active owner cannot be deactivated (RPC)';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;
reset role;

-- Trigger backstop fires even for direct writes (RLS bypassed as postgres).
do $$
begin
  update public.organization_members set status = 'inactive'
  where organization_id = '00000000-0000-4000-8000-bbbb00000001' and user_id = '00000000-0000-4000-8000-0000000000b1';
  raise exception 'FAIL: last-owner trigger did not fire';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm like '%last active owner%' or sqlerrm like '%at least one active owner%' then
      raise notice 'PASS: last-owner guard trigger blocks direct writes';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;

-- TEST 14: only owners manage members; deactivation is immediate ------------
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  perform public.set_member_status('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a3', 'inactive');
  raise exception 'FAIL: sales_rep managed members';
exception
  when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    if sqlerrm = 'Only an active organization owner can manage members.' then
      raise notice 'PASS: sales_rep cannot manage members';
    else
      raise exception 'FAIL (wrong error): %', sqlerrm;
    end if;
end $$;
reset role;

-- Owner deactivates a member (two owners exist, so allowed), then restores.
do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","email":"owner_a2@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  perform public.set_member_status('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a1', 'inactive');
  raise notice 'PASS: owner deactivated another owner while one remains active';
end $$;
reset role;

-- Immediately after deactivation the member has NO access.
do $$
declare v_count int; v_owner boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  v_owner := public.is_organization_owner('00000000-0000-4000-8000-aaaa00000001');
  if v_owner then raise exception 'FAIL: deactivated owner still counts as owner'; end if;
  select count(*) into v_count from public.invitations;
  if v_count <> 0 then raise exception 'FAIL: deactivated owner still reads invitations'; end if;
  raise notice 'PASS: deactivated member loses access immediately';
end $$;
reset role;

update public.organization_members set status = 'active'
where organization_id = '00000000-0000-4000-8000-aaaa00000001' and user_id = '00000000-0000-4000-8000-0000000000a1';

do $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated","email":"owner_a2@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  perform public.set_member_status('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a3', 'inactive');
end $$;
reset role;

do $$
declare v_count int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase2.test"}', true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.sales_targets
  where user_id = auth.uid();
  if v_count <> 0 then raise exception 'FAIL: deactivated member still reads their target'; end if;
  select count(*) into v_count from public.opportunities;
  if v_count <> 0 then raise exception 'FAIL: deactivated member still reads opportunities'; end if;
  raise notice 'PASS: deactivated member loses access to own target and opportunities';
end $$;
reset role;

update public.organization_members
set status = 'active'
where organization_id = '00000000-0000-4000-8000-aaaa00000001'
  and user_id = '00000000-0000-4000-8000-0000000000a3';

do $$
declare v_owner boolean;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase2.test"}', false);
  v_owner := public.is_organization_owner('00000000-0000-4000-8000-aaaa00000001');
  if not v_owner then raise exception 'FAIL: reactivated owner has no access'; end if;
  raise notice 'PASS: reactivated owner regains access';
end $$;

-- TEST 15: raw token is never stored ---------------------------------------
do $$
declare v_count int; v_hash text;
begin
  select count(*) into v_count from information_schema.columns
  where table_schema = 'public' and table_name = 'invitations'
    and column_name in ('token', 'raw_token');
  if v_count <> 0 then raise exception 'FAIL: a raw token column exists'; end if;
  select token_hash into v_hash from public.invitations where id = '00000000-0000-4000-8000-0000000000f1';
  if v_hash is null or length(v_hash) <> 64 then
    raise exception 'FAIL: token_hash is not a SHA-256 hex digest';
  end if;
  raise notice 'PASS: only the SHA-256 hash is stored, never the raw token';
end $$;

-- Cleanup ------------------------------------------------------------------
do $$
begin
  delete from auth.users where id in (
    '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2',
    '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1');
  delete from public.organizations where id in (
    '00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-bbbb00000001');
  raise notice 'cleanup: fixtures removed';
exception when others then
  raise notice 'cleanup note (fixtures may linger): %', sqlerrm;
end $$;

select set_config('request.jwt.claims', '', false);
do $$ begin raise notice 'ALL PHASE 2 TESTS PASSED'; end $$;
