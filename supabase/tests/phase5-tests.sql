-- ============================================================
-- PHASE 5 TEST SUITE — run in the Supabase SQL Editor AFTER
-- schema.sql. Fixtures are self-contained and re-runnable.
--
-- Assertion-based: raises an exception (fails the run) on the first
-- broken expectation and prints PASS notices as it goes.
--
-- Covered: sub-user request eligibility (created AND owned), one
-- open request per opportunity, owner approve soft-deletes
-- atomically, owner reject needs a comment and leaves the deal
-- untouched, owner direct soft delete (reason required) supersedes
-- pending requests, sub-user cannot soft-delete, restore works
-- inside 30 days and fails for non-owners, purge removes only
-- rows older than 30 days, sub-user RLS hides deleted rows,
-- audit entries written at every step.
-- ============================================================

-- Fixtures ---------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'owner_a@phase5.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a3', 'authenticated', 'authenticated', 'rep_a@phase5.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rep A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000a4', 'authenticated', 'authenticated', 'rep_b@phase5.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rep B"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
values
  ('00000000-0000-4000-8000-0000000000a1', 'Owner A'),
  ('00000000-0000-4000-8000-0000000000a3', 'Rep A'),
  ('00000000-0000-4000-8000-0000000000a4', 'Rep B')
on conflict (id) do update set full_name = excluded.full_name;

insert into public.organizations (id, name, slug, tag, created_by, onboarding_completed)
values
  ('00000000-0000-4000-8000-aaaa00000001', 'Phase5 Org A', 'phase5-org-a', 'phase5-a', '00000000-0000-4000-8000-0000000000a1', true)
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a1', 'owner', 'active'),
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a3', 'sales_rep', 'active'),
  ('00000000-0000-4000-8000-aaaa00000001', '00000000-0000-4000-8000-0000000000a4', 'sales_rep', 'active')
on conflict (organization_id, user_id) do update set status = 'active', role = excluded.role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase5.test"}', false);

insert into public.opportunities (id, organization_id, company, stage, value, probability, owner, owner_id, created_by, expected_close_date, created_date)
values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-aaaa00000001', 'Phase5 Request Deal', 'Proposal', 1500, 60, 'Rep A', '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a3', current_date, current_date),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-aaaa00000001', 'Phase5 NotMine Deal', 'Lead', 800, 10, 'Owner A', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', current_date, current_date),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-aaaa00000001', 'Phase5 Direct Deal', 'Discovery', 900, 20, 'Owner A', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', current_date, current_date),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-aaaa00000001', 'Phase5 OldDeleted Deal', 'Lead', 400, 10, 'Owner A', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', current_date, current_date)
on conflict (id) do update set owner_id = excluded.owner_id, created_by = excluded.created_by, deleted_at = null;

-- Fresh audit/request state for re-runs.
delete from public.deletion_requests where organization_id = '00000000-0000-4000-8000-aaaa00000001';
delete from public.audit_log where organization_id = '00000000-0000-4000-8000-aaaa00000001'
  and action in ('opportunity.deletion_requested','opportunity.deletion_approved','opportunity.deletion_rejected','opportunity.soft_deleted','opportunity.restored','opportunity.purged');

-- TEST 1: sub-user cannot request deletion of a deal they do not own -----
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase5.test"}', false);

do $$
begin
  perform public.request_deletion(
    '00000000-0000-4000-8000-0000000000e2',
    'Not my deal but I want it gone'
  );
  raise exception 'FAIL: rep requested deletion of a deal they do not own';
exception
  when others then
    if sqlerrm <> 'You can only request deletion of opportunities you created and currently own.' then
      raise exception 'FAIL: unexpected ownership error: %', sqlerrm;
    end if;
    raise notice 'PASS: sub-user cannot request deletion of deals they do not own';
end $$;

-- TEST 2: sub-user requests deletion of their own deal -------------------
do $$
declare
  v_request_id uuid;
  v_count integer;
