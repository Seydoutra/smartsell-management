-- Additive stock accounting. Existing rows represent one physical unit until corrected by their owner.
begin;
create sequence if not exists public.equipment_reference_seq;
alter table public.equipment add column if not exists reference text;
alter table public.equipment add column if not exists quantity integer not null default 1 check(quantity>0);
alter table public.equipment add column if not exists quantity_in_use integer not null default 0 check(quantity_in_use>=0);
alter table public.equipment add column if not exists quantity_unavailable integer not null default 0 check(quantity_unavailable>=0);
alter table public.equipment_request_items add column if not exists quantity integer not null default 1 check(quantity>0);
alter table public.equipment_movements add column if not exists quantity integer not null default 1 check(quantity>0);
-- Only initialize previously unreferenced rows; never duplicate existing movements.
select set_config('smartsell.equipment_request_write','yes',true);
update public.equipment set reference='EQ-'||lpad(nextval('public.equipment_reference_seq')::text,8,'0'),
 quantity_in_use=case when status='EN_MISSION' then 1 else 0 end,
 quantity_unavailable=case when status in ('MAINTENANCE','HORS_SERVICE') then 1 else 0 end
where reference is null;
create unique index if not exists equipment_reference_unique on public.equipment(reference);
alter table public.equipment alter column reference set not null;
drop index if exists public.equipment_one_reservation;

create or replace function public.equipment_free_quantity(p_equipment uuid) returns integer
language sql stable security definer set search_path=public,pg_temp as $$
 select greatest(0,e.quantity-e.quantity_in_use-e.quantity_unavailable-coalesce((
 select sum(i.quantity)::int from public.equipment_request_items i join public.equipment_requests r on r.id=i.request_id
 where i.equipment_id=e.id and i.reserved and r.status='APPROUVEE'),0))
 from public.equipment e where e.id=p_equipment and e.tenant_owner_id=public.current_tenant_owner_id()
$$;

create or replace function public.equipment_stock_guard() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_reserved integer;
begin
 if tg_op='INSERT' then
  new.reference:='EQ-'||lpad(nextval('public.equipment_reference_seq')::text,8,'0');
  if nullif(trim(new.code),'') is null then new.code:=new.reference;end if;
  new.quantity_in_use:=0;
  new.quantity_unavailable:=case when new.status in ('MAINTENANCE','HORS_SERVICE') then new.quantity else 0 end;
 else
  if new.reference is distinct from old.reference then raise exception 'Référence automatique non modifiable';end if;
  if current_setting('smartsell.equipment_request_write',true) is distinct from 'yes' then
   if new.quantity_in_use is distinct from old.quantity_in_use or new.quantity_unavailable is distinct from old.quantity_unavailable then raise exception 'Stock calculé automatiquement par les bons';end if;
   select coalesce(sum(i.quantity),0)::int into v_reserved from public.equipment_request_items i join public.equipment_requests r on r.id=i.request_id
   where i.equipment_id=old.id and i.reserved and r.status='APPROUVEE';
   if new.quantity<old.quantity_in_use+old.quantity_unavailable+v_reserved then raise exception 'Quantité inférieure aux unités sorties, réservées ou indisponibles';end if;
   if new.status is distinct from old.status and (old.quantity_in_use>0 or v_reserved>0) then raise exception 'Statut calculé par les bons actifs';end if;
   if new.status is distinct from old.status then
    new.quantity_unavailable:=case when new.status in ('MAINTENANCE','HORS_SERVICE') then new.quantity else 0 end;
   end if;
  end if;
 end if;
 if new.quantity_in_use+new.quantity_unavailable>new.quantity then raise exception 'Stock incohérent';end if;
 return new;
end $$;
drop trigger if exists equipment_stock_guard on public.equipment;
create trigger equipment_stock_guard before insert or update on public.equipment for each row execute function public.equipment_stock_guard();

