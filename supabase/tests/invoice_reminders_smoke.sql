begin;
do $$declare client_key uuid;invoice_key uuid;n int;claimed jsonb;begin
 perform set_config('request.jwt.claims','{"sub":"82695991-e968-4765-917a-c4d83c846aaf","role":"authenticated"}',true);
 insert into clients(name,phone,tenant_owner_id) values('TEST ROLLBACK Reminder','620000000','82695991-e968-4765-917a-c4d83c846aaf') returning id into client_key;
 insert into invoices(number,client_id,tenant_owner_id,issue_date,due_date,total) values('TEST-ROLLBACK-INVOICE-SMS',client_key,'82695991-e968-4765-917a-c4d83c846aaf',current_date,current_date+20,1000) returning id into invoice_key;
 select count(*) into n from invoice_sms_reminders where invoice_id=invoice_key and status='PENDING';
 if n<>3 then raise exception 'Expected three reminders, got %',n;end if;
 if not exists(select 1 from invoice_sms_reminders where invoice_id=invoice_key and step=1 and scheduled_for::date=current_date+10) then raise exception 'J-10 missing';end if;
 update invoice_sms_reminders set scheduled_for=now()-interval '1 minute' where invoice_id=invoice_key and step=1;
 claimed:=claim_invoice_sms((select id from invoice_sms_reminders where invoice_id=invoice_key and step=1));
 if claimed is null or claimed->>'number'<>'TEST-ROLLBACK-INVOICE-SMS' or (claimed->>'remaining')::numeric<>1000 then raise exception 'Claim missing number/balance';end if;
 if claim_invoice_sms((select id from invoice_sms_reminders where invoice_id=invoice_key and step=1)) is not null then raise exception 'Duplicate claim';end if;
 insert into payments(invoice_id,tenant_owner_id,amount,currency,method) values(invoice_key,'82695991-e968-4765-917a-c4d83c846aaf',1000,'GNF','ESPECES');
 if exists(select 1 from invoice_sms_reminders where invoice_id=invoice_key and status='PENDING') then raise exception 'Fully paid invoice still scheduled';end if;
 perform set_invoice_sms_reminders(invoice_key,false);
 if exists(select 1 from invoice_public_links where invoice_id=invoice_key and active) then raise exception 'Disabled public link still active';end if;
end$$;
select 'Invoice scheduling, claim deduplication, payment cancellation and public revocation PASSED (rollback)' as audit;
rollback;
