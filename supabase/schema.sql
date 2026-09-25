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

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
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
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  type text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists opportunities_workspace_id_idx on public.opportunities(workspace_id);
create index if not exists activities_workspace_id_idx on public.activities(workspace_id);

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

create or replace function public.create_workspace(workspace_name text, workspace_team_size text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.workspaces (name, team_size, created_by)
  values (trim(workspace_name), workspace_team_size, auth.uid())
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return new_workspace_id;
end;
$$;

grant execute on function public.create_workspace(text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;

grant select on public.profiles, public.workspaces, public.workspace_members to authenticated;
grant select, insert, update, delete on public.opportunities, public.activities to authenticated;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (id = auth.uid());

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces for select using (public.is_workspace_member(id));

drop policy if exists members_select_same_workspace on public.workspace_members;
create policy members_select_same_workspace on public.workspace_members for select using (public.is_workspace_member(workspace_id));

drop policy if exists opportunities_member_access on public.opportunities;
create policy opportunities_member_access on public.opportunities for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists activities_member_access on public.activities;
create policy activities_member_access on public.activities for all using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
