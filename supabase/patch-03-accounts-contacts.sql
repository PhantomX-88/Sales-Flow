-- ============================================================
-- PATCH 03 — Accounts & contacts (Phase 1 CRM layer)
--
-- ADDITIVE ONLY. Safe to rerun (every statement is guarded).
-- NOT applied to any environment by this change — run manually
-- in the Supabase SQL Editor, then run tests/phase6-tests.sql.
--
-- Creates:
--   public.accounts      — one company record per organization
--   public.contacts      — people, optionally linked to an account
--   Composite foreign keys keep every relationship inside its organization.
--   Org-scoped RLS: members read/insert/update; owners delete.
--   public.backfill_account_contacts() — admin-only, rerunnable backfill
--     that links legacy company/contact text WITHOUT overwriting it.
--
-- Rollback (manual, one-time, non-destructive):
--   alter table public.opportunities drop constraint if exists opportunities_org_account_fkey;
--   alter table public.opportunities drop constraint if exists opportunities_org_contact_fkey;
--   alter table public.contacts drop constraint if exists contacts_org_account_fkey;
--   update public.opportunities set account_id = null, contact_id = null;
--   drop table if exists public.contacts;
--   drop table if exists public.accounts;
-- Legacy company/contact/email/phone columns are never dropped.
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

-- Duplicate names are rejected only when EXACTLY equal (case/space-insensitive)
-- within the same organization. Similar text is never auto-merged.
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
-- No unique constraint on names/emails: two people can share a name, and an
-- info@ address can be shared. Duplicates are handled with UI warnings only.

alter table public.opportunities
  add column if not exists account_id uuid,
  add column if not exists contact_id uuid;

-- Replace earlier single-column references, if this patch was partially
-- applied, with same-organization composite FKs. PostgreSQL 15+ column-list
-- SET NULL preserves the required organization_id during deletes.
alter table public.contacts drop constraint if exists contacts_account_id_fkey;
alter table public.opportunities drop constraint if exists opportunities_account_id_fkey;
alter table public.opportunities drop constraint if exists opportunities_contact_id_fkey;
do $constraints$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.contacts'::regclass and conname = 'contacts_org_account_fkey') then
    alter table public.contacts
      add constraint contacts_org_account_fkey
      foreign key (organization_id, account_id)
      references public.accounts (organization_id, id)
      on delete set null (account_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.opportunities'::regclass and conname = 'opportunities_org_account_fkey') then
    alter table public.opportunities
      add constraint opportunities_org_account_fkey
      foreign key (organization_id, account_id)
      references public.accounts (organization_id, id)
      on delete set null (account_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.opportunities'::regclass and conname = 'opportunities_org_contact_fkey') then
    alter table public.opportunities
      add constraint opportunities_org_contact_fkey
      foreign key (organization_id, contact_id)
      references public.contacts (organization_id, id)
      on delete set null (contact_id);
  end if;
end
$constraints$;

create index if not exists opportunities_account_idx
  on public.opportunities (account_id) where account_id is not null;
create index if not exists opportunities_contact_idx
  on public.opportunities (contact_id) where contact_id is not null;

-- updated_at maintenance ------------------------------------------------

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

-- Row Level Security ----------------------------------------------------

alter table public.accounts enable row level security;
alter table public.contacts enable row level security;

-- Idempotent policy (re)creation.
do $policy$
declare existing record;
begin
  for existing in
    select policyname from pg_policies
    where schemaname = 'public' and tablename in ('accounts', 'contacts')
  loop
    execute format('drop policy %I on public.%I', existing.policyname, existing.tablename);
  end loop;
end;
$policy$;

-- Members of the organization can read, create and edit shared records;
-- deletion stays owner-only. Cross-organization access fails closed because
-- every predicate includes organization_id via the membership helpers.
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

-- Backfill -------------------------------------------------------------
-- Creates account/contact records from LEGACY opportunity text and links
-- rows that are not linked yet. It NEVER rewrites company/contact/email/phone
-- columns, never touches an existing link, and is safe to rerun: each pass
-- only inserts rows that do not exist yet (exact org-scoped name match) and
-- only fills NULL foreign keys. Run as a database administrator in the SQL
-- Editor; this function is deliberately not callable by application users.

create or replace function public.backfill_account_contacts()
returns table (
  accounts_created bigint,
  contacts_created bigint,
  opportunities_linked bigint
)
language plpgsql
as $fn$
declare
  v_accounts bigint := 0;
  v_contacts bigint := 0;
  v_links bigint := 0;
  v_rows bigint := 0;
begin
  -- 1) One account per distinct legacy company name (per organization).
  with source as (
    select distinct on (o.organization_id, lower(trim(o.company)))
      o.organization_id,
      nullif(trim(o.company), '') as name
    from public.opportunities o
    where o.organization_id is not null
      and nullif(trim(o.company), '') is not null
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

  -- 2) One contact per distinct legacy contact tuple within its account.
  --    Same-name contacts at different companies remain distinct.
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
    where o.organization_id is not null
      and nullif(trim(o.contact), '') is not null
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
      and coalesce(lower(trim(c.email)), '') = coalesce(s.email, '')
      and coalesce(trim(c.phone), '') = coalesce(s.phone, '')
  );
  get diagnostics v_contacts = row_count;

  -- 3) Link only rows whose FKs are still NULL. Never overwrites a link.
  update public.opportunities o
  set account_id = (
    select a.id from public.accounts a
    where a.organization_id = o.organization_id
      and lower(trim(a.name)) = lower(trim(o.company))
    order by a.created_at
    limit 1
  )
  where o.account_id is null
    and o.organization_id is not null
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
      and c.account_id is not distinct from (
        select a.id from public.accounts a
        where a.organization_id = o.organization_id
          and lower(trim(a.name)) = lower(trim(o.company))
        limit 1
      )
      and lower(trim(c.full_name)) = lower(trim(o.contact))
      and coalesce(lower(c.email), '') = coalesce(lower(trim(o.email)), '')
      and coalesce(trim(c.phone), '') = coalesce(trim(o.phone), '')
    order by c.created_at
    limit 1
  )
  where o.contact_id is null
    and o.organization_id is not null
    and nullif(trim(o.contact), '') is not null
    and lower(trim(o.contact)) <> 'unassigned'
    and exists (
      select 1 from public.contacts c
      where c.organization_id = o.organization_id
        and c.account_id is not distinct from (
          select a.id from public.accounts a
          where a.organization_id = o.organization_id
            and lower(trim(a.name)) = lower(trim(o.company))
          limit 1
        )
        and lower(trim(c.full_name)) = lower(trim(o.contact))
        and coalesce(lower(c.email), '') = coalesce(lower(trim(o.email)), '')
        and coalesce(trim(c.phone), '') = coalesce(trim(o.phone), '')
    );
  get diagnostics v_rows = row_count;
  v_links := v_links + v_rows;

  return query select v_accounts, v_contacts, v_links;
end;
$fn$;

revoke all on function public.backfill_account_contacts() from public, anon, authenticated;
