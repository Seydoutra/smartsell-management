-- Expired SaaS trials remain readable, but cannot change business data.
-- A payment request is not proof of payment; only a verified provider callback
-- or the platform owner may activate a paid account later.
begin;

create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null references public.profiles(id),
  requested_by uuid not null references auth.users(id),
  plan text not null check (plan in ('ESSENTIEL','CROISSANCE','ENTREPRISE')),
  billing_period text not null check (billing_period in ('MONTHLY','ANNUAL')),
  amount_gnf bigint not null check (amount_gnf > 0),
  payment_method text not null check (payment_method in ('ORANGE_MONEY','MOBILE_MONEY')),
  phone text not null check (length(phone) between 8 and 20),
  status text not null default 'PENDING_GATEWAY' check (status in ('PENDING_GATEWAY','PAYMENT_PENDING','PAID','CANCELLED')),
  created_at timestamptz not null default now(),
  constraint subscription_requests_price_check check (amount_gnf = case
    when plan='ESSENTIEL' and billing_period='MONTHLY' then 300000
    when plan='ESSENTIEL' and billing_period='ANNUAL' then 3240000
    when plan='CROISSANCE' and billing_period='MONTHLY' then 700000
    when plan='CROISSANCE' and billing_period='ANNUAL' then 7560000
    when plan='ENTREPRISE' and billing_period='MONTHLY' then 1000000
    when plan='ENTREPRISE' and billing_period='ANNUAL' then 10800000
    else 0 end)
);
create index if not exists subscription_requests_tenant_created_idx on public.subscription_requests(tenant_owner_id,created_at desc);
alter table public.subscription_requests enable row level security;
drop policy if exists subscription_requests_select on public.subscription_requests;
create policy subscription_requests_select on public.subscription_requests for select to authenticated
using (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id() and requested_by=auth.uid()));
drop policy if exists subscription_requests_insert on public.subscription_requests;
create policy subscription_requests_insert on public.subscription_requests for insert to authenticated
with check (tenant_owner_id=auth.uid() and requested_by=auth.uid() and status='PENDING_GATEWAY');
grant select,insert on public.subscription_requests to authenticated;

create or replace function public.guard_trial_profile_fields() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is not null and not public.is_platform_owner() and (
    new.tenant_owner_id is distinct from old.tenant_owner_id or
    new.is_platform_owner is distinct from old.is_platform_owner or
    new.is_temporary is distinct from old.is_temporary or
    new.access_expires_at is distinct from old.access_expires_at
  ) then
    raise exception 'La durée d’essai et les droits de propriété sont gérés par SmartSell.';
  end if;
  return new;
end $$;
drop trigger if exists guard_trial_profile_fields on public.profiles;
create trigger guard_trial_profile_fields before update on public.profiles
for each row execute function public.guard_trial_profile_fields();

create or replace function public.enforce_trial_write_access() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare trial_ends timestamptz; temporary_account boolean;
begin
  if auth.uid() is null or public.is_platform_owner() then
    return coalesce(new,old);
  end if;
  select p.access_expires_at,p.is_temporary into trial_ends,temporary_account
  from public.profiles p where p.id=public.current_tenant_owner_id();
  if temporary_account and trial_ends is not null and trial_ends<=now() then
    raise exception 'Essai terminé : espace en lecture seule. Choisissez un abonnement pour continuer.';
  end if;
  return coalesce(new,old);
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'clients','client_contacts','prospects','prospect_activities','projects','project_members',
    'tasks','task_assignees','task_comments','shoots','shoot_members','editorial_items',
    'editorial_comments','quotes','quote_items','invoices','invoice_items','payments',
    'expenses','equipment','equipment_categories','equipment_bookings','equipment_movements',
    'purchase_requests','contracts','documents','campaigns','campaign_recipients',
    'communication_jobs','service_catalog','commercial_documents','commercial_document_items',
    'employee_records','leave_requests','social_integrations','calendar_connections'
  ] loop
    if to_regclass('public.'||table_name) is null then continue; end if;
    execute format('drop trigger if exists enforce_trial_write_access on public.%I',table_name);
    execute format('create trigger enforce_trial_write_access before insert or update or delete on public.%I for each row execute function public.enforce_trial_write_access()',table_name);
  end loop;
end $$;
commit;
