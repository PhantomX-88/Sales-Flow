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
  slug text not null,
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
  add column if not exists slug text,
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

update public.organizations
set slug = coalesce(
  nullif(btrim(slug), ''),
  coalesce(
    nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
    'org'
  ) || '-' || replace(id::text, '-', '')
)
where slug is null or btrim(slug) = '';

alter table public.organizations alter column slug set not null;

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

  insert into public.organizations (id, name, slug, created_by)
  select w.organization_id,
         w.name,
         coalesce(
           nullif(trim(both '-' from regexp_replace(lower(w.name), '[^a-z0-9]+', '-', 'g')), ''),
           'org'
         ) || '-' || replace(w.organization_id::text, '-', ''),
         w.created_by
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
  organization_slug text;
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
    saved_organization_id := gen_random_uuid();
    organization_slug := coalesce(
      nullif(trim(both '-' from regexp_replace(lower(trim(setup_name)), '[^a-z0-9]+', '-', 'g')), ''),
      'org'
    ) || '-' || replace(saved_organization_id::text, '-', '');
    insert into public.organizations (
      id, name, slug, tag, industry, country, expected_sub_users, revenue_target, currency,
      target_period, expected_transactions_per_month, average_deal_size, team_type,
      enabled_features, onboarding_completed, created_by
    ) values (
      saved_organization_id, trim(setup_name), organization_slug, setup_tag,
      trim(setup_industry), trim(setup_country),
      setup_expected_sub_users, setup_revenue_target, setup_currency, setup_target_period,
      setup_expected_transactions_per_month, setup_average_deal_size, setup_team_type,
      coalesce(setup_enabled_features, '{}'), true, auth.uid()
    );

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

-- ============================================================
-- PHASE 2 — Sub-user management and invitations (idempotent)
-- ============================================================

-- C2: authoritative owner linkage on opportunities --------------------------
alter table public.opportunities
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists opportunities_owner_id_idx on public.opportunities(owner_id);

-- Backfill: every existing organization is single-owner, so the active owner
-- of a row's organization owns (and created) its historical opportunities.
update public.opportunities o
set owner_id = om.user_id
from (
  select organization_id, user_id
  from public.organization_members
  where role = 'owner' and status = 'active'
) om
where o.organization_id = om.organization_id
  and o.owner_id is null;

update public.opportunities
set created_by = owner_id
where created_by is null and owner_id is not null;

-- Ownership rules enforced in Postgres, never UI-only.
create or replace function public.enforce_opportunity_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  profile_name text;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;

  if tg_op = 'INSERT' then
    if new.organization_id is null then
      raise exception 'organization_id is required.';
    end if;
    if not exists (
      select 1 from public.organization_members
      where organization_id = new.organization_id
        and user_id = caller_id
        and status = 'active'
    ) then
      raise exception 'You do not have access to this organization.';
    end if;
    if new.owner_id is null then
      new.owner_id := caller_id;
    end if;
    if new.created_by is null then
      new.created_by := caller_id;
    end if;
    if new.owner_id <> caller_id and not public.is_organization_owner(new.organization_id) then
      raise exception 'You can only create opportunities you own.';
    end if;
    if not exists (
      select 1 from public.organization_members
      where organization_id = new.organization_id
        and user_id = new.owner_id
        and status = 'active'
    ) then
      raise exception 'owner_id must be an active member of the organization.';
    end if;
    select coalesce(nullif(btrim(p.full_name), ''), null)
    into profile_name
    from public.profiles p
    where p.id = new.owner_id;
    if profile_name is not null then
      new.owner := profile_name;
    end if;
    return new;
  end if;

  -- UPDATE -------------------------------------------------------------------
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed.';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed.';
  end if;
  if new.owner_id is null then
    raise exception 'owner_id cannot be cleared.';
  end if;
  if new.owner_id is distinct from old.owner_id then
    if not public.is_organization_owner(old.organization_id) then
      raise exception 'Only an organization owner can reassign opportunities.';
    end if;
    if not exists (
      select 1 from public.organization_members
      where organization_id = new.organization_id
        and user_id = new.owner_id
        and status = 'active'
    ) then
      raise exception 'owner_id must be an active member of the organization.';
    end if;
    select coalesce(nullif(btrim(p.full_name), ''), null)
    into profile_name
    from public.profiles p
    where p.id = new.owner_id;
    if profile_name is not null then
      new.owner := profile_name;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists opportunities_ownership_guard on public.opportunities;
