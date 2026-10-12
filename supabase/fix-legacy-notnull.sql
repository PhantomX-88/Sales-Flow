-- ============================================================
-- FIX — legacy NOT NULL columns the app does not supply
-- Run this in the Supabase SQL Editor if you see errors like:
--   23502: null value in column "activity_type" of relation
--          "activities" violates not-null constraint
--
-- Why it happens: an older app version created tables with
-- different column names (activity_type vs type) and hard
-- NOT NULL constraints without defaults. CREATE TABLE IF NOT
-- EXISTS never touches an existing table, so the legacy shape
-- survives a schema.sql run and every modern insert dies.
--
-- This script (1) heals the confirmed activities.activity_type
-- split by syncing both directions, then (2) sweeps ALL business
-- tables and drops NOT NULL from any column that is NOT part of
-- the canonical shape AND has no default AND is not supplied by
-- the app — every other column keeps its integrity. Idempotent,
-- preserves every row, never drops a column.
-- ============================================================

-- SECTION A: activities.activity_type <-> activities.type -------
do $patch$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activities' and column_name = 'activity_type'
  ) then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'activities' and column_name = 'type'
    ) then
      -- Both exist: legacy values flow into the canonical column while it
      -- is still at its default, then the legacy column mirrors canonical.
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
      -- Only the legacy name exists: rename it to canonical.
      execute 'alter table public.activities rename column activity_type to type';
    end if;
  end if;
end
$patch$;

-- SECTION B: generic sweep for the same pattern on every business
-- table. A column is only relaxed when ALL of these hold:
--   * the table is a known business table
--   * the column is NOT NULL with NO default (inserts cannot fill it)
--   * the column is NOT in that table's canonical keep-list
--     (keep-lists = primary keys and columns the app always supplies)
-- Columns WITH defaults never produce a null in practice, so they
-- are skipped too. Each ALTER is guarded so one surprise column can
-- never abort the repair.
do $patch$
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
$patch$;

-- Verification: this must return ZERO rows for the app to be safe.
select table_name, column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('opportunities', 'activities', 'organizations', 'organization_members', 'profiles', 'audit_log', 'sales_targets')
  and is_nullable = 'NO'
  and column_default is null
  and not (
    (table_name, column_name) in (
      ('opportunities', 'id'), ('opportunities', 'organization_id'), ('opportunities', 'company'), ('opportunities', 'stage'), ('opportunities', 'owner'),
      ('activities', 'id'), ('activities', 'organization_id'), ('activities', 'type'), ('activities', 'text'),
      ('organizations', 'id'), ('organizations', 'name'), ('organizations', 'slug'),
      ('organization_members', 'organization_id'), ('organization_members', 'user_id'), ('organization_members', 'role'), ('organization_members', 'status'),
      ('profiles', 'id'), ('profiles', 'full_name'),
      ('audit_log', 'id'), ('audit_log', 'organization_id'), ('audit_log', 'action'), ('audit_log', 'entity'),
      ('sales_targets', 'id'), ('sales_targets', 'organization_id'), ('sales_targets', 'user_id'), ('sales_targets', 'target_amount'), ('sales_targets', 'period'), ('sales_targets', 'source')
    )
  )
order by table_name, column_name;

