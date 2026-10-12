begin;
select set_config('request.jwt.claims','{"sub":"82695991-e968-4765-917a-c4d83c846aaf","role":"authenticated"}',true);
set local role authenticated;
do $$declare k uuid:='9bc0338a-70c6-4d23-b0ab-b723d248777e';task_ids uuid[];post_ids uuid[];n int;begin
 select array_agg(id) into task_ids from tasks where project_id=k;
 select array_agg(id) into post_ids from editorial_items where project_id=k;
 delete from projects where id=k;
 get diagnostics n=row_count;if n<>1 then raise exception 'Owner deletion failed';end if;
 if (select count(*) from tasks where id=any(task_ids) and project_id is null)<>coalesce(cardinality(task_ids),0) then raise exception 'Tasks not preserved';end if;
 if (select count(*) from editorial_items where id=any(post_ids) and project_id is null)<>coalesce(cardinality(post_ids),0) then raise exception 'Editorial records not preserved';end if;
end$$;
select 'Owner deletion succeeds; tasks and editorial records preserved; transaction rolled back' as audit;
rollback;
