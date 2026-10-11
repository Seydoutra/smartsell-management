begin;
alter table calendar_connections add column if not exists inbound_enabled boolean not null default false;
grant select(inbound_enabled) on calendar_connections to authenticated;
create table if not exists calendar_task_links(
 task_id uuid not null references tasks(id) on delete cascade,
 profile_id uuid not null references profiles(id) on delete cascade,
 calendar_id text not null default 'primary',
 event_key uuid not null default gen_random_uuid(),event_id text,
 synced_revision bigint not null default -1,baseline jsonb not null default '{}',remote_etag text,
 suppressed boolean not null default false,conflict jsonb,error text,checked_at timestamptz,
 primary key(task_id,profile_id)
);
alter table calendar_task_links enable row level security;
revoke all on calendar_task_links from public,anon,authenticated;
grant all on calendar_task_links to service_role;
grant select on calendar_task_links to authenticated;
drop policy if exists own_calendar_links on calendar_task_links;
create policy own_calendar_links on calendar_task_links for select to authenticated
 using(profile_id=auth.uid() and action_allowed('planning.sync') and exists(select 1 from tasks t where t.id=task_id and t.tenant_owner_id=current_tenant_owner_id()));

create or replace function queue_link_calendar_deletion() returns trigger
 language plpgsql security definer set search_path=public,pg_temp as $$begin
 if old.event_id is not null then
  insert into calendar_event_deletions(task_id,profile_id,calendar_id,event_id)
  values(old.task_id,old.profile_id,old.calendar_id,old.event_id)
  on conflict(profile_id,calendar_id,event_id) do nothing;
 end if;
 return old;
end$$;
drop trigger if exists queue_link_calendar_deletion on calendar_task_links;
create trigger queue_link_calendar_deletion before delete on calendar_task_links
 for each row execute function queue_link_calendar_deletion();

create or replace function reconcile_task_calendar_targets(p_task uuid) returns void
 language plpgsql security definer set search_path=public,pg_temp as $$declare t tasks;begin
 select * into t from tasks where id=p_task;
 if not found then return;end if;
 if t.due_at is null or t.status in ('ANNULEE','TERMINE') then
  delete from calendar_task_links where task_id=p_task;return;
 end if;
 delete from calendar_task_links l where l.task_id=p_task and not exists(
  select 1 from profiles p where p.id=l.profile_id and p.active
   and coalesce(p.tenant_owner_id,p.id)=t.tenant_owner_id
   and not 'CLIENT'=any(coalesce(p.roles,array[p.role]))
   and (p.id=t.assignee_id or exists(select 1 from task_assignees a where a.task_id=p_task and a.profile_id=p.id)));
 insert into calendar_task_links(task_id,profile_id,calendar_id)
 select t.id,p.id,coalesce(c.calendar_id,'primary') from profiles p
 left join calendar_connections c on c.profile_id=p.id
 where p.active and coalesce(p.tenant_owner_id,p.id)=t.tenant_owner_id
 and not 'CLIENT'=any(coalesce(p.roles,array[p.role]))
 and (p.id=t.assignee_id or exists(select 1 from task_assignees a where a.task_id=p_task and a.profile_id=p.id))
 on conflict(task_id,profile_id) do nothing;
end$$;
create or replace function reconcile_calendar_targets_trigger() returns trigger
 language plpgsql security definer set search_path=public,pg_temp as $$begin
 if tg_table_name='tasks' then perform reconcile_task_calendar_targets(new.id);
 elsif tg_op='DELETE' then perform reconcile_task_calendar_targets(old.task_id);
 else perform reconcile_task_calendar_targets(new.task_id);end if;
 return coalesce(new,old);
end$$;
drop trigger if exists reconcile_calendar_task on tasks;
create trigger reconcile_calendar_task after insert or update on tasks
 for each row execute function reconcile_calendar_targets_trigger();
