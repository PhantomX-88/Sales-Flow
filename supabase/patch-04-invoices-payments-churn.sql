-- SalesFlow: invoice approval/delivery, closed-won payment tracking, and churn.
-- Apply after schema.sql and patches 01-03.

do $$
declare constraint_row record;
begin
  for constraint_row in
    select conname from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) ilike '%stage%'
  loop
    execute format('alter table public.opportunities drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.opportunities
  add constraint opportunities_stage_check
  check (stage in ('Lead', 'Discovery', 'Qualified', 'Proposal', 'Invoiced', 'Negotiation', 'Closed Won', 'Closed Lost'));

alter table public.opportunities
  add column if not exists amount_paid numeric(14,2),
  add column if not exists payment_frequency text,
  add column if not exists installment_amount numeric(14,2),
  add column if not exists next_payment_date date;

create unique index if not exists opportunities_org_id_uidx
  on public.opportunities (organization_id, id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'opportunities_payment_frequency_check') then
    alter table public.opportunities add constraint opportunities_payment_frequency_check
      check (payment_frequency is null or payment_frequency in ('monthly', 'quarterly', 'triannual', 'biannual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'opportunities_amount_paid_check') then
    alter table public.opportunities add constraint opportunities_amount_paid_check
      check (amount_paid is null or (amount_paid >= 0 and amount_paid <= value));
  end if;
end $$;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null,
  invoice_number text not null,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  due_date date not null,
  notes text,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'approved', 'rejected', 'sent')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invoices_org_opportunity_fkey foreign key (organization_id, opportunity_id)
    references public.opportunities(organization_id, id) on delete cascade,
  constraint invoices_org_number_unique unique (organization_id, invoice_number)
);

create table if not exists public.churn_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null,
  churned_at date not null,
  outstanding_amount numeric(14,2) not null default 0 check (outstanding_amount >= 0),
  reason text not null,
  notes text,
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint churn_org_opportunity_fkey foreign key (organization_id, opportunity_id)
    references public.opportunities(organization_id, id) on delete cascade
);

create index if not exists invoices_org_status_created_idx on public.invoices (organization_id, status, created_at desc);
create index if not exists invoices_opportunity_idx on public.invoices (opportunity_id, created_at desc);
create index if not exists churn_records_org_date_idx on public.churn_records (organization_id, churned_at desc);

alter table public.invoices enable row level security;
alter table public.churn_records enable row level security;

drop policy if exists invoices_select on public.invoices;
drop policy if exists invoices_insert on public.invoices;
drop policy if exists invoices_owner_update on public.invoices;
drop policy if exists churn_records_select on public.churn_records;
drop policy if exists churn_records_insert on public.churn_records;
drop policy if exists churn_records_update on public.churn_records;

create policy invoices_select on public.invoices
  for select using (
    public.is_organization_member(organization_id)
    and (
      public.is_organization_owner(organization_id)
      or created_by = auth.uid()
      or exists (
        select 1 from public.opportunities o
        where o.id = opportunity_id and o.organization_id = invoices.organization_id
          and o.owner_id = auth.uid()
      )
    )
  );
create policy invoices_insert on public.invoices
  for insert with check (
    public.is_organization_member(organization_id)
    and created_by = auth.uid()
    and (status = 'pending_approval' or public.is_organization_owner(organization_id))
    and (
      public.is_organization_owner(organization_id)
      or exists (
        select 1 from public.opportunities o
        where o.id = opportunity_id and o.organization_id = invoices.organization_id
          and o.owner_id = auth.uid()
      )
    )
  );
create policy invoices_owner_update on public.invoices
  for update using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

create policy churn_records_select on public.churn_records
  for select using (
    public.is_organization_member(organization_id)
    and (
      public.is_organization_owner(organization_id)
      or recorded_by = auth.uid()
      or exists (
        select 1 from public.opportunities o
        where o.id = opportunity_id and o.organization_id = churn_records.organization_id
          and o.owner_id = auth.uid()
      )
    )
  );
create policy churn_records_insert on public.churn_records
  for insert with check (
    public.is_organization_member(organization_id)
    and recorded_by = auth.uid()
    and (
      public.is_organization_owner(organization_id)
      or exists (
        select 1 from public.opportunities o
        where o.id = opportunity_id and o.organization_id = churn_records.organization_id
          and o.owner_id = auth.uid()
      )
    )
  );
create policy churn_records_update on public.churn_records
  for update using (public.is_organization_owner(organization_id))
  with check (public.is_organization_owner(organization_id));

grant select, insert, update on public.invoices to authenticated;
grant select, insert, update on public.churn_records to authenticated;

-- A rep can deliver an approved invoice without gaining permission to edit it.
create or replace function public.mark_invoice_sent(target_invoice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare changed integer;
begin
  update public.invoices i
  set status = 'sent'
  where i.id = target_invoice_id
    and i.created_by = auth.uid()
    and i.status = 'approved'
    and public.is_organization_member(i.organization_id);
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;
revoke all on function public.mark_invoice_sent(uuid) from public, anon;
grant execute on function public.mark_invoice_sent(uuid) to authenticated;

notify pgrst, 'reload schema';
