-- Send an assignment SMS promptly, separately from the three due-date reminders.
-- The cron credential is stored in Supabase Vault as smartsell_task_cron_secret.
begin;

create table if not exists public.task_assignment_sms (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tenant_owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','CANCELLED')),
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text,
  error text,
  unique (task_id, profile_id)
);

create index if not exists idx_task_assignment_sms_pending
  on public.task_assignment_sms(status, scheduled_for) where status = 'PENDING';
alter table public.task_assignment_sms enable row level security;
revoke all on public.task_assignment_sms from anon, authenticated;

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
     and 'SMS' = any(coalesce(task_row.notification_channels, array[]::text[]))
     and task_row.status not in ('TERMINE','ANNULEE')
     and exists (select 1 from public.profiles p where p.id = recipient
       and p.tenant_owner_id = task_row.tenant_owner_id and p.active) then
    insert into public.task_assignment_sms(task_id, profile_id, tenant_owner_id)
    values (task_row.id, recipient, task_row.tenant_owner_id)
    on conflict (task_id, profile_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_queue_task_assignment_sms on public.tasks;
create trigger trg_queue_task_assignment_sms after insert or update of assignee_id
on public.tasks for each row execute function public.queue_task_assignment_sms();

drop trigger if exists trg_queue_task_assignee_sms on public.task_assignees;
create trigger trg_queue_task_assignee_sms after insert on public.task_assignees
for each row execute function public.queue_task_assignment_sms();

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'smartsell-task-reminders';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;

select cron.schedule('smartsell-task-reminders', '* * * * *', $cron$
  select net.http_post(
    url := 'https://insqsizvcbvgfysqlxte.supabase.co/functions/v1/task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
        where name = 'smartsell_task_cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
$cron$);

commit;