drop trigger if exists reconcile_calendar_assignees on task_assignees;
create trigger reconcile_calendar_assignees after insert or delete on task_assignees
 for each row execute function reconcile_calendar_targets_trigger();
-- Populate assignments without creating Google events during migration.
do $$declare r record;begin for r in select id from tasks where due_at is not null and status not in ('ANNULEE','TERMINE') loop
 perform reconcile_task_calendar_targets(r.id);end loop;end$$;
update calendar_task_links l set event_id=t.google_event_id,event_key=t.google_event_key,
 calendar_id=coalesce(t.google_event_calendar_id,'primary'),synced_revision=t.calendar_synced_revision,
 baseline=jsonb_build_object('title',t.title,'start',t.due_at)
 from tasks t where l.task_id=t.id and l.profile_id=t.google_event_profile_id and t.google_event_id is not null and l.event_id is null and l.synced_revision=-1;

create or replace function calendar_apply_remote(p_task uuid,p_profile uuid,p_revision bigint,
 p_etag text,p_title text,p_start timestamptz,p_deleted boolean default false) returns text
 language plpgsql security definer set search_path=public,pg_temp as $$
declare t tasks;l calendar_task_links;c calendar_connections;begin
 select * into t from tasks where id=p_task for update;
 if not found then return 'REMOVED';end if;
 select * into l from calendar_task_links where task_id=p_task and profile_id=p_profile for update;
 if not found or l.suppressed then return 'REMOVED';end if;
 if not exists(select 1 from profiles p where p.id=p_profile and p.active and coalesce(p.tenant_owner_id,p.id)=t.tenant_owner_id)
 or not (t.assignee_id=p_profile or exists(select 1 from task_assignees where task_id=p_task and profile_id=p_profile)) then return 'DENIED';end if;
 select * into c from calendar_connections where profile_id=p_profile and connected and sync_enabled;
 if not found or not member_action_allowed(p_profile,'planning.sync') then return 'DENIED';end if;
 if l.synced_revision<>p_revision then return 'STALE';end if;
 if p_deleted then
  update calendar_task_links set suppressed=true,conflict=null,error=null,checked_at=now() where task_id=p_task and profile_id=p_profile;
  return 'SUPPRESSED';
 end if;
 if not c.inbound_enabled then return 'OUTBOUND';end if;
 if p_title is null or length(trim(p_title))=0 or length(p_title)>500 or p_start is null then return 'INVALID';end if;
 if t.title=p_title and t.due_at=p_start then
  update calendar_task_links set remote_etag=p_etag,checked_at=now() where task_id=p_task and profile_id=p_profile;
  return 'UNCHANGED';
 end if;
 if not member_action_allowed(p_profile,'tasks.update') or t.calendar_revision<>p_revision or l.conflict is not null then
  update calendar_task_links set conflict=jsonb_build_object('title',p_title,'start',p_start,'etag',p_etag,'revision',t.calendar_revision),error=case when not member_action_allowed(p_profile,'tasks.update') then 'Modification de tâche non autorisée' else 'Changements simultanés : choisissez la version à conserver' end,checked_at=now()
   where task_id=p_task and profile_id=p_profile;
  return 'CONFLICT';
 end if;
 update tasks set title=p_title,due_at=p_start where id=p_task returning * into t;
 update calendar_task_links set synced_revision=t.calendar_revision,baseline=jsonb_build_object('title',t.title,'start',t.due_at),remote_etag=p_etag,conflict=null,error=null,checked_at=now() where task_id=p_task and profile_id=p_profile;
 return 'IMPORTED';
end$$;

