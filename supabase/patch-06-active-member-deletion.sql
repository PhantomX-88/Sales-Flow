-- Replace the deletion-request RPC for existing databases so deactivated
-- members cannot use its SECURITY DEFINER privileges to create requests.
-- Apply after schema.sql (the function's tables and helper already exist).

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

  if not public.is_organization_member(v_opportunity.organization_id) then
    raise exception 'Only an active organization member can request deletion.';
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

notify pgrst, 'reload schema';