create trigger opportunities_ownership_guard
  before insert or update on public.opportunities
  for each row execute procedure public.enforce_opportunity_ownership();

-- Sales reps may work only on opportunities assigned to themselves and
-- activities linked to those opportunities. Owners retain the org-wide
-- policies above.
drop policy if exists opportunities_sales_rep_access on public.opportunities;
create policy opportunities_sales_rep_access on public.opportunities
  for all using (
    owner_id = auth.uid()
    and exists (
      select 1 from public.organization_members
      where organization_id = opportunities.organization_id
        and user_id = auth.uid()
        and role = 'sales_rep'
        and status = 'active'
    )
  )
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.organization_members
      where organization_id = opportunities.organization_id
        and user_id = auth.uid()
        and role = 'sales_rep'
        and status = 'active'
    )
  );

drop policy if exists activities_sales_rep_access on public.activities;
create policy activities_sales_rep_access on public.activities
  for all using (
    exists (
      select 1
      from public.organization_members member
      join public.opportunities opportunity
        on opportunity.id = activities.opportunity_id
       and opportunity.organization_id = activities.organization_id
      where member.organization_id = activities.organization_id
        and member.user_id = auth.uid()
        and member.role = 'sales_rep'
        and member.status = 'active'
        and opportunity.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members member
      join public.opportunities opportunity
        on opportunity.id = activities.opportunity_id
       and opportunity.organization_id = activities.organization_id
      where member.organization_id = activities.organization_id
        and member.user_id = auth.uid()
        and member.role = 'sales_rep'
        and member.status = 'active'
        and opportunity.owner_id = auth.uid()
    )
  );

-- C1: sales_targets (spec assumed it existed; created here) ------------------
create table if not exists public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_amount numeric not null default 0 check (target_amount >= 0),
  period text not null default 'monthly' check (period in ('monthly', 'quarterly', 'annual')),
  source text not null default 'manual' check (source in ('manual', 'invitation')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reconcile pre-existing sales_targets tables that were created with a
-- different shape (older app versions / manual setup). CREATE TABLE IF NOT
-- EXISTS above is a no-op when the table already exists, so explicitly add
-- every column Phase 2 depends on. Each ALTER is a separate statement on
-- purpose: single-statement multi-ADD COLUMN with IF NOT EXISTS is fragile
-- on some Postgres / Supabase parsers and a single bad clause would abort
-- the whole batch. Separate statements keep this idempotent and safe to
-- re-run, and preserve existing rows/data.
alter table public.sales_targets add column if not exists id uuid default gen_random_uuid();
alter table public.sales_targets add column if not exists organization_id uuid;
alter table public.sales_targets add column if not exists user_id uuid;
alter table public.sales_targets add column if not exists target_amount numeric not null default 0;
alter table public.sales_targets add column if not exists period text not null default 'monthly';
alter table public.sales_targets add column if not exists source text not null default 'manual';
alter table public.sales_targets add column if not exists created_at timestamptz not null default now();
alter table public.sales_targets add column if not exists updated_at timestamptz not null default now();

-- Heal legacy column names when the canonical one is missing. Common older
-- shapes used amount / target_value / value for the target and
-- target_period for the period. Only rename when the canonical column is
-- still empty/default so we never clobber real Phase 2 data.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'amount')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_amount') then
    -- Both exist: backfill canonical from legacy where canonical is still 0,
    -- then keep both (do not drop legacy to avoid breaking old code).
    execute 'update public.sales_targets set target_amount = amount where (target_amount is null or target_amount = 0) and amount is not null';
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'amount') then
    execute 'alter table public.sales_targets rename column amount to target_amount';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_value')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_amount') then
    execute 'alter table public.sales_targets rename column target_value to target_amount';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_period')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'period') then
    execute 'update public.sales_targets set period = target_period where (period is null or period = ''monthly'') and target_period is not null';
    -- Reverse-sync + relax: pre-existing tables often define target_period NOT
    -- NULL without a default. Any insert that only writes the canonical
    -- "period" column then fails with 23502 (null value in target_period).
    -- Backfill NULLs from period (fallback 'monthly'), then drop the NOT NULL
    -- requirement and give it a default so canonical-only inserts succeed.
    execute 'update public.sales_targets set target_period = period where target_period is null and period is not null';
    execute 'update public.sales_targets set target_period = ''monthly'' where target_period is null';
    begin
      execute 'alter table public.sales_targets alter column target_period drop not null';
    exception when others then null;
    end;
    begin
      execute 'alter table public.sales_targets alter column target_period set default ''monthly''';
    exception when others then null;
    end;
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_period') then
    execute 'alter table public.sales_targets rename column target_period to period';
  end if;
  -- Relax other common legacy NOT NULL columns so canonical-only inserts
  -- never fail on old tables. Canonical columns remain the source of truth.
  begin
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'amount') then
      execute 'update public.sales_targets set amount = 0 where amount is null';
      begin
        execute 'alter table public.sales_targets alter column amount drop not null';
      exception when others then null;
      end;
      begin
        execute 'alter table public.sales_targets alter column amount set default 0';
      exception when others then null;
      end;
    end if;
  exception when others then null;
  end;
  begin
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_value') then
      execute 'update public.sales_targets set target_value = 0 where target_value is null';
      begin
        execute 'alter table public.sales_targets alter column target_value drop not null';
      exception when others then null;
      end;
      begin
        execute 'alter table public.sales_targets alter column target_value set default 0';
      exception when others then null;
      end;
    end if;
  exception when others then null;
  end;
