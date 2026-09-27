-- Notifications in-app déclenchées côté base lors d'une affectation.
-- SECURITY DEFINER permet à un créateur autorisé de notifier les autres profils
-- sans élargir la politique RLS de la table notifications.
create or replace function public.notify_project_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_id is not null and not exists (
    select 1 from public.notifications n
    where n.profile_id = new.profile_id
      and n.entity_type = 'project'
      and n.entity_id = new.project_id
      and n.read_at is null
  ) then
    insert into public.notifications(profile_id, channel, title, body, entity_type, entity_id)
    select new.profile_id, 'IN_APP', 'Nouveau projet assigné',
      coalesce(p.name, 'Un projet') || ' vous a été assigné.', 'project', new.project_id
    from public.projects p where p.id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_project_member_added on public.project_members;
create trigger trg_notify_project_member_added
after insert on public.project_members
for each row execute function public.notify_project_member_added();

create or replace function public.notify_task_assignee_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.profile_id is not null and not exists (
    select 1 from public.notifications n
    where n.profile_id = new.profile_id
      and n.entity_type = 'task'
      and n.entity_id = new.task_id
      and n.read_at is null
  ) then
    insert into public.notifications(profile_id, channel, title, body, entity_type, entity_id)
    select new.profile_id, 'IN_APP', 'Nouvelle tâche assignée',
      coalesce(t.title, 'Une tâche') || ' vous a été assignée.', 'task', new.task_id
    from public.tasks t where t.id = new.task_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_task_assignee_added on public.task_assignees;
create trigger trg_notify_task_assignee_added
after insert on public.task_assignees
for each row execute function public.notify_task_assignee_added();
