-- ============================================================
-- PATCH 02 — accept_invitation, dashboard-safe rebuild
-- Run AFTER patch-01-targets-relax.sql.
--
-- Two fixes vs the version in schema.sql:
--   1. Uses $func$ tags (not $$) so the SQL Editor's dollar-quote
--      parser never reports 42601 "unterminated dollar-quoted
--      string" and rolls the whole run back.
--   2. NO nested EXECUTE '... $1 ... ''invitation''' dynamic SQL —
--      a plain insert (the legacy target_period column was already
--      relaxed to nullable + default by PATCH 01), plus a guarded
--      legacy sync that is a harmless no-op when that column is
--      absent.
-- Idempotent: CREATE OR REPLACE, preserves behaviour exactly.
-- ============================================================

create or replace function public.accept_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $func$
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

  -- Keep a legacy target_period column in sync when present; this block
  -- is skipped at runtime when the column does not exist.
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
$func$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;
