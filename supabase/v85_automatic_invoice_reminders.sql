begin;
-- Sending is an automatic invoice lifecycle operation, not a manual creator action.
-- Invoice creation remains protected by its existing tenant RLS and action rights.
create or replace function guard_invoice_sms_setting() returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if tg_op='INSERT' then new.sms_reminders_enabled:=true;
 elsif new.sms_reminders_enabled is distinct from old.sms_reminders_enabled and
  (auth.uid() is null or not action_allowed('invoices.send') or not action_allowed('invoices.update')) then
  raise exception 'Réglage des relances non autorisé';
 end if;
 return new;
end$$;

create or replace function rebuild_invoice_sms() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare anchor date;days int;dates date[];d date;step_no int;paid numeric;today date:=(now() at time zone 'Africa/Conakry')::date;begin
 select coalesce(sum(amount),0) into paid from payments where invoice_id=new.id and tenant_owner_id=new.tenant_owner_id;
 if not new.sms_reminders_enabled or new.due_date is null or new.total<=paid or new.total<=0 or new.status in ('BROUILLON','ANNULEE','ANNULE','PAYEE','CLOTUREE','CLOTURE') then
  update invoice_sms_reminders set status='CANCELLED' where invoice_id=new.id and status='PENDING';
  if not new.sms_reminders_enabled then update invoice_public_links set active=false where invoice_id=new.id;end if;
  return new;
 end if;
 if tg_op='UPDATE' and new.due_date is not distinct from old.due_date and new.issue_date is not distinct from old.issue_date and new.total is not distinct from old.total and new.sms_reminders_enabled=old.sms_reminders_enabled and old.status not in ('BROUILLON','ANNULEE','ANNULE','PAYEE','CLOTUREE','CLOTURE') then return new;end if;
 update invoice_sms_reminders set status='CANCELLED' where invoice_id=new.id and status='PENDING';
 insert into invoice_public_links(invoice_id) values(new.id) on conflict(invoice_id) do update set active=true;
 anchor:=greatest(new.issue_date,(new.created_at at time zone 'Africa/Conakry')::date);
 days:=new.due_date-anchor;
 if new.due_date<today then
  -- Restart an already overdue invoice without an immediate burst of three SMS.
  dates:=array[today+1,today+4,today+7];
 else
  dates:=array[case when days>=14 then new.due_date-10 else anchor+greatest(0,floor(days*0.5)::int) end,
               case when days>=14 then new.due_date-3 else anchor+greatest(0,floor(days*0.8)::int) end,new.due_date+1];
 end if;
 for step_no in 1..3 loop
  d:=dates[step_no];
  if d<today or (step_no>1 and d=dates[step_no-1]) then continue;end if;
  insert into invoice_sms_reminders(invoice_id,tenant_owner_id,due_date,step,scheduled_for)
  values(new.id,new.tenant_owner_id,new.due_date,step_no,(d+time '09:00') at time zone 'Africa/Conakry')
  on conflict(invoice_id,due_date,step) do update set scheduled_for=excluded.scheduled_for,status='PENDING',error=null where invoice_sms_reminders.status='CANCELLED';
 end loop;
 return new;
end$$;

-- The platform owner explicitly requested activation for his existing real invoices.
-- Do not mass-enable other subscribers' historical invoices or audit fixtures.
select set_config('request.jwt.claims','{"sub":"82695991-e968-4765-917a-c4d83c846aaf","role":"authenticated"}',true);
update invoices i set sms_reminders_enabled=true
where i.tenant_owner_id='82695991-e968-4765-917a-c4d83c846aaf'
 and not i.sms_reminders_enabled and i.due_date is not null
 and i.number not ilike 'TEST%' and i.status not in ('BROUILLON','ANNULEE','ANNULE','PAYEE','CLOTUREE','CLOTURE')
 and i.total>coalesce((select sum(p.amount) from payments p where p.invoice_id=i.id and p.tenant_owner_id=i.tenant_owner_id),0)
 and exists(select 1 from clients c where c.id=i.client_id and c.tenant_owner_id=i.tenant_owner_id and c.name not ilike 'TEST%' and c.name not ilike 'EXEMPLE%');
notify pgrst,'reload schema';
commit;