end $$;

create unique index if not exists sales_targets_org_user_uidx
  on public.sales_targets (organization_id, user_id);
create index if not exists sales_targets_user_id_idx on public.sales_targets (user_id);

-- Backfill defaults / constraints on reconciled tables without touching data.
do $$
begin
  begin
    execute 'alter table public.sales_targets alter column id set default gen_random_uuid()';
  exception when others then null;
  end;
  begin
    execute 'alter table public.sales_targets alter column created_at set default now()';
  exception when others then null;
  end;
  begin
    execute 'alter table public.sales_targets alter column updated_at set default now()';
  exception when others then null;
  end;
  if not exists (select 1 from pg_constraint where conname = 'sales_targets_organization_id_fkey') then
    begin
      execute 'alter table public.sales_targets add constraint sales_targets_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade';
    exception when others then null;
    end;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_targets_user_id_fkey') then
    begin
      execute 'alter table public.sales_targets add constraint sales_targets_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade';
    exception when others then null;
    end;
  end if;
end $$;

-- Invitations: our own system. Only server routes (service role) or
-- SECURITY DEFINER RPCs write; owners may read their org's invitations.
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email)),
  full_name text not null default '',
  role text not null default 'sales_rep' check (role = 'sales_rep'),
  personal_target numeric not null default 0 check (personal_target >= 0),
  target_period text not null default 'monthly' check (target_period in ('monthly', 'quarterly', 'annual')),
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  send_count integer not null default 1 check (send_count >= 1)
);

-- One pending invitation per (organization, email).
create unique index if not exists invitations_pending_one_per_email_uidx
  on public.invitations (organization_id, lower(email))
  where status = 'pending';
create index if not exists invitations_organization_id_idx
  on public.invitations (organization_id, status, created_at desc);

alter table public.invitations enable row level security;
alter table public.sales_targets enable row level security;

grant select on public.invitations, public.sales_targets to authenticated;
revoke insert, update, delete on public.invitations from public, anon, authenticated;
revoke insert, update, delete on public.sales_targets from public, anon, authenticated;

-- Recreate policies idempotently for Phase 2 tables (profiles is re-created
-- below so owners can read teammate display names on the Team page).
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('invitations', 'sales_targets', 'profiles')
  loop
    execute format('drop policy %I on public.%I', existing_policy.policyname, existing_policy.tablename);
  end loop;
end;
$$;

create policy profiles_select_own_or_teammate on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_members me
      join public.organization_members them on them.organization_id = me.organization_id
      where me.user_id = auth.uid()
        and me.status = 'active'
        and them.user_id = profiles.id
    )
  );

create policy invitations_owner_select on public.invitations
  for select using (public.is_organization_owner(organization_id));

create policy sales_targets_select_owner_or_self on public.sales_targets
  for select using (
    (user_id = auth.uid() and public.is_organization_member(organization_id))
    or public.is_organization_owner(organization_id)
  );

