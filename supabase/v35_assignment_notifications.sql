-- V35 — notifications d'attribution, isolées par espace client.
-- Les insertions passent par des triggers SECURITY DEFINER afin que le
-- créateur puisse notifier un autre collaborateur sans élargir ses droits RLS.
begin;

create or replace function public.notify_project_member_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare project_name text; owner_id uuid;
begin
  select p.name, p.tenant_owner_id into project_name, owner_id
  from public.projects p where p.id = new.project_id;
  insert into public.notifications(profile_id, tenant_owner_id, channel, title, body, entity_type, entity_id)
  select new.profile_id, owner_id, 'IN_APP', 'Projet attribué',
    'Vous avez été ajouté au projet « ' || coalesce(project_name, 'Projet') || ' ».', 'project', new.project_id
  where not exists (
    select 1 from public.notifications n where n.profile_id = new.profile_id
      and n.entity_type = 'project' and n.entity_id = new.project_id
      and n.title = 'Projet attribué'
  );
  return new;
end $$;

create or replace function public.notify_task_assignee()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare task_title text; owner_id uuid;
begin
  if new.profile_id is null then return new; end if;
  select t.title, t.tenant_owner_id into task_title, owner_id from public.tasks t where t.id = new.task_id;
  insert into public.notifications(profile_id, tenant_owner_id, channel, title, body, entity_type, entity_id)
  select new.profile_id, owner_id, 'IN_APP', 'Nouvelle tâche attribuée',
    'La tâche « ' || coalesce(task_title, 'Tâche') || ' » vous a été attribuée.', 'task', new.task_id
  where not exists (
    select 1 from public.notifications n where n.profile_id = new.profile_id
      and n.entity_type = 'task' and n.entity_id = new.task_id
      and n.title = 'Nouvelle tâche attribuée'
  );
  return new;
end $$;

create or replace function public.notify_primary_task_assignment()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.assignee_id is null then return new; end if;
  insert into public.notifications(profile_id, tenant_owner_id, channel, title, body, entity_type, entity_id)
  select new.assignee_id, new.tenant_owner_id, 'IN_APP', 'Nouvelle tâche attribuée',
    'La tâche « ' || coalesce(new.title, 'Tâche') || ' » vous a été attribuée.', 'task', new.id
  where not exists (
    select 1 from public.notifications n where n.profile_id = new.assignee_id
      and n.entity_type = 'task' and n.entity_id = new.id
      and n.title = 'Nouvelle tâche attribuée'
  );
  return new;
end $$;

drop trigger if exists trg_notify_project_member_assignment on public.project_members;
create trigger trg_notify_project_member_assignment
after insert on public.project_members for each row
execute function public.notify_project_member_assignment();

drop trigger if exists trg_notify_task_assignee on public.task_assignees;
create trigger trg_notify_task_assignee
after insert on public.task_assignees for each row
execute function public.notify_task_assignee();

drop trigger if exists trg_notify_primary_task on public.tasks;
create trigger trg_notify_primary_task
after insert or update of assignee_id on public.tasks for each row
execute function public.notify_primary_task_assignment();

commit;
