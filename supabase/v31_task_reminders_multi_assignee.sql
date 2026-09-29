-- V31 — fiabilisation des rappels SMS pour toutes les personnes assignées.
-- À exécuter après v9 dans Supabase SQL Editor.

alter table public.task_reminder_schedule
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

alter table public.task_reminder_schedule
  drop constraint if exists task_reminder_schedule_task_id_step_key;

create unique index if not exists uq_task_reminder_schedule_task_step_profile
  on public.task_reminder_schedule(task_id, step, profile_id);

create or replace function public.rebuild_task_reminders(p_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tasks%rowtype; start_at timestamptz; duration_seconds double precision;
begin
  select * into t from public.tasks where id = p_task_id;
  if t.id is null then return; end if;
  if t.status = 'TERMINE' or t.due_at is null or t.due_at <= now() then
    update public.task_reminder_schedule set status = 'CANCELLED'
      where task_id = t.id and status = 'PENDING';
    return;
  end if;
  delete from public.task_reminder_schedule where task_id = t.id and status in ('PENDING','FAILED');
  start_at := greatest(coalesce(t.created_at, now()), now());
  duration_seconds := extract(epoch from (t.due_at - start_at));
  if duration_seconds <= 0 then return; end if;
  insert into public.task_reminder_schedule(task_id, profile_id, step, scheduled_for)
  select t.id, assignee.profile_id, schedule.step,
    start_at + (t.due_at - start_at) * schedule.fraction
  from (
    select t.assignee_id as profile_id where t.assignee_id is not null
    union
    select ta.profile_id from public.task_assignees ta where ta.task_id = t.id
  ) assignee
  cross join (values (1, 0.50::double precision), (2, 0.80), (3, 0.95)) schedule(step, fraction)
  on conflict (task_id, step, profile_id) do update
    set scheduled_for = excluded.scheduled_for, confirmation_token = gen_random_uuid(),
        status = 'PENDING', sent_at = null, provider_message_id = null, error = null;
end;
$$;

create or replace function public.plan_task_reminders()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.rebuild_task_reminders(new.id); return new; end;
$$;

create or replace function public.plan_task_reminders_from_assignee()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.rebuild_task_reminders(coalesce(new.task_id, old.task_id)); return coalesce(new, old); end;
$$;

drop trigger if exists trg_plan_task_reminders_from_assignee on public.task_assignees;
create trigger trg_plan_task_reminders_from_assignee
after insert or update or delete on public.task_assignees
for each row execute function public.plan_task_reminders_from_assignee();

update public.tasks set due_at = due_at where due_at > now() and status <> 'TERMINE';