create or replace function calendar_resolve_own_link(p_task uuid,p_choice text) returns void
 language plpgsql security definer set search_path=public,pg_temp as $$declare t tasks;l calendar_task_links;begin
 if not action_allowed('planning.sync') or not current_account_has_access() then raise exception 'Synchronisation non autorisée';end if;
 select * into t from tasks where id=p_task for update;
 if not found then raise exception 'Tâche indisponible';end if;
 select * into l from calendar_task_links where task_id=p_task and profile_id=auth.uid() for update;
 if not found or coalesce(t.tenant_owner_id,t.assignee_id)<>current_tenant_owner_id() then raise exception 'Accès refusé';end if;
 if p_choice='RESTORE' then
  if not l.suppressed then raise exception 'Événement non retiré';end if;
  update calendar_task_links set event_key=gen_random_uuid(),event_id=null,synced_revision=-1,baseline='{}',remote_etag=null,suppressed=false,conflict=null,error=null where task_id=p_task and profile_id=auth.uid();
 elsif p_choice in ('LOCAL','GOOGLE') then
  if l.conflict is null then raise exception 'Aucun conflit à résoudre';end if;
  if not action_allowed('tasks.update') then raise exception 'Modification de tâche non autorisée';end if;
  if (l.conflict->>'revision')::bigint<>t.calendar_revision then raise exception 'La tâche a changé. Actualisez avant de choisir une version';end if;
  if p_choice='GOOGLE' then update tasks set title=l.conflict->>'title',due_at=(l.conflict->>'start')::timestamptz where id=p_task returning * into t;end if;
  update calendar_task_links set synced_revision=case when p_choice='GOOGLE' then t.calendar_revision else -1 end,
   baseline=jsonb_build_object('title',t.title,'start',t.due_at),remote_etag=l.conflict->>'etag',conflict=null,error=null
   where task_id=p_task and profile_id=auth.uid();
 else raise exception 'Choix invalide';end if;
end$$;
revoke all on function queue_link_calendar_deletion(),reconcile_task_calendar_targets(uuid),reconcile_calendar_targets_trigger(),calendar_apply_remote(uuid,uuid,bigint,text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function calendar_apply_remote(uuid,uuid,bigint,text,text,timestamptz,boolean) to service_role;
revoke all on function calendar_resolve_own_link(uuid,text) from public,anon;
grant execute on function calendar_resolve_own_link(uuid,text) to authenticated;
create or replace function calendar_pending_links(p_profile uuid default null) returns jsonb
language sql security definer set search_path=public,pg_temp as $$
select coalesce(jsonb_agg(row_to_json(q)),'[]'::jsonb) from (
 select l.*,row_to_json(t) as task from calendar_task_links l join tasks t on t.id=l.task_id
 join calendar_connections c on c.profile_id=l.profile_id and c.connected and c.sync_enabled
 where not l.suppressed and (p_profile is null or l.profile_id=p_profile)
 and (t.due_at>now() or l.event_id is not null)
 order by l.checked_at nulls first limit 100
) q $$;
create or replace function calendar_ack_link(p_task uuid,p_profile uuid,p_key uuid,p_revision bigint,p_event text,p_etag text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$declare t tasks;l calendar_task_links;begin
 select * into t from tasks where id=p_task for update;
 select * into l from calendar_task_links where task_id=p_task and profile_id=p_profile for update;
 if t.id is null or l.task_id is null or l.event_key<>p_key then
 insert into calendar_event_deletions(task_id,profile_id,calendar_id,event_id) values(p_task,p_profile,coalesce(l.calendar_id,'primary'),p_event) on conflict(profile_id,calendar_id,event_id) do nothing;
 return false;end if;
 update calendar_task_links set event_id=p_event,remote_etag=p_etag,checked_at=now(),
 synced_revision=case when t.calendar_revision=p_revision then p_revision else synced_revision end,
 baseline=case when t.calendar_revision=p_revision then jsonb_build_object('title',t.title,'start',t.due_at) else baseline end,
 error=null where task_id=p_task and profile_id=p_profile;
 return t.calendar_revision=p_revision;
end$$;
revoke all on function calendar_pending_links(uuid),calendar_ack_link(uuid,uuid,uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function calendar_pending_links(uuid),calendar_ack_link(uuid,uuid,uuid,bigint,text,text) to service_role;
notify pgrst,'reload schema';
commit;
