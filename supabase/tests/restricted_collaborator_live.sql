-- Real production role/policies; every fixture and attempted change is rolled back.
begin;
select set_config('request.jwt.claims','{"sub":"7d990c48-2c8c-4a00-840c-2f6bb02bbde6","role":"authenticated"}',true);
set local role authenticated;
do $$declare count_rows integer;blocked boolean:=false;begin
 if auth.uid()<>'7d990c48-2c8c-4a00-840c-2f6bb02bbde6'::uuid then raise exception 'Wrong audit identity';end if;
 if not action_allowed('clients.view') then raise exception 'Expected client reading right';end if;
 if action_allowed('clients.delete') or action_allowed('invoices.view') or action_allowed('accounting.view') then raise exception 'Restricted action unexpectedly allowed';end if;
 select count(*) into count_rows from clients where tenant_owner_id<>'82695991-e968-4765-917a-c4d83c846aaf';
 if count_rows<>0 then raise exception 'Cross-tenant client disclosure';end if;
 select count(*) into count_rows from invoices;
 if count_rows<>0 then raise exception 'Invoice disclosure';end if;
 select count(*) into count_rows from expenses;
 if count_rows<>0 then raise exception 'Expense disclosure';end if;
 delete from clients where tenant_owner_id='82695991-e968-4765-917a-c4d83c846aaf';
 get diagnostics count_rows=row_count;
 if count_rows<>0 then raise exception 'Client deletion was not blocked';end if;
 begin
  update user_access_controls set denied_permissions='{}' where profile_id=auth.uid();
 exception when insufficient_privilege then blocked:=true;
 end;
 if not blocked then raise exception 'Direct self-elevation not rejected';end if;
end$$;
select jsonb_build_object('restricted_identity',auth.uid(),'read_clients',action_allowed('clients.view'),'delete_clients',action_allowed('clients.delete'),'read_invoices',action_allowed('invoices.view'),'read_accounting',action_allowed('accounting.view'),'rls_assertions','PASSED') as audit;
rollback;
