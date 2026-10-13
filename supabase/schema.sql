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
  for select using (id = (select auth.uid()));
create policy organizations_select_member on public.organizations
  for select using (public.is_organization_member(id));
create policy organization_members_select_self_or_owner on public.organization_members
  for select using (user_id = (select auth.uid()) or public.is_organization_owner(organization_id));
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

-- Sales-rep scoping is handled EXCLUSIVELY by the per-command policies
-- (opportunities_select/insert/update/delete, activities_*) defined in
-- the PHASE 3 section below. The old combined FOR ALL policies overlapped
-- them (Supabase linter 0006) and — worse — granted sub-users DELETE on
-- their own rows because permissive policies OR together. Drop them
-- everywhere so no run can recreate them.
drop policy if exists opportunities_sales_rep_access on public.opportunities;
drop policy if exists activities_sales_rep_access on public.activities;

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
    -- If a live database already migrated target_period to a date column,
    -- the text assignment above is ill-typed; fall back to the canonical
    -- text column and ignore type mismatches here (the column will be
    -- renamed away in the elsif branch below when possible).
    begin
      execute 'update public.sales_targets set target_period = period where target_period is null and period is not null';
    exception when others then null;
    end;
    begin
      execute 'update public.sales_targets set target_period = ''monthly'' where target_period is null';
    exception when others then null;
    end;
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

create policy invitations_owner_select on public.invitations
  for select using (public.is_organization_owner(organization_id));

