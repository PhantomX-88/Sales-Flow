create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  team_size text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.workspaces
  add column if not exists settings jsonb not null default '{}'::jsonb;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  company text not null,
  contact text not null default 'Unassigned',
  email text,
  phone text,
  stage text not null check (stage in ('Lead', 'Discovery', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost')),
  value numeric not null default 0 check (value >= 0),
  probability integer not null default 0 check (probability between 0 and 100),
  owner text not null,
  age integer not null default 0,
  expected_close_date date not null default current_date,
  created_date date not null default current_date,
  last_activity text not null default 'Just now',
  lead_source text not null default 'Other',
  notes text,
  closed_date date,
  probability_overridden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  type text not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- Upgrade tables created by earlier versions that did not include workspace isolation.
alter table public.opportunities
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.opportunities
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists company text not null default '',
  add column if not exists stage text not null default 'Lead',
  add column if not exists value numeric not null default 0,
  add column if not exists probability integer not null default 0,
  add column if not exists owner text not null default 'Unassigned',
  add column if not exists contact text not null default 'Unassigned',
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists age integer not null default 0,
  add column if not exists expected_close_date date not null default current_date,
  add column if not exists created_date date not null default current_date,
  add column if not exists last_activity text not null default 'Just now',
  add column if not exists lead_source text not null default 'Other',
  add column if not exists notes text,
  add column if not exists closed_date date,
  add column if not exists probability_overridden boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.activities
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.activities
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete cascade,
  add column if not exists type text not null default 'note',
  add column if not exists text text not null default '',
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text,
  industry text not null default '',
  country text not null default '',
  expected_sub_users integer not null default 1,
  revenue_target numeric not null default 0 check (revenue_target >= 0),
  currency text not null default 'USD' check (currency in ('NGN', 'USD')),
  target_period text not null default 'quarterly' check (target_period in ('monthly', 'quarterly', 'annual')),
  expected_transactions_per_month integer not null default 0 check (expected_transactions_per_month >= 0),
  average_deal_size numeric not null default 0 check (average_deal_size >= 0),
  team_type text not null default 'inside' check (team_type in ('field', 'inside', 'agency')),
  enabled_features text[] not null default '{}',
  onboarding_completed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations
  add column if not exists name text,
  add column if not exists tag text,
  add column if not exists industry text not null default '',
  add column if not exists country text not null default '',
  add column if not exists expected_sub_users integer not null default 1,
  add column if not exists revenue_target numeric not null default 0,
  add column if not exists currency text not null default 'USD',
  add column if not exists target_period text not null default 'quarterly',
  add column if not exists expected_transactions_per_month integer not null default 0,
  add column if not exists average_deal_size numeric not null default 0,
  add column if not exists team_type text not null default 'inside',
  add column if not exists enabled_features text[] not null default '{}',
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'sales_rep',
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.organization_members
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists role text not null default 'sales_rep',
  add column if not exists status text not null default 'active',
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.organization_members
  alter column role set default 'sales_rep',
  alter column status set default 'active';

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists action text not null default 'organization.updated',
  add column if not exists entity text not null default 'organization',
  add column if not exists entity_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.opportunities
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.activities
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.workspaces
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

do $$
declare
  existing_constraint record;
begin
  for existing_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.organization_members drop constraint %I', existing_constraint.conname);
  end loop;
end;
$$;

create unique index if not exists organization_members_org_user_uidx
  on public.organization_members (organization_id, user_id);

do $$
begin
  if exists (
    select w.created_by
    from public.workspaces w
    join public.organization_members om on om.user_id = w.created_by and om.status = 'active'
    group by w.created_by
    having count(distinct om.organization_id) > 1
  ) then
    raise exception 'A workspace creator belongs to multiple active organizations; resolve the organization mapping before continuing.';
  end if;

  update public.workspaces w
  set organization_id = coalesce(
    w.organization_id,
    (
      select om.organization_id
      from public.organization_members om
      where om.user_id = w.created_by and om.status = 'active'
      limit 1
    ),
    w.id
  );

  insert into public.organizations (id, name, created_by)
  select w.organization_id, w.name, w.created_by
  from public.workspaces w
  on conflict (id) do nothing;

  update public.organizations o
  set name = coalesce(nullif(o.name, ''), w.name),
      created_by = coalesce(o.created_by, w.created_by)
  from public.workspaces w
  where o.id = w.organization_id;

  update public.organizations o
  set onboarding_completed = false
  where exists (select 1 from public.workspaces w where w.organization_id = o.id)
    and (btrim(coalesce(o.industry, '')) = '' or btrim(coalesce(o.country, '')) = '');

  update public.organizations o
  set tag = left(
    coalesce(
      nullif(trim(both '-' from regexp_replace(lower(o.name), '[^a-z0-9]+', '-', 'g')), ''),
      'org'
    ),
    11
  ) || '-' || left(replace(o.id::text, '-', ''), 8)
  where o.tag is null or btrim(o.tag) = '' or o.tag !~ '^[a-z0-9-]{3,20}$';

  insert into public.organization_members (organization_id, user_id, role, status)
    select w.organization_id,
         wm.user_id,
         case when wm.role = 'member' then 'sales_rep' else wm.role end,
         'active'
  from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
  on conflict (organization_id, user_id) do nothing;

  insert into public.organization_members (organization_id, user_id, role, status)
  select o.id, o.created_by, 'owner', 'active'
  from public.organizations o
  where o.created_by is not null
  on conflict (organization_id, user_id) do update
  set role = 'owner', status = 'active';

  update public.organization_members
  set role = 'sales_rep'
  where role = 'member';

  update public.opportunities o
  set organization_id = w.organization_id
  from public.workspaces w
  where o.organization_id is null and o.workspace_id = w.id;

  update public.activities a
  set organization_id = w.organization_id
  from public.workspaces w
  where a.organization_id is null and a.workspace_id = w.id;

  if exists (select 1 from public.organizations where name is null or btrim(name) = '') then
    raise exception 'Organization migration found a row without a name; resolve existing organizations before continuing.';
  end if;

  if exists (select 1 from public.opportunities where organization_id is null) then
    raise exception 'Organization migration found opportunities without a workspace or organization; assign them before continuing.';
  end if;

  if exists (select 1 from public.activities where organization_id is null) then
    raise exception 'Organization migration found activities without a workspace or organization; assign them before continuing.';
  end if;

  if exists (select 1 from public.organization_members where organization_id is null or user_id is null) then
    raise exception 'Organization migration found memberships without an organization or user; resolve them before continuing.';
  end if;

  if exists (select 1 from public.audit_log where organization_id is null) then
    raise exception 'Organization migration found audit entries without an organization; resolve them before continuing.';
  end if;

  if exists (
    select 1 from public.organizations o
    where not exists (
      select 1 from public.organization_members om
      where om.organization_id = o.id and om.role = 'owner' and om.status = 'active'
    )
  ) then
    raise exception 'Organization migration found an organization without an active owner; resolve it before continuing.';
  end if;

  if exists (
    select user_id from public.organization_members
    where status = 'active'
    group by user_id having count(*) > 1
  ) then
    raise exception 'Organization migration found users active in multiple organizations; resolve memberships before continuing.';
  end if;
end;
$$;

alter table public.opportunities alter column organization_id set not null;
alter table public.activities alter column organization_id set not null;
alter table public.organizations alter column name set not null;

alter table public.opportunities alter column workspace_id drop not null;
alter table public.activities alter column workspace_id drop not null;
alter table public.audit_log alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and conname = 'organization_members_role_check'
  ) then
    alter table public.organization_members
      add constraint organization_members_role_check
      check (role in ('owner', 'sales_rep', 'admin', 'sales_manager', 'viewer'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and conname = 'organization_members_status_check'
  ) then
    alter table public.organization_members
      add constraint organization_members_status_check check (status in ('active', 'inactive'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_tag_format_check'
  ) then
    alter table public.organizations
      add constraint organizations_tag_format_check
      check (tag is null or tag ~ '^[a-z0-9-]{3,20}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_currency_check'
  ) then
    alter table public.organizations
      add constraint organizations_currency_check check (currency in ('NGN', 'USD'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_target_period_check'
  ) then
    alter table public.organizations
      add constraint organizations_target_period_check check (target_period in ('monthly', 'quarterly', 'annual'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_team_type_check'
  ) then
    alter table public.organizations
      add constraint organizations_team_type_check check (team_type in ('field', 'inside', 'agency'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_expected_sub_users_check'
  ) then
    alter table public.organizations
      add constraint organizations_expected_sub_users_check check (expected_sub_users >= 0);
  end if;
end;
$$;

create unique index if not exists organizations_tag_lower_uidx
  on public.organizations (lower(tag)) where tag is not null;
create unique index if not exists organization_members_one_active_org_per_user_uidx
  on public.organization_members (user_id) where status = 'active';
create index if not exists opportunities_organization_id_idx on public.opportunities(organization_id);
create index if not exists activities_organization_id_idx on public.activities(organization_id);

-- Keep only legacy display-name columns optional; organization_id is authoritative.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'opportunities'
      and column_name = 'name'
  ) then
    alter table public.opportunities alter column name drop not null;
  end if;

end;
$$;

create index if not exists opportunities_workspace_id_idx on public.opportunities(workspace_id);
create index if not exists activities_workspace_id_idx on public.activities(workspace_id);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_organization_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'owner'
  );
$$;

create or replace function public.is_organization_tag_available(check_tag text, exclude_organization_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(check_tag ~ '^[a-z0-9-]{3,20}$', false)
    and not exists (
      select 1 from public.organizations
      where lower(tag) = lower(check_tag)
        and id is distinct from exclude_organization_id
    );
$$;

create or replace function public.save_organization_setup(
  setup_organization_id uuid,
  setup_name text,
  setup_tag text,
  setup_industry text,
  setup_country text,
  setup_expected_sub_users integer,
  setup_revenue_target numeric,
  setup_currency text,
  setup_target_period text,
  setup_expected_transactions_per_month integer,
  setup_average_deal_size numeric,
  setup_team_type text,
  setup_enabled_features text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_organization_id uuid;
  setup_action text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if setup_name is null or char_length(trim(setup_name)) not between 1 and 120 then
    raise exception 'Company name must be between 1 and 120 characters.';
  end if;
  if not public.is_organization_tag_available(setup_tag, setup_organization_id) then
    raise exception 'Company tag must be available and contain 3-20 lowercase letters, numbers, or hyphens.';
  end if;
  if setup_currency not in ('NGN', 'USD') then raise exception 'Currency must be NGN or USD.'; end if;
  if setup_target_period not in ('monthly', 'quarterly', 'annual') then raise exception 'Invalid target period.'; end if;
  if setup_team_type not in ('field', 'inside', 'agency') then raise exception 'Invalid team type.'; end if;
  if setup_expected_sub_users < 0 or setup_revenue_target < 0
    or setup_expected_transactions_per_month < 0 or setup_average_deal_size < 0 then
    raise exception 'Expected users, targets, transactions, and average deal size must be non-negative.';
  end if;
  if exists (
    select 1 from unnest(coalesce(setup_enabled_features, '{}')) as feature
    where feature not in ('email-whatsapp', 'quotes-proforma', 'payment-tracking', 'ai-follow-up')
  ) then
    raise exception 'Unknown organization feature.';
  end if;

  if setup_organization_id is null then
    if exists (
      select 1 from public.organization_members
      where user_id = auth.uid() and status = 'active'
    ) then
      raise exception 'You already belong to an active organization.';
    end if;
    insert into public.organizations (
      name, tag, industry, country, expected_sub_users, revenue_target, currency,
      target_period, expected_transactions_per_month, average_deal_size, team_type,
      enabled_features, onboarding_completed, created_by
    ) values (
      trim(setup_name), setup_tag, trim(setup_industry), trim(setup_country),
      setup_expected_sub_users, setup_revenue_target, setup_currency, setup_target_period,
      setup_expected_transactions_per_month, setup_average_deal_size, setup_team_type,
      coalesce(setup_enabled_features, '{}'), true, auth.uid()
    ) returning id into saved_organization_id;

    insert into public.organization_members (organization_id, user_id, role, status)
    values (saved_organization_id, auth.uid(), 'owner', 'active');
    setup_action := 'organization.created';
  else
    if not public.is_organization_owner(setup_organization_id) then
      raise exception 'Only an active organization owner can update organization settings.';
    end if;
    update public.organizations
    set name = trim(setup_name),
        tag = setup_tag,
        industry = trim(setup_industry),
        country = trim(setup_country),
        expected_sub_users = setup_expected_sub_users,
        revenue_target = setup_revenue_target,
        currency = setup_currency,
        target_period = setup_target_period,
        expected_transactions_per_month = setup_expected_transactions_per_month,
        average_deal_size = setup_average_deal_size,
        team_type = setup_team_type,
        enabled_features = coalesce(setup_enabled_features, '{}'),
        onboarding_completed = true,
        updated_at = now()
    where id = setup_organization_id;
    saved_organization_id := setup_organization_id;
    setup_action := 'organization.settings_updated';
  end if;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    saved_organization_id,
    auth.uid(),
    setup_action,
    'organization',
    saved_organization_id,
    jsonb_build_object('name', trim(setup_name), 'tag', setup_tag)
  );

  return saved_organization_id;
end;
$$;

revoke all on function public.save_organization_setup(uuid, text, text, text, text, integer, numeric, text, text, integer, numeric, text, text[]) from public, anon;
revoke all on function public.is_organization_tag_available(text, uuid) from public, anon;
grant execute on function public.is_organization_tag_available(text, uuid) to authenticated;
grant execute on function public.save_organization_setup(uuid, text, text, text, text, integer, numeric, text, text, integer, numeric, text, text[]) to authenticated;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop function if exists public.create_workspace(text, text);

create or replace function public.create_workspace(
  workspace_name text,
  workspace_team_size text,
  workspace_settings jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.workspaces (name, team_size, created_by, settings)
  values (trim(workspace_name), workspace_team_size, auth.uid(), coalesce(workspace_settings, '{}'::jsonb))
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

grant execute on function public.create_workspace(text, text, jsonb) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.audit_log enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;

grant select on public.profiles, public.organizations, public.organization_members, public.audit_log to authenticated;
grant select, insert, update, delete on public.opportunities, public.activities to authenticated;
revoke all on public.organizations, public.organization_members, public.audit_log, public.opportunities, public.activities from public, anon;
grant select on public.organizations, public.organization_members, public.audit_log to authenticated;
grant select, insert, update, delete on public.opportunities, public.activities to authenticated;
revoke all on public.workspaces, public.workspace_members from anon, authenticated;
revoke insert, update, delete on public.organizations, public.organization_members, public.audit_log from authenticated;
revoke all on function public.create_workspace(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.is_workspace_member(uuid) from public, anon, authenticated;
revoke all on function public.is_organization_member(uuid) from public, anon;
revoke all on function public.is_organization_owner(uuid) from public, anon;
revoke all on function public.is_organization_tag_available(text, uuid) from public, anon;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;
grant execute on function public.is_organization_tag_available(text, uuid) to authenticated;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('organizations', 'organization_members', 'audit_log', 'opportunities', 'activities', 'workspaces', 'workspace_members', 'profiles')
  loop
    execute format('drop policy %I on %I.%I', existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  end loop;
end;
$$;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy organizations_select_member on public.organizations
  for select using (public.is_organization_member(id));
create policy organization_members_select_self_or_owner on public.organization_members
  for select using (user_id = auth.uid() or public.is_organization_owner(organization_id));
create policy audit_log_select_owner on public.audit_log
  for select using (public.is_organization_owner(organization_id));
create policy opportunities_owner_access on public.opportunities
  for all using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));
create policy activities_owner_access on public.activities
  for all using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

notify pgrst, 'reload schema';
