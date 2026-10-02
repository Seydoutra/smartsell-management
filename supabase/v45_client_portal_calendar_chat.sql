-- Client portal: tenant-safe project/calendar views and a private append-only conversation.
begin;

create or replace function public.portal_client_allowed(target_client_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (
    select 1 from public.client_portal_access access
    where access.client_id=target_client_id
      and access.profile_id=auth.uid()
      and access.active
      and access.tenant_owner_id=public.current_tenant_owner_id()
  )
$$;
create or replace function public.portal_finance_allowed(target_client_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (
    select 1 from public.client_portal_access access
    where access.client_id=target_client_id
      and access.profile_id=auth.uid()
      and access.active and access.can_view_finance
      and access.tenant_owner_id=public.current_tenant_owner_id()
  )
$$;
create or replace function public.portal_comment_allowed(target_client_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (
    select 1 from public.client_portal_access access
    where access.client_id=target_client_id
      and access.profile_id=auth.uid()
      and access.active and access.can_comment
      and access.tenant_owner_id=public.current_tenant_owner_id()
  )
$$;
revoke all on function public.portal_client_allowed(uuid) from public;
revoke all on function public.portal_finance_allowed(uuid) from public;
revoke all on function public.portal_comment_allowed(uuid) from public;
grant execute on function public.portal_client_allowed(uuid),public.portal_finance_allowed(uuid),public.portal_comment_allowed(uuid) to authenticated,service_role;

alter table public.creative_approvals add column if not exists tenant_owner_id uuid;
alter table public.creative_feedback add column if not exists tenant_owner_id uuid;
update public.creative_approvals approval set tenant_owner_id=client.tenant_owner_id
  from public.clients client where approval.client_id=client.id and approval.tenant_owner_id is null;
update public.creative_feedback feedback set tenant_owner_id=approval.tenant_owner_id
  from public.creative_approvals approval where feedback.approval_id=approval.id and feedback.tenant_owner_id is null;
alter table public.creative_approvals alter column tenant_owner_id set not null;
alter table public.creative_feedback alter column tenant_owner_id set not null;
drop trigger if exists assign_tenant_owner on public.creative_approvals;
create trigger assign_tenant_owner before insert on public.creative_approvals for each row execute function public.assign_tenant_owner();
drop trigger if exists assign_tenant_owner on public.creative_feedback;
create trigger assign_tenant_owner before insert on public.creative_feedback for each row execute function public.assign_tenant_owner();

create table if not exists public.client_portal_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null default public.current_tenant_owner_id(),
  client_id uuid not null references public.clients(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists client_portal_messages_thread_idx on public.client_portal_messages(client_id,created_at,id);
alter table public.client_portal_messages enable row level security;
grant select,insert on public.client_portal_messages to authenticated;

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null default public.current_tenant_owner_id(),
  sender_id uuid not null references public.profiles(id),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists team_chat_messages_thread_idx on public.team_chat_messages(tenant_owner_id,created_at,id);
alter table public.team_chat_messages enable row level security;
grant select,insert on public.team_chat_messages to authenticated;

-- Old SaaS policies allowed every account in a tenant to read every client's records.
-- Replace them with staff-or-exact-client rules. A client cannot write operational records.
do $$
declare table_name text; policy_name text;
begin
  foreach table_name in array array[
    'client_portal_access','clients','projects','editorial_items','invoices',
    'invoice_items','payments','creative_approvals','creative_feedback','client_portal_messages'
  ] loop
    for policy_name in select policyname from pg_policies where schemaname='public' and tablename=table_name loop
      execute format('drop policy if exists %I on public.%I',policy_name,table_name);
    end loop;
  end loop;
end $$;

create policy portal_access_read on public.client_portal_access for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (public.current_role()::text <> 'CLIENT' or profile_id=auth.uid()));
create policy portal_access_staff_write on public.client_portal_access for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');

create policy portal_clients_read on public.clients for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (public.current_role()::text <> 'CLIENT' or public.portal_client_allowed(id)));
create policy portal_clients_staff_write on public.clients for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');

create policy portal_projects_read on public.projects for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (public.current_role()::text <> 'CLIENT' or public.portal_client_allowed(client_id)));
create policy portal_projects_staff_write on public.projects for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');

create policy portal_editorial_read on public.editorial_items for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (public.current_role()::text <> 'CLIENT' or public.portal_client_allowed(client_id)));
create policy portal_editorial_staff_write on public.editorial_items for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');

create policy portal_invoices_read on public.invoices for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (public.current_role()::text <> 'CLIENT' or public.portal_finance_allowed(client_id)));
create policy portal_invoices_staff_write on public.invoices for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');

create policy portal_invoice_items_read on public.invoice_items for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and exists (
  select 1 from public.invoices invoice where invoice.id=invoice_id and invoice.tenant_owner_id=public.current_tenant_owner_id()
    and (public.current_role()::text <> 'CLIENT' or public.portal_finance_allowed(invoice.client_id))));
create policy portal_invoice_items_staff_write on public.invoice_items for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');

create policy portal_payments_read on public.payments for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and exists (
  select 1 from public.invoices invoice where invoice.id=invoice_id and invoice.tenant_owner_id=public.current_tenant_owner_id()
    and (public.current_role()::text <> 'CLIENT' or public.portal_finance_allowed(invoice.client_id))));
create policy portal_payments_staff_write on public.payments for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');

create policy portal_creative_read on public.creative_approvals for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (public.current_role()::text <> 'CLIENT' or public.portal_client_allowed(client_id)));
create policy portal_creative_staff_write on public.creative_approvals for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');
create policy portal_feedback_read on public.creative_feedback for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and exists (
  select 1 from public.creative_approvals approval where approval.id=approval_id
  and (public.current_role()::text <> 'CLIENT' or public.portal_client_allowed(approval.client_id))));
create policy portal_feedback_staff_write on public.creative_feedback for all to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT')
with check (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');

create policy portal_messages_read on public.client_portal_messages for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (public.current_role()::text <> 'CLIENT' or public.portal_client_allowed(client_id)));
create policy portal_messages_insert on public.client_portal_messages for insert to authenticated
with check (tenant_owner_id=public.current_tenant_owner_id() and sender_id=auth.uid()
  and exists(select 1 from public.clients client where client.id=client_id and client.tenant_owner_id=public.current_tenant_owner_id())
  and (public.current_role()::text <> 'CLIENT' or public.portal_comment_allowed(client_id)));

create policy team_chat_read on public.team_chat_messages for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.current_role()::text <> 'CLIENT');
create policy team_chat_insert on public.team_chat_messages for insert to authenticated
with check (tenant_owner_id=public.current_tenant_owner_id() and sender_id=auth.uid() and public.current_role()::text <> 'CLIENT');

-- A client may inspect their own profile, never another client's or an employee's full profile.
drop policy if exists tenant_profiles_select on public.profiles;
create policy tenant_profiles_select on public.profiles for select to authenticated
using (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id()
  and (public.current_role()::text <> 'CLIENT' or id=auth.uid())));

commit;
