begin;
do $$declare k uuid;rev bigint;outcome text;begin
 perform set_config('request.jwt.claims','{"sub":"82695991-e968-4765-917a-c4d83c846aaf","role":"authenticated"}',true);
 insert into tasks(title,tenant_owner_id,assignee_id,due_at,notification_channels)
 values('TEST ROLLBACK Shared Calendar','82695991-e968-4765-917a-c4d83c846aaf','82695991-e968-4765-917a-c4d83c846aaf',now()+interval '7 days',array['IN_APP']) returning id into k;
 insert into task_assignees(task_id,profile_id) values(k,'7d990c48-2c8c-4a00-840c-2f6bb02bbde6');
 if (select count(*) from calendar_task_links where task_id=k)<>2 then raise exception 'Missing secondary assignee';end if;
 update calendar_connections set inbound_enabled=true where profile_id='82695991-e968-4765-917a-c4d83c846aaf';
 select calendar_revision into rev from tasks where id=k;
 update calendar_task_links set synced_revision=rev,baseline=jsonb_build_object('title','TEST ROLLBACK Shared Calendar','start',(select due_at from tasks where id=k)) where task_id=k;
 outcome:=calendar_apply_remote(k,'82695991-e968-4765-917a-c4d83c846aaf',rev,'etag','TEST ROLLBACK Remote',now()+interval '8 days',false);
 if outcome<>'IMPORTED' then raise exception 'Inbound import failed: %',outcome;end if;
 select calendar_revision into rev from tasks where id=k;
 update tasks set title='TEST ROLLBACK Concurrent local' where id=k;
 outcome:=calendar_apply_remote(k,'82695991-e968-4765-917a-c4d83c846aaf',rev,'etag2','TEST ROLLBACK Concurrent remote',now()+interval '9 days',false);
 if outcome<>'CONFLICT' then raise exception 'Conflict not detected: %',outcome;end if;
 outcome:=calendar_apply_remote(k,'82695991-e968-4765-917a-c4d83c846aaf',rev,null,null,null,true);
 if outcome<>'SUPPRESSED' or not exists(select 1 from tasks where id=k) then raise exception 'Google deletion changed shared task';end if;
 perform set_config('request.jwt.claims','{"sub":"82695991-e968-4765-917a-c4d83c846aaf","role":"authenticated"}',true);
 perform calendar_resolve_own_link(k,'RESTORE');
 if exists(select 1 from calendar_task_links where task_id=k and profile_id='82695991-e968-4765-917a-c4d83c846aaf' and suppressed) then raise exception 'Restore failed';end if;
 delete from task_assignees where task_id=k;
 if (select count(*) from calendar_task_links where task_id=k)<>1 then raise exception 'Retired assignee retained';end if;
 delete from tasks where id=k;
 if exists(select 1 from calendar_task_links where task_id=k) then raise exception 'Deleted task retained';end if;
end$$;
select 'Shared assignments, inbound import, conflict, deletion isolation, restore: PASSED (rollback)' as audit;
rollback;
