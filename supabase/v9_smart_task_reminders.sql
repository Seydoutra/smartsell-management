-- SmartSell V9 — trois rappels intelligents par tâche et confirmation sécurisée.
create table if not exists public.task_reminder_schedule (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  step smallint not null check (step between 1 and 3),
  scheduled_for timestamptz not null,
  confirmation_token uuid not null default gen_random_uuid(),
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','CANCELLED')),
  sent_at timestamptz,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  unique(task_id, step),
  unique(confirmation_token)
);

alter table public.task_reminder_schedule enable row level security;
revoke all on public.task_reminder_schedule from anon, authenticated;
create index if not exists idx_task_reminder_schedule_due
  on public.task_reminder_schedule(status, scheduled_for)
  where status = 'PENDING';

create or replace function public.plan_task_reminders()
returns trigger language plpgsql security definer set search_path = public as $$
declare start_at timestamptz; duration_seconds double precision;
begin
  if new.status = 'TERMINE' or new.due_at is null or new.assignee_id is null then
    update public.task_reminder_schedule set status = 'CANCELLED'
     where task_id = new.id and status = 'PENDING';
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.due_at is not distinct from old.due_at
     and new.assignee_id is not distinct from old.assignee_id
     and new.status is not distinct from old.status then return new; end if;
  delete from public.task_reminder_schedule where task_id = new.id and status in ('PENDING','FAILED');
  start_at := greatest(coalesce(new.created_at, now()), now());
  duration_seconds := extract(epoch from (new.due_at - start_at));
  if duration_seconds <= 0 then return new; end if;
  insert into public.task_reminder_schedule(task_id, profile_id, step, scheduled_for)
  values
    (new.id, new.assignee_id, 1, start_at + (new.due_at - start_at) * 0.50),
    (new.id, new.assignee_id, 2, start_at + (new.due_at - start_at) * 0.80),
    (new.id, new.assignee_id, 3, start_at + (new.due_at - start_at) * 0.95)
  on conflict (task_id, step) do update
    set profile_id = excluded.profile_id, scheduled_for = excluded.scheduled_for,
        confirmation_token = gen_random_uuid(), status = 'PENDING', sent_at = null,
        provider_message_id = null, error = null;
  return new;
end;
$$;

drop trigger if exists trg_plan_task_reminders on public.tasks;
create trigger trg_plan_task_reminders
after insert or update of due_at, assignee_id, status on public.tasks
for each row execute function public.plan_task_reminders();

insert into public.task_reminder_schedule(task_id, profile_id, step, scheduled_for)
select t.id, t.assignee_id, s.step, now() + (t.due_at - now()) * s.fraction
from public.tasks t
cross join (values (1, 0.50::double precision), (2, 0.80), (3, 0.95)) as s(step, fraction)
where t.status <> 'TERMINE' and t.assignee_id is not null and t.due_at > now()
on conflict (task_id, step) do nothing;

-- Le planificateur appelle la fonction toutes les cinq minutes. La fonction
-- reste idempotente : chaque rappel ne peut être traité qu'une seule fois.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'smartsell-task-reminders';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;
select cron.schedule(
  'smartsell-task-reminders',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://insqsizvcbvgfysqlxte.supabase.co/functions/v1/task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := '{}'::jsonb
  );
  $cron$
);
