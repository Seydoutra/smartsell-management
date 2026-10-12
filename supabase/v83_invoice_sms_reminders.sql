begin;
-- Existing invoices stay opt-in: no surprise backlog of messages at deployment.
alter table invoices add column if not exists sms_reminders_enabled boolean not null default false;
alter table invoices alter column sms_reminders_enabled set default true;
create or replace function guard_invoice_sms_setting() returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if tg_op='INSERT' then
  if auth.uid() is null or not action_allowed('invoices.send') then new.sms_reminders_enabled:=false;end if;
 elsif new.sms_reminders_enabled is distinct from old.sms_reminders_enabled and (auth.uid() is null or not action_allowed('invoices.send') or not action_allowed('invoices.update')) then raise exception 'Réglage des relances non autorisé';end if;
 return new;
end$$;
drop trigger if exists guard_invoice_sms_setting on invoices;
create trigger guard_invoice_sms_setting before insert or update on invoices for each row execute function guard_invoice_sms_setting();
create table if not exists invoice_sms_reminders(
 id uuid primary key default gen_random_uuid(),invoice_id uuid not null references invoices(id) on delete cascade,
 tenant_owner_id uuid not null references profiles(id),due_date date not null,step int not null check(step between 1 and 3),
 scheduled_for timestamptz not null,status text not null default 'PENDING' check(status in ('PENDING','SENDING','SENT','FAILED','CANCELLED')),
 sent_at timestamptz,provider_message_id text,error text,unique(invoice_id,due_date,step)
);
create index if not exists invoice_sms_due on invoice_sms_reminders(scheduled_for) where status='PENDING';
create table if not exists invoice_public_links(
 invoice_id uuid primary key references invoices(id) on delete cascade,token text unique not null default encode(gen_random_bytes(24),'hex'),
 active boolean not null default true
);
alter table invoice_sms_reminders enable row level security;
alter table invoice_public_links enable row level security;
revoke all on invoice_sms_reminders,invoice_public_links from public,anon,authenticated;
grant all on invoice_sms_reminders,invoice_public_links to service_role;
grant select on invoice_sms_reminders to authenticated;
drop policy if exists tenant_invoice_sms on invoice_sms_reminders;
create policy tenant_invoice_sms on invoice_sms_reminders for select to authenticated
 using(tenant_owner_id=current_tenant_owner_id() and action_allowed('invoices.view'));

create or replace function rebuild_invoice_sms() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare anchor date;days int;dates date[];d date;step_no int;paid numeric;begin
 select coalesce(sum(amount),0) into paid from payments where invoice_id=new.id and tenant_owner_id=new.tenant_owner_id;
 if not new.sms_reminders_enabled or new.due_date is null or new.total<=paid or new.total<=0 or new.status in ('BROUILLON','ANNULEE','ANNULE') then
 update invoice_sms_reminders set status='CANCELLED' where invoice_id=new.id and status='PENDING';
 if not new.sms_reminders_enabled then update invoice_public_links set active=false where invoice_id=new.id;end if;
 return new;end if;
 if tg_op='UPDATE' and new.due_date is not distinct from old.due_date and new.issue_date is not distinct from old.issue_date and new.sms_reminders_enabled=old.sms_reminders_enabled then return new;end if;
 update invoice_sms_reminders set status='CANCELLED' where invoice_id=new.id and status='PENDING';
 insert into invoice_public_links(invoice_id) values(new.id) on conflict(invoice_id) do update set active=true;
 anchor:=greatest(new.issue_date,(new.created_at at time zone 'Africa/Conakry')::date);
 days:=new.due_date-anchor;
 dates:=array[case when days>=14 then new.due_date-10 else anchor+greatest(0,floor(days*0.5)::int) end,
              case when days>=14 then new.due_date-3 else anchor+greatest(0,floor(days*0.8)::int) end,new.due_date+1];
 for step_no in 1..3 loop
 d:=dates[step_no];
 if d<(now() at time zone 'Africa/Conakry')::date or (step_no>1 and d=dates[step_no-1]) then continue;end if;
 insert into invoice_sms_reminders(invoice_id,tenant_owner_id,due_date,step,scheduled_for)
 values(new.id,new.tenant_owner_id,new.due_date,step_no,(d+time '09:00') at time zone 'Africa/Conakry')
 on conflict(invoice_id,due_date,step) do update set scheduled_for=excluded.scheduled_for,status='PENDING',error=null where invoice_sms_reminders.status='CANCELLED';
 end loop;
 return new;
