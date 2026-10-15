-- Phase 6 CRM regression checks.
-- Run in the Supabase SQL Editor after schema.sql and patch-03-accounts-contacts.sql.
-- Fixtures use fixed IDs and are safe to rerun.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000aa01', 'authenticated', 'authenticated', 'owner_a@phase6.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000aa02', 'authenticated', 'authenticated', 'rep_a@phase6.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rep A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000aa03', 'authenticated', 'authenticated', 'owner_b@phase6.test', crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Owner B"}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, full_name)
values
  ('00000000-0000-4000-8000-00000000aa01', 'Owner A'),
  ('00000000-0000-4000-8000-00000000aa02', 'Rep A'),
  ('00000000-0000-4000-8000-00000000aa03', 'Owner B')
on conflict (id) do update set full_name = excluded.full_name;

insert into public.organizations (id, name, slug, tag, created_by, onboarding_completed)
values
  ('00000000-0000-4000-8000-00000000ab01', 'Phase6 Org A', 'phase6-org-a', 'phase6-a', '00000000-0000-4000-8000-00000000aa01', true),
  ('00000000-0000-4000-8000-00000000ab02', 'Phase6 Org B', 'phase6-org-b', 'phase6-b', '00000000-0000-4000-8000-00000000aa03', true)
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, role, status)
values
  ('00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000aa01', 'owner', 'active'),
  ('00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000aa02', 'sales_rep', 'active'),
  ('00000000-0000-4000-8000-00000000ab02', '00000000-0000-4000-8000-00000000aa03', 'owner', 'active')
on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';

insert into public.accounts (id, organization_id, name)
values
  ('00000000-0000-4000-8000-00000000ac01', '00000000-0000-4000-8000-00000000ab01', 'Phase6 Account A'),
  ('00000000-0000-4000-8000-00000000ac02', '00000000-0000-4000-8000-00000000ab02', 'Phase6 Account B')
on conflict (id) do nothing;

insert into public.contacts (id, organization_id, account_id, full_name)
values
  ('00000000-0000-4000-8000-00000000ad01', '00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000ac01', 'Phase6 Contact A')
on conflict (id) do nothing;

-- The opportunities ownership trigger requires a signed-in caller
-- (auth.uid()); configure Owner A's claims first so the inserts below reach
-- the composite-FK checks they are actually testing.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000aa01","role":"authenticated","email":"owner_a@phase6.test"}', false);

-- Composite FKs must reject a contact linked to an account in another org.
do $$
begin
  begin
    insert into public.contacts (organization_id, account_id, full_name)
    values ('00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000ac02', 'Cross-org Contact');
    raise exception 'FAIL: cross-organization contact/account link was accepted';
  exception
    when foreign_key_violation then
      raise notice 'PASS: contact/account links cannot cross organizations';
  end;
  begin
    insert into public.opportunities (
      id, organization_id, company, stage, value, probability, owner, owner_id,
      created_by, expected_close_date, created_date, account_id
    )
    values (
      '00000000-0000-4000-8000-00000000ae01',
      '00000000-0000-4000-8000-00000000ab01',
      'Cross-org Deal', 'Lead', 100, 10, 'Owner A',
      '00000000-0000-4000-8000-00000000aa01',
      '00000000-0000-4000-8000-00000000aa01',
      current_date, current_date,
      '00000000-0000-4000-8000-00000000ac02'
    );
    raise exception 'FAIL: cross-organization opportunity/account link was accepted';
  exception
    when foreign_key_violation then
      raise notice 'PASS: opportunity/account links cannot cross organizations';
  end;
end $$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000aa02","role":"authenticated","email":"rep_a@phase6.test"}', false);
set role authenticated;

do $$
declare
  v_own_accounts integer;
  v_foreign_accounts integer;
  v_deleted integer;
begin
  select count(*) into v_own_accounts from public.accounts
  where id = '00000000-0000-4000-8000-00000000ac01';
  select count(*) into v_foreign_accounts from public.accounts
  where id = '00000000-0000-4000-8000-00000000ac02';
  if v_own_accounts <> 1 or v_foreign_accounts <> 0 then
    raise exception 'FAIL: account reads are not organization-scoped';
  end if;

  insert into public.contacts (organization_id, account_id, full_name)
  values ('00000000-0000-4000-8000-00000000ab01', '00000000-0000-4000-8000-00000000ac01', 'Rep Added Contact');

  delete from public.accounts
  where id = '00000000-0000-4000-8000-00000000ac01';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 0 then
    raise exception 'FAIL: sales rep deleted an account';
  end if;
  raise notice 'PASS: sales rep can read/create within org but cannot delete shared accounts';
end $$;

reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000aa01","role":"authenticated","email":"owner_a@phase6.test"}', false);
set role authenticated;

do $$
declare
  v_deleted integer;
  v_account_id uuid;
begin
  delete from public.accounts
  where id = '00000000-0000-4000-8000-00000000ac01';
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'FAIL: organization owner could not delete an account';
  end if;

  select account_id into v_account_id from public.contacts
  where id = '00000000-0000-4000-8000-00000000ad01';
  if v_account_id is not null then
    raise exception 'FAIL: deleting an account did not unlink its contacts';
  end if;
  raise notice 'PASS: owner can delete account; contact is retained with its account link cleared';
end $$;

reset role;
select set_config('request.jwt.claims', '', false);
