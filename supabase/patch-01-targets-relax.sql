-- ============================================================
-- PATCH 01 — sales_targets legacy reconciliation (standalone)
-- Run this FIRST in the Supabase SQL Editor, then PATCH 02.
--
-- Why it exists: CREATE TABLE IF NOT EXISTS is a no-op when the
-- table already exists, so an older sales_targets shape (created
-- by an earlier app version or by hand) survives a schema.sql run.
-- Postgres only validates PL/pgSQL bodies at RUNTIME, so
-- accept_invitation() creates fine but explodes later with:
--   23502: null value in column "target_period" ... violates
--          not-null constraint
--
-- This script is idempotent: safe to run multiple times,
-- preserves every row, never drops a column.
-- ============================================================

-- 1) Diagnostic: show what you actually have right now.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'sales_targets'
order by ordinal_position;

-- 2) Ensure every column Phase 2/3 depends on exists. One statement
--    per column on purpose — a single multi-ADD COLUMN batch aborts
--    entirely if one clause trips on some parsers.
alter table public.sales_targets add column if not exists id uuid default gen_random_uuid();
alter table public.sales_targets add column if not exists organization_id uuid;
alter table public.sales_targets add column if not exists user_id uuid;
alter table public.sales_targets add column if not exists target_amount numeric not null default 0;
alter table public.sales_targets add column if not exists period text not null default 'monthly';
alter table public.sales_targets add column if not exists source text not null default 'manual';
alter table public.sales_targets add column if not exists created_at timestamptz not null default now();
alter table public.sales_targets add column if not exists updated_at timestamptz not null default now();

-- 3) Heal legacy names and — critically — relax legacy NOT NULL
--    columns that have no default, which is what kills the 23502.
do $patch$
begin
  -- amount -> target_amount (both exist: backfill then keep both)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'amount')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_amount') then
    execute 'update public.sales_targets set target_amount = amount where (target_amount is null or target_amount = 0) and amount is not null';
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'amount') then
    execute 'alter table public.sales_targets rename column amount to target_amount';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_value')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_amount') then
    execute 'alter table public.sales_targets rename column target_value to target_amount';
  end if;

  -- period <-> target_period sync, then relax legacy NOT NULL.
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_period')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'period') then
    execute 'update public.sales_targets set period = target_period where (period is null or period = ''monthly'') and target_period is not null';
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

  -- Relax other common legacy NOT NULL columns.
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
end
$patch$;

-- 4) Backfill defaults / FKs without touching data.
do $patch$
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
end
$patch$;

-- 5) Hard verify: fail LOUDLY here (not later inside accept_invitation)
--    if a required column is still missing; print the actual shape.
do $patch$
declare
  v_cols text;
begin
  select string_agg(column_name, ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'sales_targets';
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'target_amount') then
    raise exception 'REPAIR FAILED: target_amount still missing. Columns: [%]', v_cols;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_targets' and column_name = 'period') then
    raise exception 'REPAIR FAILED: period still missing. Columns: [%]', v_cols;
  end if;
  raise notice 'REPAIR OK: sales_targets columns = [%]', v_cols;
end
$patch$;

-- 6) Confirm the fixed shape.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'sales_targets'
order by ordinal_position;