-- Server-only helper: resolve an auth user id by email (service role only).
create or replace function public.find_auth_user_id(check_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select id from auth.users where lower(email) = lower(check_email) limit 1;
$$;

revoke all on function public.find_auth_user_id(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id(text) to service_role;

-- Accept an invitation atomically as the logged-in invited user.
-- Role, organization, target and expiry come from the invitation row only —
-- never from the client, URL params or user metadata.
create or replace function public.accept_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  v_token_hash text;
  v_invitation public.invitations%rowtype;
  v_member_org uuid;
begin
  if caller_id is null then
    raise exception 'Sign in to accept this invitation.';
  end if;
  if raw_token is null or length(raw_token) < 20 then
    raise exception 'This invitation link is invalid.';
  end if;

  v_token_hash := encode(sha256(convert_to(raw_token, 'UTF8')), 'hex');

  -- Lock the invitation row: simultaneous accepts serialize here.
  select * into v_invitation
  from public.invitations
  where token_hash = v_token_hash
  for update;

  if not found then
    raise exception 'This invitation link is invalid.';
  end if;

  caller_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if caller_email = '' then
    raise exception 'Your account has no email address.';
  end if;
  if caller_email <> v_invitation.email then
    raise exception 'This invitation was sent to %. Sign in with that account to accept it.',
      v_invitation.email;
  end if;

  if v_invitation.status = 'accepted' then
    -- Idempotent retry by the same person who already accepted.
    if v_invitation.accepted_by = caller_id then
      select organization_id into v_member_org
      from public.organization_members
      where user_id = caller_id and status = 'active';
      if v_member_org = v_invitation.organization_id then
        return v_invitation.organization_id;
      end if;
    end if;
    raise exception 'This invitation has already been used.';
  end if;

  if v_invitation.status = 'revoked' then
    raise exception 'This invitation was revoked. Ask the owner to send a new one.';
  end if;

  if v_invitation.status = 'expired' or v_invitation.expires_at <= now() then
    update public.invitations
    set status = 'expired'
    where id = v_invitation.id and status = 'pending';
    raise exception 'This invitation has expired. Ask the owner to send a new one.';
  end if;

  -- One active organization per user.
  select organization_id into v_member_org
  from public.organization_members
  where user_id = caller_id and status = 'active'
  limit 1;
  if v_member_org is not null and v_member_org <> v_invitation.organization_id then
    raise exception 'You already belong to another organization. Leave it before accepting this invitation.';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_invitation.organization_id, caller_id, v_invitation.role, 'active')
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active';

  -- Personal target row. Legacy sales_targets tables may carry an extra
  -- NOT NULL target_period column; patch-01 relaxes it so this plain
  -- insert always works. No dynamic EXECUTE here on purpose — nested
  -- dollar-quoted strings broke the SQL Editor (42601 rollback).
  insert into public.sales_targets (organization_id, user_id, target_amount, period, source)
  values (
    v_invitation.organization_id,
    caller_id,
    v_invitation.personal_target,
    v_invitation.target_period,
    'invitation'
  )
  on conflict (organization_id, user_id) do update
  set target_amount = excluded.target_amount,
      period = excluded.period,
      source = 'invitation',
      updated_at = now();

  -- Keep a legacy target_period column in sync when present; skipped at
  -- runtime when the column does not exist.
  begin
    update public.sales_targets
    set target_period = v_invitation.target_period
    where organization_id = v_invitation.organization_id
      and user_id = caller_id;
  exception when undefined_column then
    null;
  end;

  update public.invitations
  set status = 'accepted', accepted_by = caller_id, accepted_at = now()
  where id = v_invitation.id;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_invitation.organization_id,
    caller_id,
    'invitation.accepted',
    'invitation',
    v_invitation.id,
    jsonb_build_object('email', v_invitation.email, 'role', v_invitation.role)
  );

  return v_invitation.organization_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- On-read / scheduled expiry sweep.
create or replace function public.expire_stale_invitations()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    update public.invitations
    set status = 'expired'
    where status = 'pending' and expires_at <= now()
    returning 1
  )
  select count(*)::int from expired;
$$;

revoke all on function public.expire_stale_invitations() from public, anon;
grant execute on function public.expire_stale_invitations() to authenticated;
grant execute on function public.expire_stale_invitations() to service_role;

