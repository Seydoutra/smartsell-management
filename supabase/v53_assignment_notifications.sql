-- Une notification personnelle par nouvelle affectation, sans doublons entre
-- responsable principal et table des collaborateurs associés.
begin;

drop trigger if exists trg_notify_project_member_added on public.project_members;
drop trigger if exists trg_notify_task_assignee_added on public.task_assignees;

create or replace function public.create_assignment_notification(
  p_profile_id uuid, p_tenant_owner_id uuid, p_entity_type text,
  p_entity_id uuid, p_entity_label text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare notification_title text; notification_body text;
begin
  if p_profile_id is null or p_tenant_owner_id is null or p_entity_id is null then return; end if;
  if p_entity_type not in ('task', 'project') then return; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p.tenant_owner_id = p_tenant_owner_id and p.active
  ) then return; end if;

  notification_title := case p_entity_type when 'task' then 'Nouvelle tâche attribuée' else 'Projet attribué' end;
  notification_body := case p_entity_type
    when 'task' then 'La tâche « ' || coalesce(p_entity_label, 'Tâche') || ' » vous a été attribuée. Connectez-vous pour découvrir votre mission.'
    else 'Vous avez été ajouté au projet « ' || coalesce(p_entity_label, 'Projet') || ' ». Connectez-vous pour découvrir votre mission.' end;

  -- Deux triggers peuvent se déclencher pendant une même affectation.
  -- Le verrou sérialise ce contrôle sans bloquer les autres collaborateurs.
  perform pg_advisory_xact_lock(hashtext(p_profile_id::text || p_entity_type), hashtext(p_entity_id::text));
  if not exists (
    select 1 from public.notifications n
    where n.profile_id = p_profile_id and n.tenant_owner_id = p_tenant_owner_id
      and n.entity_type = p_entity_type and n.entity_id = p_entity_id
      and n.title = notification_title and n.created_at > now() - interval '10 seconds'
  ) then
    insert into public.notifications(profile_id, tenant_owner_id, channel, title, body, entity_type, entity_id)
    values(p_profile_id, p_tenant_owner_id, 'IN_APP', notification_title, notification_body, p_entity_type, p_entity_id);
  end if;
end $$;

create or replace function public.notify_project_member_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare project_row public.projects%rowtype;
begin
  select * into project_row from public.projects where id = new.project_id;
  perform public.create_assignment_notification(new.profile_id, project_row.tenant_owner_id, 'project', new.project_id, project_row.name);
  return new;
end $$;

create or replace function public.notify_primary_project_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.manager_id is not distinct from old.manager_id then return new; end if;
  perform public.create_assignment_notification(new.manager_id, new.tenant_owner_id, 'project', new.id, new.name);
  return new;
end $$;

create or replace function public.notify_task_assignee()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare task_row public.tasks%rowtype;
begin
  select * into task_row from public.tasks where id = new.task_id;
  perform public.create_assignment_notification(new.profile_id, task_row.tenant_owner_id, 'task', new.task_id, task_row.title);
  return new;
end $$;

create or replace function public.notify_primary_task_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then return new; end if;
  perform public.create_assignment_notification(new.assignee_id, new.tenant_owner_id, 'task', new.id, new.title);
  return new;
end $$;

drop trigger if exists trg_notify_primary_project on public.projects;
create trigger trg_notify_primary_project after insert or update of manager_id
on public.projects for each row execute function public.notify_primary_project_assignment();

-- Le SMS permet de prévenir également un collaborateur qui n'a pas l'application ouverte.
create table if not exists public.project_assignment_sms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tenant_owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check(status in ('PENDING','SENT','FAILED','CANCELLED')),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  error text,
  unique(project_id,profile_id)
);
create index if not exists idx_project_assignment_sms_pending
on public.project_assignment_sms(status,scheduled_for) where status = 'PENDING';
alter table public.project_assignment_sms enable row level security;
revoke all on public.project_assignment_sms from anon, authenticated;

create or replace function public.queue_project_assignment_sms()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare project_row public.projects%rowtype; recipient uuid;
begin
  if tg_table_name = 'projects' then
    project_row := new;
    recipient := new.manager_id;
    if tg_op = 'UPDATE' and new.manager_id is not distinct from old.manager_id then return new; end if;
  else
    select * into project_row from public.projects where id = new.project_id;
    recipient := new.profile_id;
  end if;
  if recipient is not null and project_row.tenant_owner_id is not null
     and exists(select 1 from public.profiles p where p.id=recipient
       and p.tenant_owner_id=project_row.tenant_owner_id and p.active) then
    insert into public.project_assignment_sms(project_id,profile_id,tenant_owner_id)
    values(project_row.id,recipient,project_row.tenant_owner_id)
    on conflict(project_id,profile_id) do update
    set status='PENDING',scheduled_for=now(),sent_at=null,provider_message_id=null,error=null
    where public.project_assignment_sms.status <> 'PENDING'
      and public.project_assignment_sms.scheduled_for < now() - interval '10 seconds';
  end if;
  return new;
end $$;

drop trigger if exists trg_queue_project_assignment_sms on public.projects;
create trigger trg_queue_project_assignment_sms after insert or update of manager_id
on public.projects for each row execute function public.queue_project_assignment_sms();
drop trigger if exists trg_queue_project_member_sms on public.project_members;
create trigger trg_queue_project_member_sms after insert
on public.project_members for each row execute function public.queue_project_assignment_sms();

-- Une réattribution d'une tâche déjà notifiée réactive le SMS d'affectation.
create or replace function public.queue_task_assignment_sms()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare task_row public.tasks%rowtype; recipient uuid;
begin
  if tg_table_name = 'tasks' then
    task_row := new;
    recipient := new.assignee_id;
    if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then return new; end if;
  else
    select * into task_row from public.tasks where id = new.task_id;
    recipient := new.profile_id;
  end if;
  if recipient is not null and task_row.tenant_owner_id is not null
     and 'SMS' = any(coalesce(task_row.notification_channels,array[]::text[]))
     and task_row.status not in ('TERMINE','ANNULEE')
     and exists(select 1 from public.profiles p where p.id=recipient
       and p.tenant_owner_id=task_row.tenant_owner_id and p.active) then
    insert into public.task_assignment_sms(task_id,profile_id,tenant_owner_id)
    values(task_row.id,recipient,task_row.tenant_owner_id)
    on conflict(task_id,profile_id) do update
    set status='PENDING',scheduled_for=now(),sent_at=null,provider_message_id=null,error=null
    where public.task_assignment_sms.status <> 'PENDING'
      and public.task_assignment_sms.scheduled_for < now() - interval '10 seconds';
  end if;
  return new;
end $$;

-- Une fonction SECURITY DEFINER ne doit pas devenir un RPC librement appelable.
revoke all on function public.create_assignment_notification(uuid, uuid, text, uuid, text)
from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

commit;