end$$;
drop trigger if exists rebuild_invoice_sms on invoices;
create trigger rebuild_invoice_sms after insert or update on invoices for each row execute function rebuild_invoice_sms();

create or replace function set_invoice_sms_reminders(p_invoice uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if not current_account_has_access() or not action_allowed('invoices.update') or not action_allowed('invoices.send') then raise exception 'Relances non autorisées';end if;
 update invoices set sms_reminders_enabled=p_enabled where id=p_invoice and tenant_owner_id=current_tenant_owner_id();
 if not found then raise exception 'Facture introuvable';end if;
end$$;

-- Claim revalidates payment, current deadline and recipient immediately before dispatch.
create or replace function claim_invoice_sms(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r invoice_sms_reminders;i invoices;c clients;paid numeric;token_value text;begin
 select * into r from invoice_sms_reminders where id=p_id;
 if not found then return null;end if;
 select * into i from invoices where id=r.invoice_id for update;
 select * into r from invoice_sms_reminders where id=p_id for update;
 if r.status<>'PENDING' or r.scheduled_for>now() then return null;end if;
 select coalesce(sum(amount),0) into paid from payments where invoice_id=i.id and tenant_owner_id=i.tenant_owner_id;
 if i.id is null or not i.sms_reminders_enabled or i.due_date<>r.due_date or i.total<=paid or i.total<=0 or i.status in ('BROUILLON','ANNULEE','ANNULE') then
 update invoice_sms_reminders set status='CANCELLED' where id=p_id;return null;end if;
 select * into c from clients where id=i.client_id and tenant_owner_id=i.tenant_owner_id;
 if c.id is null or nullif(trim(c.phone),'') is null then
 update invoice_sms_reminders set status='FAILED',error='Téléphone du client manquant' where id=p_id;return null;end if;
 if exists(select 1 from client_contacts where client_id=c.id and is_primary and opted_out_at is not null) then
 update invoice_sms_reminders set status='CANCELLED',error='Contact principal désinscrit' where id=p_id;return null;end if;
 if exists(select 1 from invoice_sms_reminders where invoice_id=i.id and status in ('SENT','SENDING') and (coalesce(sent_at,scheduled_for) at time zone 'Africa/Conakry')::date=(now() at time zone 'Africa/Conakry')::date) then
 update invoice_sms_reminders set status='CANCELLED',error='Un rappel a déjà été traité aujourd’hui' where id=p_id;return null;end if;
 select token into token_value from invoice_public_links where invoice_id=i.id and active;
 if token_value is null then raise exception 'Lien public indisponible';end if;
 update invoice_sms_reminders set status='SENDING',sent_at=now() where id=p_id;
 return jsonb_build_object('invoice_id',i.id,'tenant_owner_id',i.tenant_owner_id,'number',i.number,'client_name',c.name,'phone',c.phone,'due_date',i.due_date,'remaining',i.total-paid,'currency',i.currency,'step',r.step,'token',token_value);
end$$;
revoke all on function guard_invoice_sms_setting(),rebuild_invoice_sms(),claim_invoice_sms(uuid) from public,anon,authenticated;
grant execute on function claim_invoice_sms(uuid) to service_role;
revoke all on function set_invoice_sms_reminders(uuid,boolean) from public,anon;
grant execute on function set_invoice_sms_reminders(uuid,boolean) to authenticated;
-- Reuse the existing Vault-backed cron authentication, never a key in source code.
do $$declare command text;begin
 select j.command into command from cron.job j where jobname='smartsell-task-reminders';
 if command is null then raise exception 'Cron sécurisé des rappels introuvable';end if;
 perform cron.schedule('smartsell-invoice-reminders','*/10 * * * *',replace(command,'task-reminders','invoice-reminders'));
end$$;
notify pgrst,'reload schema';
commit;