create policy sales_targets_select_owner_or_self on public.sales_targets
  for select using (
    (user_id = (select auth.uid()) and public.is_organization_member(organization_id))
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

-- Service-role only (cron + the invite routes): not callable by
-- clients — keeps linter 0029 off a maintenance job.
revoke all on function public.expire_stale_invitations() from public, anon, authenticated;
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

revoke all on function public.owns_opportunity(uuid, uuid) from public, anon;
grant execute on function public.owns_opportunity(uuid, uuid) to authenticated;

-- Opportunities: owners act org-wide; sub-users only on their own rows.
-- DELETE stays owner-only — sub-user deletion is the Phase 5 approval
-- flow, never a direct policy. Sub-user branches exclude soft-deleted
-- rows (deleted_at is null). auth.uid() is wrapped in (select ...) so
-- it is evaluated once per query, not per row (Supabase linter 0003).
-- The legacy combined FOR ALL policies are dropped again here in case
-- an older database still carries them (linter 0006).
drop policy if exists opportunities_owner_access on public.opportunities;
drop policy if exists opportunities_sales_rep_access on public.opportunities;
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

-- Activities: owners org-wide; sub-users only on non-deleted opportunities
-- they own (owns_opportunity enforces deleted_at is null). Activities
-- without an opportunity are owner-only (ambiguous ownership).
drop policy if exists activities_owner_access on public.activities;
drop policy if exists activities_sales_rep_access on public.activities;
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

-- ============================================================
-- PHASE 4 — Reassignment (owner only, history preserved) ------
-- ============================================================

-- Every ownership change is recorded here. Rows are never updated or
-- deleted — reassignment history stays intact for the life of the deal.
create table if not exists public.opportunity_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  old_owner_id uuid references auth.users(id) on delete set null,
  new_owner_id uuid references auth.users(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists opportunity_history_opportunity_idx
  on public.opportunity_history (opportunity_id, created_at desc);
create index if not exists opportunity_history_organization_idx
  on public.opportunity_history (organization_id, created_at desc);

alter table public.opportunity_history enable row level security;

-- Owners read their org's history; sub-users read history of deals they own
-- (they can see their deal was reassigned away from them).
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'opportunity_history'
  loop
    execute format('drop policy %I on public.opportunity_history', existing_policy.policyname);
  end loop;
end;
$$;

create policy opportunity_history_select on public.opportunity_history
  for select using (
    public.is_organization_owner(organization_id)
    or (
      ((select auth.uid()) in (old_owner_id, new_owner_id))
      and public.is_organization_member(organization_id)
    )
  );

revoke insert, update, delete on public.opportunity_history from public, anon, authenticated;

-- In-app notification for the new owner, written by the RPCs below.
-- Reuses activities (type 'note') so the existing ActivityFeed renders it;
-- the text prefix makes it filterable.
create or replace function public.notify_reassignment(
  target_opportunity_id uuid,
  target_organization_id uuid,
  from_owner_id uuid,
  to_owner_id uuid,
  actor uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
  v_actor_name text;
begin
  select company into v_company from public.opportunities where id = target_opportunity_id;
  select coalesce(nullif(btrim(full_name), ''), 'The owner')
    into v_actor_name
  from public.profiles where id = actor;

  insert into public.activities (organization_id, opportunity_id, type, text)
  values (
    target_organization_id,
    target_opportunity_id,
    'note',
    format(
      'Reassigned to you: %s was moved from %s to you by %s.',
      coalesce(v_company, 'An opportunity'),
      coalesce(
        (select coalesce(nullif(btrim(full_name), ''), 'a former owner') from public.profiles where id = from_owner_id),
        'a former owner'
      ),
      v_actor_name
    )
  );
end;
$$;

revoke all on function public.notify_reassignment(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- Reassign one opportunity (owner only). Idempotent: reassigning to the
-- current owner is a no-op that still returns the opportunity id.
create or replace function public.reassign_opportunity(
  opportunity_id uuid,
  new_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  v_opportunity public.opportunities%rowtype;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;
  if new_owner_id is null then
    raise exception 'A new owner is required.';
  end if;

  select * into v_opportunity
  from public.opportunities
  where id = opportunity_id
  for update;

  if not found then
    raise exception 'Opportunity not found.';
  end if;

  if not public.is_organization_owner(v_opportunity.organization_id) then
    raise exception 'Only an organization owner can reassign opportunities.';
  end if;

  if new_owner_id = v_opportunity.owner_id then
    return v_opportunity.id;
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_opportunity.organization_id
      and user_id = new_owner_id
      and status = 'active'
  ) then
    raise exception 'The new owner must be an active member of the organization.';
  end if;

  update public.opportunities
  set owner_id = new_owner_id,
      owner = coalesce(
        (select coalesce(nullif(btrim(full_name), ''), 'Team member') from public.profiles where id = new_owner_id),
        'Team member'
      ),
      updated_at = now()
  where id = v_opportunity.id;

  insert into public.opportunity_history
    (organization_id, opportunity_id, old_owner_id, new_owner_id, actor_id)
  values
    (v_opportunity.organization_id, v_opportunity.id, v_opportunity.owner_id, new_owner_id, caller_id);

  perform public.notify_reassignment(
    v_opportunity.id, v_opportunity.organization_id, v_opportunity.owner_id, new_owner_id, caller_id
  );

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_opportunity.organization_id,
    caller_id,
    'opportunity.reassigned',
    'opportunity',
    v_opportunity.id,
    jsonb_build_object('from_owner', v_opportunity.owner_id, 'to_owner', new_owner_id)
  );

  return v_opportunity.id;
end;
$$;

revoke all on function public.reassign_opportunity(uuid, uuid) from public, anon;
grant execute on function public.reassign_opportunity(uuid, uuid) to authenticated;

-- Bulk reassignment (owner only): moves every open opportunity from one
-- member to another. Closed deals keep their owner — history must reflect
-- who actually closed them. Returns the number of deals moved.
create or replace function public.bulk_reassign(
  from_user_id uuid,
  to_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  v_organization_id uuid;
  v_moved integer := 0;
  v_deal record;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;
  if from_user_id = to_user_id then
    raise exception 'Source and target owner must be different members.';
  end if;

  select organization_id into v_organization_id
  from public.organization_members
  where user_id = from_user_id and status = 'active'
  limit 1;

  if v_organization_id is null
    or not public.is_organization_owner(v_organization_id) then
    raise exception 'Only an organization owner can reassign opportunities.';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_organization_id
      and user_id = to_user_id
      and status = 'active'
  ) then
    raise exception 'The new owner must be an active member of the organization.';
  end if;

  for v_deal in
    select id, owner_id
    from public.opportunities
    where organization_id = v_organization_id
      and owner_id = from_user_id
      and stage not in ('Closed Won', 'Closed Lost')
    for update
  loop
    update public.opportunities
    set owner_id = to_user_id,
        owner = coalesce(
          (select coalesce(nullif(btrim(full_name), ''), 'Team member') from public.profiles where id = to_user_id),
          'Team member'
        ),
        updated_at = now()
    where id = v_deal.id;

    insert into public.opportunity_history
      (organization_id, opportunity_id, old_owner_id, new_owner_id, actor_id)
    values
      (v_organization_id, v_deal.id, v_deal.owner_id, to_user_id, caller_id);

    perform public.notify_reassignment(
      v_deal.id, v_organization_id, v_deal.owner_id, to_user_id, caller_id
    );

    v_moved := v_moved + 1;
  end loop;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_organization_id,
    caller_id,
    'opportunity.bulk_reassigned',
    'organization_member',
    from_user_id,
    jsonb_build_object('to_owner', to_user_id, 'moved', v_moved)
  );

  return v_moved;
end;
$$;revoke all on function public.bulk_reassign(uuid, uuid) from public, anon;
grant execute on function public.bulk_reassign(uuid, uuid) to authenticated;

-- ============================================================
-- PHASE 5 — Deletion rules (soft delete + owner approval) -----
-- ============================================================

-- Soft-delete markers on opportunities. Data is never hard-deleted by the
-- app: owners soft-delete, sub-users request, and a scheduled purge removes
-- rows 30 days after deletion.
alter table public.opportunities
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists delete_reason text;

create index if not exists opportunities_deleted_at_idx
  on public.opportunities (organization_id, deleted_at);

-- Sub-user deletion requests. One open (pending) request per opportunity;
-- enforced by the partial unique index below.
create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  review_comment text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists deletion_requests_one_pending_per_opportunity_uidx
  on public.deletion_requests (opportunity_id)
  where status = 'pending';
create index if not exists deletion_requests_organization_idx
  on public.deletion_requests (organization_id, status, created_at desc);

alter table public.deletion_requests enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'deletion_requests'
  loop
    execute format('drop policy %I on public.deletion_requests', existing_policy.policyname);
  end loop;
end;
$$;

-- Members see the request if they can see the underlying opportunity:
-- owners org-wide, sub-users only on their own deals. All writes below go
-- through RPCs, never direct inserts.
create policy deletion_requests_select on public.deletion_requests
  for select using (
    public.is_organization_owner(organization_id)
    or (
      requested_by = (select auth.uid())
      and public.is_organization_member(organization_id)
    )
  );

revoke insert, update, delete on public.deletion_requests from public, anon, authenticated;

-- ==============================================
-- Sub-user: request deletion of a deal they created AND own.
-- ==============================================
create or replace function public.request_deletion(
  target_opportunity_id uuid,
  reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  v_opportunity public.opportunities%rowtype;
  v_request_id uuid;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;
  if reason is null or char_length(btrim(reason)) < 3 or char_length(btrim(reason)) > 500 then
    raise exception 'A deletion reason of 3 to 500 characters is required.';
  end if;

  select * into v_opportunity
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    raise exception 'Opportunity not found.';
  end if;

  if v_opportunity.deleted_at is not null then
    raise exception 'This opportunity is already deleted.';
  end if;

  if v_opportunity.created_by is null
    or v_opportunity.created_by <> caller_id
    or v_opportunity.owner_id is null
    or v_opportunity.owner_id <> caller_id then
    raise exception 'You can only request deletion of opportunities you created and currently own.';
  end if;

  -- One open request per opportunity: races fail on the partial unique index.
  insert into public.deletion_requests (organization_id, opportunity_id, requested_by, reason)
  values (v_opportunity.organization_id, v_opportunity.id, caller_id, btrim(reason))
  returning id into v_request_id;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_opportunity.organization_id,
    caller_id,
    'opportunity.deletion_requested',
    'deletion_request',
    v_request_id,
    jsonb_build_object('opportunity_id', v_opportunity.id, 'reason', btrim(reason))
  );

  return v_request_id;
end;
$$;

revoke all on function public.request_deletion(uuid, text) from public, anon;
grant execute on function public.request_deletion(uuid, text) to authenticated;

-- ==============================================
-- Owner: approve a pending request — soft-deletes atomically.
-- ==============================================
create or replace function public.approve_deletion_request(
  target_request_id uuid,
  review_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  v_request record;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_request
  from public.deletion_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Deletion request not found.';
  end if;
  if not public.is_organization_owner(v_request.organization_id) then
    raise exception 'Only an organization owner can review deletion requests.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This deletion request was already reviewed.';
  end if;

  update public.deletion_requests
  set status = 'approved',
      reviewed_by = caller_id,
      reviewed_at = now(),
      review_comment = review_comment
  where id = v_request.id;

  update public.opportunities
  set deleted_at = now(),
      deleted_by = caller_id,
      delete_reason = v_request.reason
  where id = v_request.opportunity_id and deleted_at is null;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_request.organization_id,
    caller_id,
    'opportunity.deletion_approved',
    'deletion_request',
    v_request.id,
    jsonb_build_object(
      'opportunity_id', v_request.opportunity_id,
      'requested_by', v_request.requested_by,
      'comment', review_comment
    )
  );
end;
$$;

revoke all on function public.approve_deletion_request(uuid, text) from public, anon;
grant execute on function public.approve_deletion_request(uuid, text) to authenticated;

-- ==============================================
-- Owner: reject a pending request — the deal stays normal.
-- ==============================================
create or replace function public.reject_deletion_request(
  target_request_id uuid,
  review_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  v_request record;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;
  if review_comment is null or char_length(btrim(review_comment)) < 3 then
    raise exception 'A review comment of at least 3 characters is required when rejecting.';
  end if;

  select * into v_request
  from public.deletion_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Deletion request not found.';
  end if;
  if not public.is_organization_owner(v_request.organization_id) then
    raise exception 'Only an organization owner can review deletion requests.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This deletion request was already reviewed.';
  end if;

  update public.deletion_requests
  set status = 'rejected',
      reviewed_by = caller_id,
      reviewed_at = now(),
      review_comment = btrim(review_comment)
  where id = v_request.id;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_request.organization_id,
    caller_id,
    'opportunity.deletion_rejected',
    'deletion_request',
    v_request.id,
    jsonb_build_object(
      'opportunity_id', v_request.opportunity_id,
      'requested_by', v_request.requested_by,
      'comment', btrim(review_comment)
    )
  );
end;
$$;

revoke all on function public.reject_deletion_request(uuid, text) from public, anon;
grant execute on function public.reject_deletion_request(uuid, text) to authenticated;

-- ==============================================
-- Owner: direct soft delete (no approval needed, reason required).
-- Restorable for 30 days, then purged by scheduled job.
-- ==============================================
create or replace function public.soft_delete_opportunity(
  target_opportunity_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  v_opportunity public.opportunities%rowtype;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;
  if reason is null or char_length(btrim(reason)) < 3 or char_length(btrim(reason)) > 500 then
    raise exception 'A deletion reason of 3 to 500 characters is required.';
  end if;

  select * into v_opportunity
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    raise exception 'Opportunity not found.';
  end if;
  if not public.is_organization_owner(v_opportunity.organization_id) then
    raise exception 'Only an organization owner can delete opportunities.';
  end if;
  if v_opportunity.deleted_at is not null then
    raise exception 'This opportunity is already deleted.';
  end if;

  -- Auto-resolve any open request — the owner already decided.
  update public.deletion_requests
  set status = 'rejected',
      reviewed_by = caller_id,
      reviewed_at = now(),
      review_comment = 'Superseded by direct owner deletion.'
  where opportunity_id = v_opportunity.id and status = 'pending';

  update public.opportunities
  set deleted_at = now(),
      deleted_by = caller_id,
      delete_reason = btrim(reason)
  where id = v_opportunity.id and deleted_at is null;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_opportunity.organization_id,
    caller_id,
    'opportunity.soft_deleted',
    'opportunity',
    v_opportunity.id,
    jsonb_build_object('reason', btrim(reason))
  );
end;
$$;

revoke all on function public.soft_delete_opportunity(uuid, text) from public, anon;
grant execute on function public.soft_delete_opportunity(uuid, text) to authenticated;

-- ==============================================
-- Owner: restore within the 30-day window.
-- ==============================================
create or replace function public.restore_opportunity(
  target_opportunity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  v_opportunity public.opportunities%rowtype;
begin
  if caller_id is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_opportunity
  from public.opportunities
  where id = target_opportunity_id
  for update;

  if not found then
    raise exception 'Opportunity not found.';
  end if;
  if not public.is_organization_owner(v_opportunity.organization_id) then
    raise exception 'Only an organization owner can restore opportunities.';
  end if;
  if v_opportunity.deleted_at is null then
    raise exception 'This opportunity is not deleted.';
  end if;
  if v_opportunity.deleted_at < now() - interval '30 days' then
    raise exception 'The 30-day restoration window has passed.';
  end if;

  update public.opportunities
  set deleted_at = null,
      deleted_by = null,
      delete_reason = null
  where id = v_opportunity.id;

  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
  values (
    v_opportunity.organization_id,
    caller_id,
    'opportunity.restored',
    'opportunity',
    v_opportunity.id,
    jsonb_build_object('was_deleted_by', v_opportunity.deleted_by)
  );
end;
$$;

revoke all on function public.restore_opportunity(uuid) from public, anon;
grant execute on function public.restore_opportunity(uuid) to authenticated;

-- ==============================================
-- Scheduled purge: hard-deletes opportunities soft-deleted more than
-- 30 days ago (and their cascading activities). Runs via pg_cron or Vercel
-- Cron hitting a service-role route; safe to run any time.
-- ==============================================
create or replace function public.purge_expired_soft_deletes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purged integer := 0;
begin
  -- Collect metadata first (the rows are gone after the CTE runs).
  create temp table purge_targets on commit drop as
    select id, organization_id
    from public.opportunities
    where deleted_at is not null
      and deleted_at < now() - interval '30 days';

  select count(*) into v_purged from purge_targets;

  if v_purged > 0 then
    delete from public.opportunities where id in (select id from purge_targets);

    insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, metadata)
    select
      organization_id,
      null,
      'opportunity.purged',
      'opportunity',
      id,
      jsonb_build_object('purged_at', now())
    from purge_targets;
  end if;

  return v_purged;
end;
$$;

-- Service-role only (nightly purge job): not callable by clients.
revoke all on function public.purge_expired_soft_deletes() from public, anon, authenticated;
grant execute on function public.purge_expired_soft_deletes() to service_role;

-- ==============================================
-- RLS on opportunities: sub-users must not see (or un-delete) soft-deleted
-- rows. This is now handled by the per-command opportunities_select/
-- insert/update policies in the PHASE 3 section (their sub-user branches
-- carry `deleted_at is null`); owners intentionally keep seeing deleted
-- rows for the approvals queue, restore and trash views. The legacy
-- combined FOR ALL policy is dropped here so no run can recreate it —
-- it overlapped the per-command set (linter 0006) and granted sub-users
-- DELETE on their own rows.
-- ==============================================
drop policy if exists opportunities_sales_rep_access on public.opportunities;
drop policy if exists activities_sales_rep_access on public.activities;

-- ============================================================
-- INDEX HYGIENE — Supabase linter 0009 / 0005 / 0001
-- Drop legacy duplicate + unused indexes (the canonical names
-- created earlier in this schema are kept), then add the one
-- hot-path covering index the linter asked for (audit feed by
-- organization). Remaining 0001 findings (contacts/accounts /
-- workspace legacy FKs, actor/owner-id FKs) are accepted INFO:
-- the app never filters or cascades on them.
-- ============================================================
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

do $$
begin
  -- May back a UNIQUE constraint on older databases; guarded either way.
  begin
    execute 'drop index if exists public.organization_members_organization_id_user_id_key';
  exception when others then
    raise notice 'note: could not drop organization_members_organization_id_user_id_key (%)', sqlerrm;
  end;
end $$;

create index if not exists audit_log_organization_id_idx
  on public.audit_log (organization_id, created_at desc);

-- ============================================================
-- LINTER HYGIENE — Supabase linter 0028/0029
-- Trigger functions must never be callable via /rest/v1/rpc.
-- EXECUTE is checked at CREATE TRIGGER time, so the ownership
-- and last-owner triggers keep firing after these revokes.
-- ============================================================
revoke all on function public.enforce_active_owner_exists() from public, anon, authenticated;
revoke all on function public.enforce_opportunity_ownership() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ============================================================
-- LEGACY SHAPE RECONCILIATION — same pattern as sales_targets:
-- older app versions created columns like activities.activity_type
-- (NOT NULL, no default) that modern inserts never fill. Sync them,
-- then sweep every business table for NOT NULL + no default +
-- not-supplied-by-app columns and relax only those. Idempotent.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activities' and column_name = 'activity_type'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'activities' and column_name = 'type'
    ) then
      execute 'update public.activities set type = activity_type where type = ''note'' and activity_type is not null and activity_type <> ''note''';
      begin
        execute 'update public.activities set activity_type = type where activity_type is null';
      exception when others then
        raise notice 'note: could not mirror type -> activity_type (%)', sqlerrm;
      end;
      begin
        execute 'alter table public.activities alter column activity_type drop not null';
      exception when others then null;
      end;
      begin
        execute 'alter table public.activities alter column activity_type set default ''note''';
      exception when others then null;
      end;
    else
      execute 'alter table public.activities rename column activity_type to type';
    end if;
  end if;
end
$$;

do $$
declare
  v_table text;
  v_keep text[];
  v_column text;
begin
  for v_table, v_keep in
    select * from (values
      ('opportunities',      array['id','organization_id','company','stage','owner']),
      ('activities',         array['id','organization_id','type','text']),
      ('organizations',      array['id','name','slug']),
      ('organization_members', array['organization_id','user_id','role','status']),
      ('profiles',           array['id','full_name']),
      ('audit_log',          array['id','organization_id','action','entity']),
      ('sales_targets',      array['id','organization_id','user_id','target_amount','period','source'])
    ) as t(tbl, keep)
  loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;
    for v_column in
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and is_nullable = 'NO'
        and column_default is null
        and not (column_name = any (v_keep))
    loop
      begin
        execute format('alter table public.%I alter column %I drop not null', v_table, v_column);
        raise notice 'RELAXED public.%.% (legacy NOT NULL, not supplied by the app)', v_table, v_column;
      exception when others then
        raise notice 'skipped public.%.%: %', v_table, v_column, sqlerrm;
      end;
    end loop;
  end loop;
end
$$;

-- ============================================================
-- PHASE 1 (this release) — ACCOUNTS & CONTACTS
-- Mirrors supabase/patch-03-accounts-contacts.sql (run that file
-- alone on databases that already have schema.sql applied).
-- Additive only: legacy opportunity company/contact text stays.
-- ============================================================

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  website text,
  industry text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Duplicate names rejected only when EXACTLY equal (case/space-insensitive)
-- within the same organization; similar text is never auto-merged.
create unique index if not exists accounts_org_name_uidx
  on public.accounts (organization_id, lower(trim(name)));
create unique index if not exists accounts_org_id_uidx
  on public.accounts (organization_id, id);
create index if not exists accounts_organization_idx
  on public.accounts (organization_id, lower(name));

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid,
  full_name text not null check (char_length(trim(full_name)) between 1 and 200),
  title text,
  email text,
  phone text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_organization_idx
  on public.contacts (organization_id, lower(full_name));
create index if not exists contacts_account_idx
  on public.contacts (account_id);
create unique index if not exists contacts_org_id_uidx
  on public.contacts (organization_id, id);
-- No unique constraint on contact names/emails: two people can share a
-- name; duplicates are surfaced as UI warnings only, never auto-merged.

alter table public.opportunities
  add column if not exists account_id uuid,
  add column if not exists contact_id uuid;

alter table public.contacts drop constraint if exists contacts_account_id_fkey;
alter table public.opportunities drop constraint if exists opportunities_account_id_fkey;
alter table public.opportunities drop constraint if exists opportunities_contact_id_fkey;
do $phase1_constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contacts'::regclass and conname = 'contacts_org_account_fkey'
  ) then
    alter table public.contacts
      add constraint contacts_org_account_fkey
      foreign key (organization_id, account_id)
      references public.accounts (organization_id, id)
      on delete set null (account_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.opportunities'::regclass and conname = 'opportunities_org_account_fkey'
  ) then
    alter table public.opportunities
      add constraint opportunities_org_account_fkey
      foreign key (organization_id, account_id)
      references public.accounts (organization_id, id)
      on delete set null (account_id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.opportunities'::regclass and conname = 'opportunities_org_contact_fkey'
  ) then
    alter table public.opportunities
      add constraint opportunities_org_contact_fkey
      foreign key (organization_id, contact_id)
      references public.contacts (organization_id, id)
      on delete set null (contact_id);
  end if;
