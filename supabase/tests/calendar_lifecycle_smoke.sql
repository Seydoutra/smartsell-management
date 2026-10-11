begin;
do $$declare task_key uuid;event_key uuid;original_key uuid;rev bigint;begin
 insert into tasks(title,tenant_owner_id,assignee_id,due_at,notification_channels)
 values('TEST ROLLBACK Calendar lifecycle','82695991-e968-4765-917a-c4d83c846aaf','82695991-e968-4765-917a-c4d83c846aaf',now()+interval '7 days',array['IN_APP']) returning id,google_event_key into task_key,original_key;
 update tasks set google_event_id='sm'||replace(original_key::text,'-',''),google_event_profile_id=assignee_id,google_event_calendar_id='primary',calendar_synced_revision=0 where id=task_key;
 update tasks set title='TEST ROLLBACK Edited' where id=task_key;
 select calendar_revision into rev from tasks where id=task_key;
 if rev<>1 then raise exception 'Missing edit revision';end if;
 if exists(select 1 from calendar_event_deletions where task_id=task_key) then raise exception 'Text edit incorrectly queued a deletion';end if;
 update tasks set due_at=null where id=task_key;
 if not exists(select 1 from calendar_event_deletions where task_id=task_key) then raise exception 'Missing removal queue';end if;
 select google_event_key into event_key from tasks where id=task_key;
 if event_key=original_key then raise exception 'Retired Google ID reused';end if;
 if exists(select 1 from tasks where id=task_key and google_event_id is not null) then raise exception 'Retired event still attached';end if;
 delete from tasks where id=task_key;
 if not exists(select 1 from calendar_event_deletions where task_id=task_key) then raise exception 'Deletion queue lost after task deletion';end if;
end$$;
select 'Calendar lifecycle SQL assertions PASSED (rolled back)' as audit;
rollback;