create or replace function public.list_equipment_stock() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_tenant uuid:=public.equipment_request_actor();v_result jsonb;
begin
 if not public.action_allowed('equipment.view') then raise exception 'Permission denied';end if;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('available_quantity',public.equipment_free_quantity(e.id)) order by e.name),'[]'::jsonb)
 into v_result from public.equipment e where e.tenant_owner_id=v_tenant;
 return v_result;
end $$;

create or replace function public.submit_equipment_request_quantities(p_reason text,p_destination text,p_return_at timestamptz,p_items jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tenant uuid:=public.equipment_request_actor();v_id uuid;v_item jsonb;v_equipment public.equipment;v_qty integer;
begin
 if not public.equipment_request_can_submit() then raise exception 'Droit de demande de matériel retiré';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50
 or (select count(distinct x->>'equipment_id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'Sélectionnez entre 1 et 50 matériels distincts';end if;
 if p_return_at is null or p_return_at<=now() then raise exception 'Date de retour future requise';end if;
 insert into public.equipment_requests(tenant_owner_id,requested_by,requester_name,reason,destination,expected_return_at)
 values(v_tenant,auth.uid(),(select full_name from public.profiles where id=auth.uid()),trim(p_reason),trim(p_destination),p_return_at) returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) order by value->>'equipment_id' loop
  v_qty:=(v_item->>'quantity')::integer;
  select * into v_equipment from public.equipment where id=(v_item->>'equipment_id')::uuid and tenant_owner_id=v_tenant for update;
  if not found then raise exception 'Matériel introuvable dans votre entreprise';end if;
  if v_qty is null or v_qty<1 or v_qty>public.equipment_free_quantity(v_equipment.id) then raise exception 'Quantité indisponible : %',v_equipment.name;end if;
  insert into public.equipment_request_items(request_id,tenant_owner_id,equipment_id,equipment_name,equipment_code,quantity)
  values(v_id,v_tenant,v_equipment.id,v_equipment.name,v_equipment.reference,v_qty);
 end loop;
 perform public.equipment_request_notify(v_id,'Demande de bon de sortie','Une demande de matériel attend votre décision. Consultez Demandes matériel.');
 insert into public.activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id) values(v_tenant,auth.uid(),'Demande de sortie','equipment_request',v_id);
 return v_id;
end $$;
-- Old clients keep the same API, requesting one unit per reference.
create or replace function public.submit_equipment_request(p_reason text,p_destination text,p_return_at timestamptz,p_equipment uuid[]) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$begin
 return public.submit_equipment_request_quantities(p_reason,p_destination,p_return_at,
 (select jsonb_agg(jsonb_build_object('equipment_id',x,'quantity',1)) from unnest(p_equipment) x));
end $$;

-- Upgrade the already-tested approval, handover, return and workspace functions in place.
do $upgrade$
declare v_sql text;
begin
 select pg_get_functiondef('public.decide_equipment_request(uuid,boolean,text)'::regprocedure) into v_sql;
 v_sql:=replace(v_sql,'select e.* from public.equipment e join','select e.*,i.quantity as requested_quantity from public.equipment e join');
 v_sql:=replace(v_sql,'item.status<>''DISPONIBLE'' or exists(select 1 from public.equipment_request_items where equipment_id=item.id and reserved)',
 'item.requested_quantity>public.equipment_free_quantity(item.id)');
 execute v_sql;
 select pg_get_functiondef('public.checkout_equipment_request(uuid,jsonb)'::regprocedure) into v_sql;
 v_sql:=replace(v_sql,'item.status<>''DISPONIBLE'' or not item.reserved','not item.reserved');
 v_sql:=replace(v_sql,'set status=''EN_MISSION'',condition=v_condition_notes',
 'set quantity_in_use=quantity_in_use+item.quantity,status=case when quantity-quantity_in_use-item.quantity-quantity_unavailable>0 then ''DISPONIBLE'' else ''EN_MISSION'' end,condition=v_condition_notes');
 v_sql:=replace(v_sql,'handled_by,condition_notes,reason)','handled_by,condition_notes,reason,quantity)');
 v_sql:=replace(v_sql,''' · ''||r.reason);',''' · ''||r.reason,item.quantity);');
 if position('quantity_in_use=quantity_in_use+item.quantity' in v_sql)=0 then raise exception 'Définition de remise incompatible : migration arrêtée';end if;
 execute v_sql;
 select pg_get_functiondef('public.return_equipment_request(uuid,jsonb)'::regprocedure) into v_sql;
 v_sql:=replace(v_sql,'set status=case state when ''CONFORME'' then ''DISPONIBLE'' when ''DEGRADE'' then ''MAINTENANCE'' else ''HORS_SERVICE'' end,condition=v_condition_notes',
 'set quantity_in_use=quantity_in_use-item.quantity,quantity_unavailable=quantity_unavailable+case when state=''CONFORME'' then 0 else item.quantity end,status=case when quantity-quantity_in_use+item.quantity-quantity_unavailable-case when state=''CONFORME'' then 0 else item.quantity end>0 then ''DISPONIBLE'' when quantity_in_use-item.quantity>0 then ''EN_MISSION'' when state=''DEGRADE'' then ''MAINTENANCE'' else ''HORS_SERVICE'' end,condition=v_condition_notes');
 v_sql:=replace(v_sql,'handled_by,condition_notes,reason)','handled_by,condition_notes,reason,quantity)');
 v_sql:=replace(v_sql,''' · ''||state);',''' · ''||state,item.quantity);');
 if position('quantity_in_use=quantity_in_use-item.quantity' in v_sql)=0 then raise exception 'Définition de retour incompatible : migration arrêtée';end if;
 execute v_sql;
 select pg_get_functiondef('public.equipment_request_workspace()'::regprocedure) into v_sql;
 v_sql:=replace(v_sql,'''code'',e.code','''code'',e.reference,''quantity'',e.quantity,''available_quantity'',public.equipment_free_quantity(e.id)');
 v_sql:=replace(v_sql,'e.status=''DISPONIBLE'' and not exists(select 1 from public.equipment_request_items i where i.equipment_id=e.id and i.reserved)','public.equipment_free_quantity(e.id)>0');
 execute v_sql;
end $upgrade$;

-- Keep the controlled legacy return path consistent with the new stock counters.
create or replace function public.record_equipment_movement(p_equipment_id uuid,p_movement_type text,p_condition_notes text default null,p_reason text default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_tenant uuid:=public.equipment_request_actor();v_equipment public.equipment;v_id uuid;v_qty integer;
begin
 if not public.action_allowed('equipment.update') or not public.equipment_request_reviewer() then raise exception 'Mouvements réservés au responsable matériel';end if;
 select * into v_equipment from public.equipment where id=p_equipment_id and tenant_owner_id=v_tenant for update;
 if not found then raise exception 'Matériel introuvable';end if;
 if exists(select 1 from public.equipment_request_items where equipment_id=v_equipment.id and reserved) then raise exception 'Utilisez le bon de sortie ou de retour de la demande';end if;
 if p_movement_type is null or p_movement_type not in ('ENTREE','RETOUR') then raise exception 'Créez une demande de sortie avec validation et photos';end if;
 if p_movement_type='RETOUR' and v_equipment.quantity_in_use=0 then raise exception 'Ce matériel n’est pas en mission';end if;
 if p_movement_type='ENTREE' and v_equipment.quantity_in_use>0 then raise exception 'Enregistrez un retour historique';end if;
 v_qty:=greatest(v_equipment.quantity_in_use,1);
 insert into public.equipment_movements(tenant_owner_id,equipment_id,movement_type,handled_by,condition_notes,reason,quantity)
 values(v_tenant,v_equipment.id,p_movement_type,auth.uid(),p_condition_notes,p_reason,v_qty) returning id into v_id;
 perform set_config('smartsell.equipment_request_write','yes',true);
 update public.equipment set quantity_in_use=0,quantity_unavailable=0,status='DISPONIBLE',condition=coalesce(nullif(trim(p_condition_notes),''),condition) where id=v_equipment.id;
 perform set_config('smartsell.equipment_request_write','',true);
 return v_id;
end $$;

-- Durable future-only SMS outbox: no historical decision triggers a surprise SMS.
create table if not exists public.equipment_decision_sms (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.equipment_requests(id),
 tenant_owner_id uuid not null references public.profiles(id),profile_id uuid not null references public.profiles(id),
 decision text not null,body text not null,status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','SENT','FAILED','CANCELLED')),
 created_at timestamptz not null default now(),sent_at timestamptz,provider_message_id text,error text
);
alter table public.equipment_decision_sms enable row level security;
revoke all on public.equipment_decision_sms from anon,authenticated;
grant select on public.equipment_decision_sms to authenticated;
grant all on public.equipment_decision_sms to service_role;
drop policy if exists equipment_sms_read on public.equipment_decision_sms;
create policy equipment_sms_read on public.equipment_decision_sms for select to authenticated
using(tenant_owner_id=public.equipment_request_actor() and (profile_id=auth.uid() or public.equipment_request_reviewer()));
create or replace function public.queue_equipment_decision_sms() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if new.status is distinct from old.status and new.status in ('APPROUVEE','REFUSEE') and new.requested_by is not null then
  insert into public.equipment_decision_sms(request_id,tenant_owner_id,profile_id,decision,body)
  values(new.id,new.tenant_owner_id,new.requested_by,new.status,
  'Bonjour '||new.requester_name||', votre demande de matériel '||left(new.id::text,8)||case when new.status='APPROUVEE' then ' est validée. La remise et les photos restent à enregistrer.' else ' est refusée. Consultez le motif dans votre espace.' end||' Connectez-vous pour voir votre mission : https://seydoutra.github.io/smartsell-management/');
 end if;
 return new;
end $$;
drop trigger if exists queue_equipment_decision_sms on public.equipment_requests;
create trigger queue_equipment_decision_sms after update on public.equipment_requests for each row execute function public.queue_equipment_decision_sms();
do $workspace$ declare v_sql text;begin
 select pg_get_functiondef('public.equipment_request_workspace()'::regprocedure) into v_sql;
 if position('equipment_decision_sms' in v_sql)=0 then
  v_sql:=replace(v_sql,'select r.*,(select','select r.*,(select jsonb_build_object(''status'',s.status,''error'',s.error) from public.equipment_decision_sms s where s.request_id=r.id and s.tenant_owner_id=tenant order by s.created_at desc,s.id desc limit 1) as sms,(select');
  execute v_sql;
 end if;
end $workspace$;
create or replace function public.claim_equipment_decision_sms() returns setof public.equipment_decision_sms
language sql security definer set search_path=public,pg_temp as $$
 update public.equipment_decision_sms set status='PROCESSING' where id in
 (select id from public.equipment_decision_sms where status='PENDING' order by created_at for update skip locked limit 50) returning *
$$;
revoke all on function public.claim_equipment_decision_sms() from public,anon,authenticated;
grant execute on function public.claim_equipment_decision_sms() to service_role;
revoke all on function public.equipment_stock_guard(),public.queue_equipment_decision_sms() from public,anon,authenticated;
revoke all on function public.equipment_free_quantity(uuid),public.list_equipment_stock(),public.submit_equipment_request_quantities(text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.equipment_free_quantity(uuid),public.list_equipment_stock(),public.submit_equipment_request_quantities(text,text,timestamptz,jsonb) to authenticated;
select set_config('smartsell.equipment_request_write','',true);
notify pgrst,'reload schema';
commit;
