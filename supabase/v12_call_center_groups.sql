-- SmartSell V12 — listes d'appels importées, résultats et groupes de campagnes.
create table if not exists public.contact_groups (id uuid primary key default gen_random_uuid(), name text not null, description text, created_by uuid references public.profiles(id), created_at timestamptz not null default now());
create table if not exists public.contact_group_members (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.contact_groups(id) on delete cascade, name text not null, phone text, email text, company text, tags text, marketing_opt_in boolean not null default true, created_at timestamptz not null default now(), check(phone is not null or email is not null));
create table if not exists public.call_lists (id uuid primary key default gen_random_uuid(), name text not null, source_filename text, created_by uuid references public.profiles(id), created_at timestamptz not null default now());
create table if not exists public.call_list_contacts (id uuid primary key default gen_random_uuid(), call_list_id uuid not null references public.call_lists(id) on delete cascade, name text not null, phone text not null, email text, company text, status text not null default 'TO_CALL' check(status in ('TO_CALL','DIALING','CALLED','CALLBACK','APPOINTMENT')), outcome text, appointment_at timestamptz, notes text, attempts int not null default 0, total_call_seconds int not null default 0, last_called_at timestamptz, created_at timestamptz not null default now());
alter table public.service_catalog add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
create index if not exists idx_contact_group_members_group on public.contact_group_members(group_id);
create index if not exists idx_call_list_contacts_queue on public.call_list_contacts(call_list_id,status,created_at);
do $$ declare t text; begin foreach t in array array['contact_groups','contact_group_members','call_lists','call_list_contacts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists authenticated_read on public.%I',t);
  execute format('create policy authenticated_read on public.%I for select to authenticated using (true)',t);
  execute format('drop policy if exists authenticated_write on public.%I',t);
  execute format('create policy authenticated_write on public.%I for all to authenticated using (public.action_allowed(''communication.send'')) with check (public.action_allowed(''communication.send''))',t);
  execute format('drop policy if exists beta_sandbox_isolation on public.%I',t);
  execute format('create policy beta_sandbox_isolation on public.%I as restrictive for all to authenticated using (not public.current_is_beta_tester()) with check (not public.current_is_beta_tester())',t);
end loop; end $$;
