-- Atomic per-organization invitation throttle. Apply after schema.sql when
-- updating an existing database; app routes fail closed until this patch is
-- present.

create table if not exists public.invitation_rate_limits (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 21),
  updated_at timestamptz not null default now()
);

alter table public.invitation_rate_limits enable row level security;
revoke all on public.invitation_rate_limits from public, anon, authenticated;

create or replace function public.claim_invitation_slot(target_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_attempt_count integer;
begin
  insert into public.invitation_rate_limits as rate_limit (
    organization_id, window_started_at, attempt_count, updated_at
  ) values (
    target_organization_id, now(), 1, now()
  )
  on conflict (organization_id) do update
  set window_started_at = case
        when rate_limit.window_started_at <= now() - interval '1 hour' then now()
        else rate_limit.window_started_at
      end,
      attempt_count = case
        when rate_limit.window_started_at <= now() - interval '1 hour' then 1
        else least(rate_limit.attempt_count + 1, 21)
      end,
      updated_at = now()
  returning attempt_count into current_attempt_count;

  return current_attempt_count <= 20;
end;
$$;

revoke all on function public.claim_invitation_slot(uuid) from public, anon, authenticated;
grant execute on function public.claim_invitation_slot(uuid) to service_role;

notify pgrst, 'reload schema';