-- Deactivate / reactivate members (owner only, enforced server-side).
create or replace function public.set_member_status(
  target_organization_id uuid,
  target_user_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  target record;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;
  if new_status not in ('active', 'inactive') then
    raise exception 'Status must be active or inactive.';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = target_organization_id
      and user_id = caller_id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'Only an active organization owner can manage members.';
  end if;

  select role, status into target
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = target_user_id
  for update;

  if not found then
    raise exception 'Member not found in this organization.';
  end if;

  if new_status = 'inactive'
    and target.role = 'owner'
    and target.status = 'active'
    and not exists (
      select 1 from public.organization_members
      where organization_id = target_organization_id
        and user_id <> target_user_id
        and role = 'owner'
        and status = 'active'
    ) then
    raise exception 'An organization must always have at least one active owner.';
  end if;

  update public.organization_members
  set status = new_status
  where organization_id = target_organization_id
    and user_id = target_user_id;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    target_organization_id,
    caller_id,
    case when new_status = 'active' then 'member.reactivated' else 'member.deactivated' end,
    'organization_member',
    target_user_id,
    jsonb_build_object('previous_status', target.status, 'role', target.role)
  );
end;
$$;

revoke all on function public.set_member_status(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_status(uuid, uuid, text) to authenticated;

-- Backstop for ANY write path (including the service role): an organization
-- must never lose its last active owner.
create or replace function public.enforce_active_owner_exists()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'owner'
      and old.status = 'active'
      and not exists (
        select 1 from public.organization_members
        where organization_id = old.organization_id
          and user_id <> old.user_id
          and role = 'owner'
          and status = 'active'
      ) then
      raise exception 'The last active owner cannot be removed.';
    end if;
    return old;
  end if;

  if old.role = 'owner'
    and old.status = 'active'
    and (new.role <> 'owner' or new.status <> 'active') then
    if not exists (
      select 1 from public.organization_members
      where organization_id = old.organization_id
        and user_id <> old.user_id
        and role = 'owner'
        and status = 'active'
    ) then
      raise exception 'An organization must always have at least one active owner.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists organization_members_last_owner_guard on public.organization_members;
create trigger organization_members_last_owner_guard
  before update or delete on public.organization_members
  for each row execute procedure public.enforce_active_owner_exists();

-- ============================================================
-- PHASE 3 — Sub-user dashboard (member-scoped RLS) ------------
-- ============================================================

-- Activities: optional next step + due date drive reminders.
alter table public.activities add column if not exists next_step text;
alter table public.activities add column if not exists due_date date;

-- Helper for activity policies: does the caller own this opportunity
-- inside this organization (with active membership)? SECURITY DEFINER so
-- the subquery never recurses through opportunities' own RLS policies.
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
      and o.owner_id = auth.uid()
      and exists (
        select 1
        from public.organization_members m
        where m.organization_id = o.organization_id
          and m.user_id = auth.uid()
          and m.status = 'active'
      )
  );
$$;

revoke all on function public.owns_opportunity(uuid, uuid) from public, anon;
grant execute on function public.owns_opportunity(uuid, uuid) to authenticated;

-- Opportunities: owners act org-wide; sub-users only on their own rows.
-- DELETE stays owner-only — sub-user deletion arrives in Phase 5 as an
-- approval flow, never as a direct policy.
drop policy if exists opportunities_owner_access on public.opportunities;
drop policy if exists opportunities_select on public.opportunities;
drop policy if exists opportunities_insert on public.opportunities;
drop policy if exists opportunities_update on public.opportunities;
drop policy if exists opportunities_delete on public.opportunities;

create policy opportunities_select on public.opportunities
  for select using (
    public.is_organization_owner(organization_id)
    or (owner_id = auth.uid() and public.is_organization_member(organization_id))
  );

create policy opportunities_insert on public.opportunities
  for insert with check (
    public.is_organization_owner(organization_id)
    or (
      public.is_organization_member(organization_id)
      and (owner_id = auth.uid() or owner_id is null)
    )
  );

create policy opportunities_update on public.opportunities
  for update
  using (
    public.is_organization_owner(organization_id)
    or (owner_id = auth.uid() and public.is_organization_member(organization_id))
  )
  with check (
    public.is_organization_owner(organization_id)
    or (
      public.is_organization_member(organization_id)
      and (owner_id = auth.uid() or owner_id is null)
    )
  );

create policy opportunities_delete on public.opportunities
  for delete using (public.is_organization_owner(organization_id));

-- Activities: owners org-wide; sub-users only on opportunities they own.
-- Activities without an opportunity are owner-only (ambiguous ownership).
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

notify pgrst, 'reload schema';