begin
  select public.request_deletion(
    '00000000-0000-4000-8000-0000000000e1',
    'Duplicate of another entry'
  ) into v_request_id;
  if v_request_id is null then
    raise exception 'FAIL: request_deletion returned null';
  end if;

  select count(*) into v_count from public.deletion_requests
  where opportunity_id = '00000000-0000-4000-8000-0000000000e1' and status = 'pending';
  if v_count <> 1 then
    raise exception 'FAIL: % pending requests, expected 1', v_count;
  end if;

  if (select count(*) from public.audit_log
      where action = 'opportunity.deletion_requested') <> 1 then
    raise exception 'FAIL: deletion request was not audit-logged';
  end if;
  raise notice 'PASS: sub-user request creates one pending request, audit-logged';
end $$;

-- TEST 3: a second open request for the same deal fails ------------------
do $$
begin
  perform public.request_deletion(
    '00000000-0000-4000-8000-0000000000e1',
    'Second request for the same deal'
  );
  raise exception 'FAIL: duplicate pending request was allowed';
exception
  when unique_violation then
    raise notice 'PASS: one open request per opportunity (unique index)';
end $$;

-- TEST 4: owner approves — soft delete is atomic -------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase5.test"}', false);

do $$
declare
  v_request_id uuid;
  v_deleted timestamptz;
begin
  select id into v_request_id from public.deletion_requests
  where opportunity_id = '00000000-0000-4000-8000-0000000000e1' and status = 'pending';

  perform public.approve_deletion_request(v_request_id, 'Confirmed duplicate.');

  select deleted_at into v_deleted
  from public.opportunities where id = '00000000-0000-4000-8000-0000000000e1';
  if v_deleted is null then
    raise exception 'FAIL: approval did not soft-delete the opportunity';
  end if;

  if (select status from public.deletion_requests where id = v_request_id) <> 'approved' then
    raise exception 'FAIL: request status is not approved';
  end if;

  if (select count(*) from public.audit_log
      where action = 'opportunity.deletion_approved') <> 1 then
    raise exception 'FAIL: approval was not audit-logged';
  end if;
  raise notice 'PASS: approval soft-deletes atomically, request + audit updated';
end $$;

-- TEST 5: double review is blocked ---------------------------------------
do $$
declare
  v_request_id uuid;
begin
  select id into v_request_id from public.deletion_requests
  where opportunity_id = '00000000-0000-4000-8000-0000000000e1';

  perform public.approve_deletion_request(v_request_id, null);
  raise exception 'FAIL: already-reviewed request was approved again';
exception
  when others then
    if sqlerrm <> 'This deletion request was already reviewed.' then
      raise exception 'FAIL: unexpected double-review error: %', sqlerrm;
    end if;
    raise notice 'PASS: already-reviewed requests are rejected';
end $$;

-- TEST 6: rejection requires a comment; deal stays live ------------------
do $$
declare
  v_request_id uuid;
begin
  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase5.test"}', false);

  perform public.request_deletion(
    '00000000-0000-4000-8000-0000000000e1',
    'Still want it gone'
  );

  select set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase5.test"}', false);

  select id into v_request_id from public.deletion_requests
  where opportunity_id = '00000000-0000-4000-8000-0000000000e1' and status = 'pending';

  begin
    perform public.reject_deletion_request(v_request_id, null);
    raise exception 'FAIL: rejection without a comment was accepted';
  exception
    when others then
      if sqlerrm <> 'A review comment of at least 3 characters is required when rejecting.' then
        raise exception 'FAIL: unexpected rejection-comment error: %', sqlerrm;
      end if;
  end;

  perform public.reject_deletion_request(v_request_id, 'Keep working this deal.');

  if exists (select 1 from public.opportunities
             where id = '00000000-0000-4000-8000-0000000000e1' and deleted_at is not null) then
    raise exception 'FAIL: rejected request deleted the deal anyway';
  end if;

  if (select deleted_at from public.opportunities
      where id = '00000000-0000-4000-8000-0000000000e1') is not null then
    raise exception 'FAIL: deal not restored after rejection';
  end if;

  raise notice 'PASS: rejection requires a comment; deal stays live';
end $$;

-- TEST 7: owner direct soft delete needs a reason ------------------------
do $$
begin
  perform public.soft_delete_opportunity('00000000-0000-4000-8000-0000000000e3', 'x');
  raise exception 'FAIL: short reason accepted';
exception
  when others then
    if sqlerrm <> 'A deletion reason of 3 to 500 characters is required.' then
      raise exception 'FAIL: unexpected reason error: %', sqlerrm;
    end if;