end
$phase1_constraints$;

create index if not exists opportunities_account_idx
  on public.opportunities (account_id) where account_id is not null;
create index if not exists opportunities_contact_idx
  on public.opportunities (contact_id) where contact_id is not null;

-- updated_at maintenance

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists accounts_touch_updated_at on public.accounts;
create trigger accounts_touch_updated_at
  before update on public.accounts
  for each row execute function public.touch_updated_at();

drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at
  before update on public.contacts
  for each row execute function public.touch_updated_at();

-- Row Level Security: members read/create/edit shared records within their
-- organization; deletion is owner-only; cross-org access fails closed.

alter table public.accounts enable row level security;
alter table public.contacts enable row level security;

do $phase1$
declare existing record;
begin
  for existing in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('accounts', 'contacts')
  loop
    execute format('drop policy %I on public.%I', existing.policyname, existing.tablename);
  end loop;
end;
$phase1$;

create policy accounts_select on public.accounts
  for select using (public.is_organization_member(organization_id));
create policy accounts_insert on public.accounts
  for insert with check (public.is_organization_member(organization_id));
create policy accounts_update on public.accounts
  for update
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));
create policy accounts_delete on public.accounts
  for delete using (public.is_organization_owner(organization_id));

create policy contacts_select on public.contacts
  for select using (public.is_organization_member(organization_id));
