begin;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  subject text not null check (length(btrim(subject)) between 3 and 160),
  page_url text check (page_url is null or length(page_url) <= 500),
  status text not null default 'OPEN' check (status in ('OPEN','AWAITING_PLATFORM','REPLIED_BY_PLATFORM','CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_tenant_updated_idx on public.support_tickets(tenant_owner_id,updated_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  tenant_owner_id uuid not null references public.profiles(id),
  author_id uuid not null references public.profiles(id),
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id,created_at,id);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
grant select on public.support_tickets,public.support_messages to authenticated;
revoke insert,update,delete on public.support_tickets,public.support_messages from authenticated;

create or replace function public.can_read_support_ticket(p_tenant_owner_id uuid,p_created_by uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and (
    public.is_platform_owner() or
    (p_tenant_owner_id=public.current_tenant_owner_id() and (
      p_created_by=auth.uid() or exists(
        select 1 from public.profiles p where p.id=auth.uid()
          and (p.role in ('SUPER_ADMIN','ADMIN') or p.roles::text[] && array['SUPER_ADMIN','ADMIN']::text[])
      )
    ))
  )
$$;
revoke all on function public.can_read_support_ticket(uuid,uuid) from public;
grant execute on function public.can_read_support_ticket(uuid,uuid) to authenticated;

drop policy if exists support_tickets_read on public.support_tickets;
create policy support_tickets_read on public.support_tickets for select to authenticated
using (public.can_read_support_ticket(tenant_owner_id,created_by));
drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages for select to authenticated
using (exists(select 1 from public.support_tickets t where t.id=ticket_id
  and public.can_read_support_ticket(t.tenant_owner_id,t.created_by)));

create or replace function public.create_support_ticket(p_subject text,p_body text,p_page_url text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare ticket_id uuid; tenant_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if public.current_role()::text='CLIENT' then raise exception 'Accès réservé aux utilisateurs de l’espace'; end if;
  tenant_id:=public.current_tenant_owner_id();
  if tenant_id is null then raise exception 'Espace introuvable'; end if;
  if length(btrim(coalesce(p_subject,''))) not between 3 and 160 then raise exception 'Objet invalide'; end if;
  if length(btrim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Message invalide'; end if;
  if p_page_url is not null and length(p_page_url)>500 then raise exception 'Adresse de page trop longue'; end if;
  insert into public.support_tickets(tenant_owner_id,created_by,subject,page_url,status)
  values(tenant_id,auth.uid(),btrim(p_subject),nullif(btrim(p_page_url),''),'AWAITING_PLATFORM') returning id into ticket_id;
  insert into public.support_messages(ticket_id,tenant_owner_id,author_id,body)
  values(ticket_id,tenant_id,auth.uid(),btrim(p_body));
  return ticket_id;
end $$;

create or replace function public.send_support_message(p_ticket_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare ticket public.support_tickets%rowtype; message_id uuid; platform boolean;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(btrim(coalesce(p_body,''))) not between 1 and 5000 then raise exception 'Message invalide'; end if;
  select * into ticket from public.support_tickets where id=p_ticket_id for update;
  if not found or not public.can_read_support_ticket(ticket.tenant_owner_id,ticket.created_by) then
    raise exception 'Demande introuvable ou accès refusé';
  end if;
  platform:=public.is_platform_owner();
  insert into public.support_messages(ticket_id,tenant_owner_id,author_id,body)
  values(ticket.id,ticket.tenant_owner_id,auth.uid(),btrim(p_body)) returning id into message_id;
  update public.support_tickets set status=case when platform then 'REPLIED_BY_PLATFORM' else 'AWAITING_PLATFORM' end,
    updated_at=now() where id=ticket.id;
  return message_id;
end $$;

create or replace function public.close_support_ticket(p_ticket_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare ticket public.support_tickets%rowtype;
begin
  select * into ticket from public.support_tickets where id=p_ticket_id for update;
  if not found or not public.can_read_support_ticket(ticket.tenant_owner_id,ticket.created_by) then
    raise exception 'Demande introuvable ou accès refusé';
  end if;
  update public.support_tickets set status='CLOSED',updated_at=now() where id=ticket.id;
end $$;

revoke all on function public.create_support_ticket(text,text,text),public.send_support_message(uuid,text),public.close_support_ticket(uuid) from public;
grant execute on function public.create_support_ticket(text,text,text),public.send_support_message(uuid,text),public.close_support_ticket(uuid) to authenticated;

commit;