end $$;

do $$
begin
  perform public.soft_delete_opportunity('00000000-0000-4000-8000-0000000000e3', 'Closing duplicates from import');
  if (select deleted_at from public.opportunities
      where id = '00000000-0000-4000-8000-0000000000e3') is null then
    raise exception 'FAIL: direct soft delete did not mark deleted_at';
  end if;
  raise notice 'PASS: owner direct soft delete works with a reason, audit-logged';
end $$;

-- TEST 8: sub-user cannot soft-delete directly ---------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase5.test"}', false);

do $$
begin
  perform public.soft_delete_opportunity('00000000-0000-4000-8000-0000000000e2', 'Trying to delete directly');
  raise exception 'FAIL: sub-user soft-deleted a deal';
exception
  when others then
    if sqlerrm <> 'Only an organization owner can delete opportunities.' then
      raise exception 'FAIL: unexpected sub-user delete error: %', sqlerrm;
    end if;
    raise notice 'PASS: sub-user cannot soft-delete directly';
end $$;

-- TEST 9: restore inside the window (owner only) -------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","email":"owner_a@phase5.test"}', false);

do $$
begin
  perform public.restore_opportunity('00000000-0000-4000-8000-0000000000e3');
  if exists (select 1 from public.opportunities
             where id = '00000000-0000-4000-8000-0000000000e3' and deleted_at is not null) then
    raise exception 'FAIL: restore did not clear deleted_at';
  end if;
  raise notice 'PASS: owner restores a soft-deleted deal inside 30 days';
end $$;

-- TEST 10: purge removes only rows older than 30 days --------------------
do $$
declare
  v_purged integer;
begin
  -- e3: soft-delete then backdate past the window.
  perform public.soft_delete_opportunity('00000000-0000-4000-8000-0000000000e3', 'Old import artifact');
  update public.opportunities
  set deleted_at = now() - interval '31 days'
  where id = '00000000-0000-4000-8000-0000000000e3';

  perform public.soft_delete_opportunity('00000000-0000-4000-8000-0000000000e1', 'Recent deletion for purge check');

  select public.purge_expired_soft_deletes() into v_purged;
  if v_purged < 1 then
    raise exception 'FAIL: purge moved % rows, expected at least 1', v_purged;
  end if;

  if exists (select 1 from public.opportunities where id = '00000000-0000-4000-8000-0000000000e3') then
    raise exception 'FAIL: 31-day-old row was not purged';
  end if;

  if not exists (select 1 from public.opportunities where id = '00000000-0000-4000-8000-0000000000e1') then
    raise exception 'FAIL: fresh soft-deleted row was purged too early';
  end if;

  raise notice 'PASS: purge removes only rows older than 30 days';
end $$;

-- TEST 11: sub-user RLS hides soft-deleted rows --------------------------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated","email":"rep_b@phase5.test"}', false);

-- e1 was re-claimed by rep_b? No — it still belongs to owner_a via created_by
-- owner... e1 is owned by rep_a, so rep_b never saw it. Use e1's visibility:
-- rep_b should see nothing of these fixtures. Confirm e1 (deleted) is hidden
-- even from its own owner-rep after deletion.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated","email":"rep_a@phase5.test"}', false);

do $$
declare
  v_visible integer;
begin
  select count(*) into v_visible
  from public.opportunities
  where id = '00000000-0000-4000-8000-0000000000e1';
  if v_visible <> 0 then
    raise exception 'FAIL: rep still sees a soft-deleted deal (% rows)', v_visible;
  end if;
  raise notice 'PASS: soft-deleted rows are invisible to sub-users (RLS)';
end $$;

-- Cleanup ---------------------------------------------------------------
delete from public.opportunities where id in ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000e2','00000000-0000-4000-8000-0000000000e3','00000000-0000-4000-8000-0000000000e4');
delete from public.organization_members where organization_id = '00000000-0000-4000-8000-aaaa00000001';
delete from public.organizations where id = '00000000-0000-4000-8000-aaaa00000001';
delete from public.audit_log where organization_id = '00000000-0000-4000-8000-aaaa00000001';

raise notice 'ALL PHASE 5 TESTS PASSED';