create policy contacts_insert on public.contacts
  for insert with check (public.is_organization_member(organization_id));
create policy contacts_update on public.contacts
  for update
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));
create policy contacts_delete on public.contacts
  for delete using (public.is_organization_owner(organization_id));

grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;

create or replace function public.backfill_account_contacts()
returns table(accounts_created bigint, contacts_created bigint, opportunities_linked bigint)
language plpgsql
as $fn$
declare
  v_accounts bigint := 0;
  v_contacts bigint := 0;
  v_links bigint := 0;
  v_rows bigint := 0;
begin
  with source as (
    select distinct on (o.organization_id, lower(trim(o.company)))
      o.organization_id,
      nullif(trim(o.company), '') as name
    from public.opportunities o
    where nullif(trim(o.company), '') is not null
    order by o.organization_id, lower(trim(o.company)), trim(o.company)
  )
  insert into public.accounts (organization_id, name)
  select s.organization_id, s.name
  from source s
  where not exists (
    select 1 from public.accounts a
    where a.organization_id = s.organization_id
      and lower(trim(a.name)) = lower(s.name)
  );
  get diagnostics v_accounts = row_count;

  with source as (
    select distinct on (
      o.organization_id,
      a.id,
      lower(trim(o.contact)),
      coalesce(lower(trim(o.email)), ''),
      coalesce(trim(o.phone), '')
    )
      o.organization_id,
      a.id as account_id,
      nullif(trim(o.contact), '') as full_name,
      lower(nullif(trim(o.email), '')) as email,
      nullif(trim(o.phone), '') as phone
    from public.opportunities o
    left join public.accounts a
      on a.organization_id = o.organization_id
     and lower(trim(a.name)) = lower(trim(o.company))
    where nullif(trim(o.contact), '') is not null
      and lower(trim(o.contact)) <> 'unassigned'
    order by o.organization_id,
      a.id,
      lower(trim(o.contact)),
      coalesce(lower(trim(o.email)), ''),
      coalesce(trim(o.phone), '')
  )
  insert into public.contacts (organization_id, account_id, full_name, email, phone)
  select s.organization_id, s.account_id, s.full_name, s.email, s.phone
  from source s
  where not exists (
    select 1 from public.contacts c
    where c.organization_id = s.organization_id
      and c.account_id is not distinct from s.account_id
      and lower(trim(c.full_name)) = lower(s.full_name)
      and coalesce(lower(c.email), '') = coalesce(s.email, '')
      and coalesce(trim(c.phone), '') = coalesce(s.phone, '')
  );
  get diagnostics v_contacts = row_count;

  update public.opportunities o
  set account_id = (
    select a.id from public.accounts a
    where a.organization_id = o.organization_id
      and lower(trim(a.name)) = lower(trim(o.company))
    order by a.created_at
    limit 1
  )
  where o.account_id is null
    and nullif(trim(o.company), '') is not null
    and exists (
      select 1 from public.accounts a
      where a.organization_id = o.organization_id
        and lower(trim(a.name)) = lower(trim(o.company))
    );
  get diagnostics v_rows = row_count;
  v_links := v_links + v_rows;

  update public.opportunities o
  set contact_id = (
    select c.id from public.contacts c
    where c.organization_id = o.organization_id
      and c.account_id is not distinct from o.account_id
      and lower(trim(c.full_name)) = lower(trim(o.contact))
      and coalesce(lower(c.email), '') = coalesce(lower(trim(o.email)), '')
      and coalesce(trim(c.phone), '') = coalesce(trim(o.phone), '')
    order by c.created_at
    limit 1
  )
  where o.contact_id is null
    and nullif(trim(o.contact), '') is not null
    and lower(trim(o.contact)) <> 'unassigned'
    and exists (
      select 1 from public.contacts c
      where c.organization_id = o.organization_id
        and c.account_id is not distinct from o.account_id
        and lower(trim(c.full_name)) = lower(trim(o.contact))
        and coalesce(lower(c.email), '') = coalesce(lower(trim(o.email)), '')
    );
  get diagnostics v_rows = row_count;
  v_links := v_links + v_rows;

  return query select v_accounts, v_contacts, v_links;
end;
 $fn$;

revoke all on function public.backfill_account_contacts() from public, anon, authenticated;

notify pgrst, 'reload schema';
