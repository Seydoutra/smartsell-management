-- Smartsell Management V2 — modules opérationnels complémentaires
-- Peut être exécuté plusieurs fois sans dupliquer les structures.
create extension if not exists "pgcrypto";

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(), name text not null, category text,
  description text, unit text not null default 'Prestation', unit_price numeric(16,2) not null default 0,
  currency text not null default 'GNF', tax_rate numeric(5,2) not null default 0,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.editorial_items add column if not exists published_url text;

create table if not exists public.commercial_documents (
  id uuid primary key default gen_random_uuid(), number text not null unique,
  kind text not null check(kind in ('BON_COMMANDE','BON_LIVRAISON','BON_VENTE','BON_SORTIE')),
  client_id uuid not null references public.clients(id), project_id uuid references public.projects(id),
  status text not null default 'BROUILLON', issue_date date not null default current_date,
  expected_date date, currency text not null default 'GNF', total numeric(16,2) not null default 0,
  notes text, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.commercial_document_items (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.commercial_documents(id) on delete cascade,
  service_id uuid references public.service_catalog(id), description text not null,
  quantity numeric(12,2) not null default 1, unit_price numeric(16,2) not null default 0, sort_order int not null default 0
);

create table if not exists public.client_portal_access (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  can_view_finance boolean not null default true, can_comment boolean not null default true,
  active boolean not null default true, created_at timestamptz not null default now()
);

create table if not exists public.employee_records (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  job_title text, contract_type text, hired_on date, leave_balance numeric(6,2) not null default 0,
  emergency_contact text, notes text, updated_at timestamptz not null default now()
);
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id),
  starts_on date not null, ends_on date not null, reason text, status text not null default 'EN_ATTENTE',
  reviewed_by uuid references public.profiles(id), created_at timestamptz not null default now(), check(ends_on>=starts_on)
);

create sequence if not exists public.commercial_document_seq start 1;
create or replace function public.create_commercial_document(
  p_kind text,p_client_id uuid,p_project_id uuid,p_expected_date date,p_currency text,p_total numeric,p_notes text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_number text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_role() not in ('SUPER_ADMIN','ADMIN','MANAGER','COMMERCIAL','COMPTABLE') then raise exception 'Permission denied'; end if;
  v_number := case p_kind when 'BON_COMMANDE' then 'BC' when 'BON_LIVRAISON' then 'BL' when 'BON_VENTE' then 'BV' else 'BS' end
    ||'-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.commercial_document_seq')::text,4,'0');
  insert into public.commercial_documents(number,kind,client_id,project_id,expected_date,currency,total,notes,created_by)
  values(v_number,p_kind,p_client_id,p_project_id,p_expected_date,coalesce(p_currency,'GNF'),coalesce(p_total,0),p_notes,auth.uid()) returning id into v_id;
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'CREATE','commercial_document',v_id,jsonb_build_object('number',v_number,'kind',p_kind));
  return v_id;
end $$;

alter table public.service_catalog enable row level security;
alter table public.commercial_documents enable row level security;
alter table public.commercial_document_items enable row level security;
alter table public.client_portal_access enable row level security;
alter table public.employee_records enable row level security;
alter table public.leave_requests enable row level security;

do $$ declare t text; begin foreach t in array array['service_catalog','commercial_documents','commercial_document_items','employee_records','leave_requests'] loop
  execute format('drop policy if exists authenticated_read on public.%I',t);
  execute format('create policy authenticated_read on public.%I for select to authenticated using (true)',t);
  execute format('drop policy if exists authenticated_write on public.%I',t);
  execute format('create policy authenticated_write on public.%I for all to authenticated using (public.current_role() <> ''COLLABORATEUR'') with check (public.current_role() <> ''COLLABORATEUR'')',t);
end loop; end $$;
drop policy if exists portal_admin on public.client_portal_access;
create policy portal_admin on public.client_portal_access for all to authenticated using(public.is_admin() or profile_id=auth.uid()) with check(public.is_admin());
grant execute on function public.create_commercial_document(text,uuid,uuid,date,text,numeric,text) to authenticated;
