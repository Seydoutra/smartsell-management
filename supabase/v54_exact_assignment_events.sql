-- Une affectation se notifie une fois tant qu'elle reste active. Après retrait,
-- la même personne reçoit une nouvelle notification si elle est réaffectée,
-- même immédiatement : pas de fenêtre temporelle qui masque l'événement.
begin;

create table if not exists public.assignment_notification_state (
  entity_type text not null check(entity_type in ('task','project')),
  entity_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tenant_owner_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key(entity_type,entity_id,profile_id)
);
create index if not exists assignment_notification_state_tenant_idx
on public.assignment_notification_state(tenant_owner_id);
alter table public.assignment_notification_state enable row level security;
revoke all on public.assignment_notification_state from anon, authenticated;

-- Les affectations déjà existantes sont actives, sans émettre d'alertes rétroactives.
insert into public.assignment_notification_state(entity_type,entity_id,profile_id,tenant_owner_id)
select 'project',p.id,m.profile_id,p.tenant_owner_id
from public.project_members m join public.projects p on p.id=m.project_id
where p.tenant_owner_id is not null
on conflict do nothing;
insert into public.assignment_notification_state(entity_type,entity_id,profile_id,tenant_owner_id)
select 'project',p.id,p.manager_id,p.tenant_owner_id
from public.projects p where p.manager_id is not null and p.tenant_owner_id is not null
on conflict do nothing;
insert into public.assignment_notification_state(entity_type,entity_id,profile_id,tenant_owner_id)
select 'task',t.id,a.profile_id,t.tenant_owner_id
from public.task_assignees a join public.tasks t on t.id=a.task_id
where t.tenant_owner_id is not null
on conflict do nothing;
insert into public.assignment_notification_state(entity_type,entity_id,profile_id,tenant_owner_id)
select 'task',t.id,t.assignee_id,t.tenant_owner_id
from public.tasks t where t.assignee_id is not null and t.tenant_owner_id is not null
on conflict do nothing;

