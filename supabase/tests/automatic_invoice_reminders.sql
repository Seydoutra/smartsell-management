begin;
do $$declare c uuid;i uuid;n int;begin
 perform set_config('request.jwt.claims','{}',true);
 insert into clients(name,phone,tenant_owner_id) values('TEST rollback automatique','620000000','82695991-e968-4765-917a-c4d83c846aaf') returning id into c;
 insert into invoices(number,client_id,tenant_owner_id,issue_date,due_date,total,sms_reminders_enabled) values('TEST-ROLLBACK-AUTO',c,'82695991-e968-4765-917a-c4d83c846aaf',current_date,current_date+20,0,false) returning id into i;
 if not (select sms_reminders_enabled from invoices where id=i) then raise exception 'Auto activation missing';end if;
 update invoices set total=1000 where id=i;
 select count(*) into n from invoice_sms_reminders where invoice_id=i and status='PENDING';
 if n<>3 then raise exception 'Zero initial total lifecycle failed: %',n;end if;
 insert into payments(invoice_id,tenant_owner_id,amount,currency,method) values(i,'82695991-e968-4765-917a-c4d83c846aaf',400,'GNF','ESPECES');
 if (select count(*) from invoice_sms_reminders where invoice_id=i and status='PENDING')<>3 then raise exception 'Partial payment cancelled reminders';end if;
 insert into payments(invoice_id,tenant_owner_id,amount,currency,method) values(i,'82695991-e968-4765-917a-c4d83c846aaf',600,'GNF','ESPECES');
 if exists(select 1 from invoice_sms_reminders where invoice_id=i and status='PENDING') then raise exception 'Paid invoice still scheduled';end if;
end$$;
select 'Automatic creation, total recalculation, partial payment and paid cancellation PASSED (rollback)' as result;
rollback;
