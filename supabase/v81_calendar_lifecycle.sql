begin;
alter table public.tasks add column if not exists calendar_revision bigint not null default 0;
alter table public.tasks add column if not exists calendar_synced_revision bigint not null default -1;
alter table public.tasks add column if not exists google_event_profile_id uuid;
alter table public.tasks add column if not exists google_event_calendar_id text;
alter table public.tasks add column if not exists google_event_key uuid not null default gen_random_uuid();
update public.tasks t set google_event_profile_id=t.assignee_id,
 google_event_calendar_id=coalesce(c.calendar_id,'primary'),calendar_synced_revision=0
 from public.calendar_connections c
 where t.google_event_id is not null and t.google_event_profile_id is null and c.profile_id=t.assignee_id;

-- No task foreign key: deletion must not erase the pending Google deletion.
create table if not exists public.calendar_event_deletions(
 id uuid primary key default gen_random_uuid(),task_id uuid not null,
 profile_id uuid not null,calendar_id text not null,event_id text not null,
 created_at timestamptz not null default now(),completed_at timestamptz,error text,
 unique(profile_id,calendar_id,event_id)
);
alter table public.calendar_event_deletions enable row level security;
revoke all on public.calendar_event_deletions from public,anon,authenticated;
grant all on public.calendar_event_deletions to service_role;

create or replace function public.track_task_calendar_lifecycle()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare retire boolean;
begin
 if tg_op='INSERT' then
  new.google_event_id:=null;new.google_event_profile_id:=null;new.google_event_calendar_id:=null;
  new.google_event_key:=gen_random_uuid();new.calendar_revision:=0;new.calendar_synced_revision:=-1;
  return new;
 end if;
 if tg_op='DELETE' then retire:=true;
 else
  -- Synchronization metadata is server-owned, including through direct REST writes.
  if current_setting('request.jwt.claim.role',true)='authenticated' or
     coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role'='authenticated' then
   new.google_event_id:=old.google_event_id;
   new.google_event_profile_id:=old.google_event_profile_id;
   new.google_event_calendar_id:=old.google_event_calendar_id;
   new.google_event_key:=old.google_event_key;
   new.calendar_synced_revision:=old.calendar_synced_revision;
   new.calendar_synced_at:=old.calendar_synced_at;
  end if;
  new.calendar_revision:=old.calendar_revision;
  if (new.title,new.description,new.due_at,new.assignee_id,new.reminder_minutes,new.status)
     is not distinct from (old.title,old.description,old.due_at,old.assignee_id,old.reminder_minutes,old.status) then return new;end if;
  new.calendar_revision:=old.calendar_revision+1;
  retire:=new.assignee_id is distinct from old.assignee_id or new.due_at is null or new.status in ('ANNULEE','TERMINE');
 end if;
 if retire and old.google_event_id is not null then
  if old.google_event_profile_id is null then raise exception 'Profil de synchronisation Google manquant : vérification requise';end if;
  insert into public.calendar_event_deletions(task_id,profile_id,calendar_id,event_id)
   values(old.id,old.google_event_profile_id,coalesce(old.google_event_calendar_id,'primary'),old.google_event_id)
   on conflict(profile_id,calendar_id,event_id) do nothing;
 end if;
 if tg_op='DELETE' then return old;end if;
 if retire then
  new.google_event_id:=null;new.google_event_profile_id:=null;new.google_event_calendar_id:=null;
  new.google_event_key:=gen_random_uuid();new.calendar_synced_revision:=-1;
 end if;
 return new;
end$$;
revoke all on function public.track_task_calendar_lifecycle() from public,anon,authenticated;
drop trigger if exists track_task_calendar_lifecycle on public.tasks;
create trigger track_task_calendar_lifecycle before insert or update or delete on public.tasks
 for each row execute function public.track_task_calendar_lifecycle();
create or replace function public.pending_calendar_tasks() returns setof public.tasks
 language sql stable security definer set search_path=public,pg_temp as $$
 select t.* from public.tasks t where t.calendar_revision>t.calendar_synced_revision
 and t.assignee_id is not null and t.due_at is not null and t.status not in ('ANNULEE','TERMINE')
 and (t.google_event_id is not null or t.due_at>=now())
 order by t.calendar_synced_at nulls first,t.id limit 100
$$;
revoke all on function public.pending_calendar_tasks() from public,anon,authenticated;
grant execute on function public.pending_calendar_tasks() to service_role;
notify pgrst,'reload schema';
commit;
