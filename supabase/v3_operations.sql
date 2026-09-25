-- Smartsell Management V3 — performance, fournisseurs, rappels, RH et éditorial multicanal.
-- Migration idempotente à exécuter après setup.sql, production_upgrade.sql et v2_complete_platform.sql.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  contact_name text,
  phone text,
  whatsapp text,
  email text,
  address text,
  tax_id text,
  notes text,
  status text not null default 'ACTIF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists reminder_minutes integer not null default 30;
alter table public.tasks add column if not exists notification_channels text[] not null default array['IN_APP']::text[];
alter table public.tasks add column if not exists reminder_sent_at timestamptz;
alter table public.editorial_items add column if not exists platforms text[] not null default '{}'::text[];
alter table public.editorial_items add column if not exists platform_links jsonb not null default '{}'::jsonb;
alter table public.editorial_items add column if not exists asset_urls text[] not null default '{}'::text[];
alter table public.employee_records add column if not exists contract_ends_on date;
alter table public.employee_records add column if not exists salary numeric(16,2);
alter table public.employee_records add column if not exists address text;
alter table public.employee_records add column if not exists birth_date date;
alter table public.leave_requests add column if not exists kind text default 'CONGE';

create table if not exists public.calendar_connections (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'GOOGLE',
  calendar_email text,
  connected boolean not null default false,
  sync_enabled boolean not null default true,
  encrypted_refresh_token text,
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  channel text not null,
  scheduled_for timestamptz not null,
  status text not null default 'QUEUED',
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  unique(task_id, channel, scheduled_for)
);

create index if not exists idx_clients_created_at on public.clients(created_at desc);
create index if not exists idx_projects_created_at on public.projects(created_at desc);
create index if not exists idx_tasks_created_at on public.tasks(created_at desc);
create index if not exists idx_tasks_reminders on public.tasks(due_at, reminder_sent_at) where status <> 'TERMINE';
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);
create index if not exists idx_activity_actor_date on public.activity_logs(actor_id, created_at desc);
create index if not exists idx_sessions_profile_date on public.user_sessions(profile_id, last_seen_at desc);

create or replace function public.create_quote_with_items(
  p_client_id uuid,
  p_project_id uuid,
  p_valid_until date,
  p_currency text,
  p_discount numeric,
  p_items jsonb
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_number text; v_total numeric(16,2); v_tax numeric(16,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_role() not in ('SUPER_ADMIN','ADMIN','MANAGER','COMMERCIAL','COMPTABLE') then raise exception 'Permission denied'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'Le devis doit contenir au moins une ligne'; end if;
  select coalesce(sum((x->>'quantity')::numeric*(x->>'unit_price')::numeric*coalesce((x->>'tax_rate')::numeric,0)/100),0),
         coalesce(sum((x->>'quantity')::numeric*(x->>'unit_price')::numeric*(1+coalesce((x->>'tax_rate')::numeric,0)/100)),0)-coalesce(p_discount,0)
  into v_tax,v_total from jsonb_array_elements(p_items) x;
  v_number := 'DEV-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.quote_number_seq')::text,4,'0');
  insert into public.quotes(number,client_id,project_id,valid_until,currency,discount,tax,total,status)
  values(v_number,p_client_id,p_project_id,p_valid_until,coalesce(p_currency,'GNF'),coalesce(p_discount,0),v_tax,v_total,'BROUILLON') returning id into v_id;
  insert into public.quote_items(quote_id,description,quantity,unit_price,tax_rate,sort_order)
  select v_id,x->>'description',(x->>'quantity')::numeric,(x->>'unit_price')::numeric,coalesce((x->>'tax_rate')::numeric,0),ordinality-1
  from jsonb_array_elements(p_items) with ordinality as items(x,ordinality);
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'CREATE','quote',v_id,jsonb_build_object('number',v_number,'total',v_total));
  return v_id;
end $$;

alter table public.suppliers enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.reminder_deliveries enable row level security;

drop policy if exists suppliers_read on public.suppliers;
create policy suppliers_read on public.suppliers for select to authenticated using(true);
drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers for all to authenticated
  using(public.current_role() in ('SUPER_ADMIN','ADMIN','MANAGER','COMPTABLE'))
  with check(public.current_role() in ('SUPER_ADMIN','ADMIN','MANAGER','COMPTABLE'));
drop policy if exists calendar_owner on public.calendar_connections;
create policy calendar_owner on public.calendar_connections for all to authenticated
  using(profile_id=auth.uid() or public.is_admin()) with check(profile_id=auth.uid() or public.is_admin());
drop policy if exists reminders_owner on public.reminder_deliveries;
create policy reminders_owner on public.reminder_deliveries for select to authenticated
  using(profile_id=auth.uid() or public.is_admin());

grant execute on function public.create_quote_with_items(uuid,uuid,date,text,numeric,jsonb) to authenticated;