create or replace function public.create_assignment_notification(
  p_profile_id uuid, p_tenant_owner_id uuid, p_entity_type text,
  p_entity_id uuid, p_entity_label text
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare notification_title text; notification_body text;
begin
  if p_profile_id is null or p_tenant_owner_id is null or p_entity_id is null then return; end if;
  if p_entity_type not in ('task','project') then return; end if;
  if not exists(select 1 from public.profiles p where p.id=p_profile_id
    and p.tenant_owner_id=p_tenant_owner_id and p.active) then return; end if;

  insert into public.assignment_notification_state(entity_type,entity_id,profile_id,tenant_owner_id)
  values(p_entity_type,p_entity_id,p_profile_id,p_tenant_owner_id)
  on conflict do nothing;
  if not found then return; end if;

  notification_title := case p_entity_type when 'task' then 'Nouvelle tâche attribuée' else 'Projet attribué' end;
  notification_body := case p_entity_type
    when 'task' then 'La tâche « ' || coalesce(p_entity_label,'Tâche') || ' » vous a été attribuée. Connectez-vous pour découvrir votre mission.'
    else 'Vous avez été ajouté au projet « ' || coalesce(p_entity_label,'Projet') || ' ». Connectez-vous pour découvrir votre mission.' end;
  insert into public.notifications(profile_id,tenant_owner_id,channel,title,body,entity_type,entity_id)
  values(p_profile_id,p_tenant_owner_id,'IN_APP',notification_title,notification_body,p_entity_type,p_entity_id);
end $$;

create or replace function public.notify_primary_project_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if new.manager_id is not distinct from old.manager_id then return new; end if;
    if old.manager_id is not null and not exists(
      select 1 from public.project_members where project_id=new.id and profile_id=old.manager_id
    ) then
      delete from public.assignment_notification_state
      where entity_type='project' and entity_id=new.id and profile_id=old.manager_id;
    end if;
  end if;
  perform public.create_assignment_notification(new.manager_id,new.tenant_owner_id,'project',new.id,new.name);
  return new;
end $$;

create or replace function public.notify_primary_task_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if new.assignee_id is not distinct from old.assignee_id then return new; end if;
    if old.assignee_id is not null and not exists(
      select 1 from public.task_assignees where task_id=new.id and profile_id=old.assignee_id
    ) then
      delete from public.assignment_notification_state
      where entity_type='task' and entity_id=new.id and profile_id=old.assignee_id;
    end if;
  end if;
  perform public.create_assignment_notification(new.assignee_id,new.tenant_owner_id,'task',new.id,new.title);
  return new;
end $$;

create or replace function public.release_assignment_notification_state()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_table_name='project_members' then
    if not exists(select 1 from public.projects where id=old.project_id and manager_id=old.profile_id) then
      delete from public.assignment_notification_state
      where entity_type='project' and entity_id=old.project_id and profile_id=old.profile_id;
    end if;
  elsif tg_table_name='task_assignees' then
    if not exists(select 1 from public.tasks where id=old.task_id and assignee_id=old.profile_id) then
      delete from public.assignment_notification_state
      where entity_type='task' and entity_id=old.task_id and profile_id=old.profile_id;
    end if;
  end if;
  return old;
end $$;

drop trigger if exists trg_release_project_assignment_state on public.project_members;
create trigger trg_release_project_assignment_state after delete
on public.project_members for each row execute function public.release_assignment_notification_state();
drop trigger if exists trg_release_task_assignment_state on public.task_assignees;
create trigger trg_release_task_assignment_state after delete
on public.task_assignees for each row execute function public.release_assignment_notification_state();

-- Une nouvelle notification dans la transaction signale une vraie réaffectation.
-- Le deuxième trigger de la même affectation ne remet donc pas le SMS en file.
create or replace function public.queue_project_assignment_sms()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare project_row public.projects%rowtype; recipient uuid;
begin
  if tg_table_name='projects' then
    project_row:=new; recipient:=new.manager_id;
    if tg_op='UPDATE' and new.manager_id is not distinct from old.manager_id then return new; end if;
  else
    select * into project_row from public.projects where id=new.project_id;
    recipient:=new.profile_id;
  end if;
  if recipient is not null and project_row.tenant_owner_id is not null
    and exists(select 1 from public.profiles p where p.id=recipient
      and p.tenant_owner_id=project_row.tenant_owner_id and p.active) then
    insert into public.project_assignment_sms(project_id,profile_id,tenant_owner_id)
    values(project_row.id,recipient,project_row.tenant_owner_id)
    on conflict(project_id,profile_id) do update
    set status='PENDING',scheduled_for=now(),sent_at=null,provider_message_id=null,error=null
    where public.project_assignment_sms.status <> 'PENDING'
      and exists(select 1 from public.notifications n
        where n.profile_id=recipient and n.entity_type='project' and n.entity_id=project_row.id
          and n.title='Projet attribué' and n.created_at=now());
  end if;
  return new;
end $$;

create or replace function public.queue_task_assignment_sms()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare task_row public.tasks%rowtype; recipient uuid;
begin
  if tg_table_name='tasks' then
    task_row:=new; recipient:=new.assignee_id;
    if tg_op='UPDATE' and new.assignee_id is not distinct from old.assignee_id then return new; end if;
  else
    select * into task_row from public.tasks where id=new.task_id;
    recipient:=new.profile_id;
  end if;
  if recipient is not null and task_row.tenant_owner_id is not null
    and 'SMS'=any(coalesce(task_row.notification_channels,array[]::text[]))
    and task_row.status not in ('TERMINE','ANNULEE')
    and exists(select 1 from public.profiles p where p.id=recipient
      and p.tenant_owner_id=task_row.tenant_owner_id and p.active) then
    insert into public.task_assignment_sms(task_id,profile_id,tenant_owner_id)
    values(task_row.id,recipient,task_row.tenant_owner_id)
    on conflict(task_id,profile_id) do update
    set status='PENDING',scheduled_for=now(),sent_at=null,provider_message_id=null,error=null
    where public.task_assignment_sms.status <> 'PENDING'
      and exists(select 1 from public.notifications n
        where n.profile_id=recipient and n.entity_type='task' and n.entity_id=task_row.id
          and n.title='Nouvelle tâche attribuée' and n.created_at=now());
  end if;
  return new;
end $$;

revoke all on function public.create_assignment_notification(uuid,uuid,text,uuid,text)
from public,anon,authenticated;
commit;
