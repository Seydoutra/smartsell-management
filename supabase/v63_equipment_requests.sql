-- Demandes de matériel : approbation, réservation, remise et retours partiels.
-- Aucun matériel ni mouvement historique n'est supprimé ou réécrit.
begin;
create table if not exists public.equipment_request_settings (
 tenant_owner_id uuid primary key references public.profiles(id),
 reviewer_id uuid references public.profiles(id) on delete set null
);
create table if not exists public.equipment_requests (
 id uuid primary key default gen_random_uuid(),
 tenant_owner_id uuid not null references public.profiles(id),
 requested_by uuid references public.profiles(id) on delete set null,
 requester_name text not null,
 reason text not null check(length(trim(reason)) between 1 and 2000),
 destination text not null check(length(trim(destination)) between 1 and 500),
 expected_return_at timestamptz not null,
 status text not null default 'EN_ATTENTE' check(status in ('EN_ATTENTE','APPROUVEE','REFUSEE','SORTIE','RETOUR_PARTIEL','RETOURNEE')),
 decision_by uuid references public.profiles(id) on delete set null,
 decision_name text, decision_at timestamptz, decision_notes text,
 checked_out_by uuid references public.profiles(id) on delete set null,
 checked_out_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.equipment_request_items (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.equipment_requests(id),
 tenant_owner_id uuid not null references public.profiles(id),
 equipment_id uuid not null references public.equipment(id),
 equipment_name text not null, equipment_code text not null,
 condition_out text, condition_out_photos text[] not null default '{}', reserved boolean not null default false,
 return_condition text check(return_condition in ('CONFORME','DEGRADE','HORS_SERVICE')),
 condition_in text, condition_in_photos text[] not null default '{}', returned_at timestamptz,
 returned_by uuid references public.profiles(id) on delete set null,
 unique(request_id,equipment_id)
);
create unique index if not exists equipment_one_reservation on public.equipment_request_items(equipment_id) where reserved;
create index if not exists equipment_requests_tenant_date on public.equipment_requests(tenant_owner_id,created_at desc);

create or replace function public.equipment_request_actor() returns uuid
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tenant uuid;
begin
 select coalesce(tenant_owner_id,id) into tenant from public.profiles
 where id=auth.uid() and active and role::text<>'CLIENT';
 if tenant is null then raise exception 'Compte collaborateur actif requis';end if;
 return tenant;
end $$;
create or replace function public.equipment_request_reviewer() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid()=public.current_tenant_owner_id() or (
 exists(select 1 from public.equipment_request_settings where tenant_owner_id=public.current_tenant_owner_id() and reviewer_id=auth.uid())
 and not exists(select 1 from public.user_access_controls where profile_id=auth.uid() and 'equipment.approve'=any(coalesce(denied_permissions,'{}'::text[])))
 )
$$;
create or replace function public.equipment_request_can_submit() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid()=public.current_tenant_owner_id() or not exists(
 select 1 from public.user_access_controls where profile_id=auth.uid() and 'equipment.request'=any(coalesce(denied_permissions,'{}'::text[])))
$$;

do $$declare tbl text;begin
 foreach tbl in array array['equipment_request_settings','equipment_requests','equipment_request_items'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from anon,authenticated',tbl);
  execute format('grant select on public.%I to authenticated',tbl);
  execute format('drop policy if exists equipment_request_read on public.%I',tbl);
  execute format('drop trigger if exists enforce_trial_write_access on public.%I',tbl);
  execute format('create trigger enforce_trial_write_access before insert or update or delete on public.%I for each row execute function public.enforce_trial_write_access()',tbl);
 end loop;
end $$;
create policy equipment_request_read on public.equipment_request_settings for select to authenticated
using(tenant_owner_id=public.equipment_request_actor());
create policy equipment_request_read on public.equipment_requests for select to authenticated
using(tenant_owner_id=public.equipment_request_actor() and (requested_by=auth.uid() or public.equipment_request_reviewer()));
create policy equipment_request_read on public.equipment_request_items for select to authenticated
using(tenant_owner_id=public.equipment_request_actor() and exists(select 1 from public.equipment_requests r where r.id=request_id));

create or replace function public.equipment_request_notify(p_request uuid,p_title text,p_body text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.notifications(tenant_owner_id,profile_id,channel,title,body,entity_type,entity_id)
 select r.tenant_owner_id,p.id,'IN_APP',p_title,p_body,'equipment_request',r.id
 from public.equipment_requests r join public.profiles p on p.tenant_owner_id=r.tenant_owner_id and p.active
 where r.id=p_request and p.id in (r.tenant_owner_id,r.requested_by,(select reviewer_id from public.equipment_request_settings where tenant_owner_id=r.tenant_owner_id));
end $$;

create or replace function public.equipment_request_workspace() returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.equipment_request_actor(); reviewer boolean:=public.equipment_request_reviewer();result jsonb;
begin
 select jsonb_build_object(
 'can_review',reviewer,'can_configure',auth.uid()=tenant,'can_request',public.equipment_request_can_submit(),
 'reviewer_id',(select reviewer_id from public.equipment_request_settings where tenant_owner_id=tenant),
 'reviewer_name',(select p.full_name from public.equipment_request_settings s join public.profiles p on p.id=s.reviewer_id where s.tenant_owner_id=tenant),
 'staff',case when auth.uid()=tenant then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name),'[]'::jsonb) from public.profiles where tenant_owner_id=tenant and active and role::text<>'CLIENT') else '[]'::jsonb end,
 'equipment',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'code',e.code,'name',e.name,'condition',e.condition,'available',e.status='DISPONIBLE' and not exists(select 1 from public.equipment_request_items i where i.equipment_id=e.id and i.reserved)) order by e.name),'[]'::jsonb) from public.equipment e where e.tenant_owner_id=tenant),
 'requests',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) from (
 select r.*,(select coalesce(jsonb_agg(to_jsonb(i) order by i.equipment_code),'[]'::jsonb) from public.equipment_request_items i where i.request_id=r.id and i.tenant_owner_id=tenant) as items
 from public.equipment_requests r where r.tenant_owner_id=tenant and (reviewer or r.requested_by=auth.uid()) order by r.created_at desc limit 100) q)
 ) into result;return result;
end $$;

create or replace function public.configure_equipment_reviewer(p_reviewer uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.equipment_request_actor();begin
 if auth.uid()<>tenant then raise exception 'Seul le propriétaire peut désigner le responsable';end if;
 if p_reviewer is not null and not exists(select 1 from public.profiles where id=p_reviewer and tenant_owner_id=tenant and active and role::text<>'CLIENT') then raise exception 'Responsable hors de votre équipe';end if;
 insert into public.equipment_request_settings values(tenant,p_reviewer) on conflict(tenant_owner_id) do update set reviewer_id=excluded.reviewer_id;
 insert into public.activity_logs(tenant_owner_id,actor_id,action,entity_type,metadata) values(tenant,auth.uid(),'Responsable matériel désigné','equipment_request',jsonb_build_object('reviewer_id',p_reviewer));
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('equipment-evidence','equipment-evidence',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.equipment_photo_access(p_path text,p_write boolean) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.equipment_request_actor();r public.equipment_requests;begin
 if split_part(p_path,'/',1)<>tenant::text or split_part(p_path,'/',4) not in ('OUT','IN') or array_length(string_to_array(p_path,'/'),1)<>5 then return false;end if;
 select * into r from public.equipment_requests where id=split_part(p_path,'/',2)::uuid and tenant_owner_id=tenant;
 if not found or not exists(select 1 from public.equipment_request_items where request_id=r.id and equipment_id=split_part(p_path,'/',3)::uuid) then return false;end if;
 if p_write then
  if exists(select 1 from public.profiles where id=tenant and is_temporary and access_expires_at<=now()) and not public.is_platform_owner() then return false;end if;
  return public.equipment_request_reviewer() and ((split_part(p_path,'/',4)='OUT' and r.status='APPROUVEE') or (split_part(p_path,'/',4)='IN' and r.status in ('SORTIE','RETOUR_PARTIEL') and exists(select 1 from public.equipment_request_items where request_id=r.id and equipment_id=split_part(p_path,'/',3)::uuid and returned_at is null)));
 end if;
 return public.equipment_request_reviewer() or r.requested_by=auth.uid();
 exception when invalid_text_representation then return false;
end $$;
drop policy if exists equipment_photo_read on storage.objects;
drop policy if exists equipment_photo_upload on storage.objects;
drop policy if exists equipment_photo_cleanup on storage.objects;
create policy equipment_photo_read on storage.objects for select to authenticated using(bucket_id='equipment-evidence' and public.equipment_photo_access(name,false));
create policy equipment_photo_upload on storage.objects for insert to authenticated with check(bucket_id='equipment-evidence' and public.equipment_photo_access(name,true));
create policy equipment_photo_cleanup on storage.objects for delete to authenticated using(bucket_id='equipment-evidence' and public.equipment_photo_access(name,true) and not exists(select 1 from public.equipment_request_items i where name=any(i.condition_out_photos) or name=any(i.condition_in_photos)));
create or replace function public.checked_equipment_photos(p_request uuid,p_equipment uuid,p_stage text,p_photos jsonb) returns text[]
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare paths text[];prefix text:=public.current_tenant_owner_id()::text||'/'||p_request::text||'/'||p_equipment::text||'/'||p_stage||'/';path text;begin
 if jsonb_typeof(p_photos) is distinct from 'array' or jsonb_array_length(p_photos) not between 1 and 5 then raise exception 'Ajoutez entre 1 et 5 photos par matériel';end if;
 select array_agg(value) into paths from jsonb_array_elements_text(p_photos);
 if cardinality(paths)<>(select count(distinct p) from unnest(paths) p) then raise exception 'Photos dupliquées';end if;
 foreach path in array paths loop
  if path is null or left(path,length(prefix))<>prefix or not public.equipment_photo_access(path,true) or not exists(select 1 from storage.objects o where o.bucket_id='equipment-evidence' and o.name=path) then raise exception 'Photo absente ou hors du bon de matériel';end if;
 end loop;return paths;
end $$;

create or replace function public.submit_equipment_request(p_reason text,p_destination text,p_return_at timestamptz,p_equipment uuid[]) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.equipment_request_actor(); rid uuid;item record;qty int:=0;begin
 if not public.equipment_request_can_submit() then raise exception 'Droit de demande de matériel retiré';end if;
 if p_equipment is null or cardinality(p_equipment) not between 1 and 50 or exists(select 1 from unnest(p_equipment) x where x is null) or cardinality(p_equipment)<>(select count(distinct x) from unnest(p_equipment) x) then raise exception 'Sélectionnez entre 1 et 50 matériels distincts';end if;
 if p_return_at is null or p_return_at<=now() then raise exception 'Date de retour future requise';end if;
 insert into public.equipment_requests(tenant_owner_id,requested_by,requester_name,reason,destination,expected_return_at)
 values(tenant,auth.uid(),(select full_name from public.profiles where id=auth.uid()),trim(p_reason),trim(p_destination),p_return_at) returning id into rid;
 for item in select * from public.equipment where tenant_owner_id=tenant and id=any(p_equipment) order by id for update loop
  if item.status<>'DISPONIBLE' or exists(select 1 from public.equipment_request_items where equipment_id=item.id and reserved) then raise exception 'Matériel indisponible : %',item.name;end if;
  insert into public.equipment_request_items(request_id,tenant_owner_id,equipment_id,equipment_name,equipment_code) values(rid,tenant,item.id,item.name,item.code);qty:=qty+1;
 end loop;
 if qty<>cardinality(p_equipment) then raise exception 'Matériel introuvable dans votre entreprise';end if;
 perform public.equipment_request_notify(rid,'Demande de bon de sortie',(select requester_name from public.equipment_requests where id=rid)||' demande '||qty||' matériel(s). Consultez Demandes matériel pour traiter la demande.');
 insert into public.activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id) values(tenant,auth.uid(),'Demande de sortie','equipment_request',rid);
 return rid;
end $$;

create or replace function public.decide_equipment_request(p_request uuid,p_approve boolean,p_notes text default '') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.equipment_request_actor();r public.equipment_requests;item record;begin
 if not public.equipment_request_reviewer() then raise exception 'Validation réservée au propriétaire et au responsable matériel';end if;
 select * into r from public.equipment_requests where id=p_request and tenant_owner_id=tenant for update;
 if not found then raise exception 'Demande introuvable';end if;
 if r.status<>'EN_ATTENTE' and not (r.status='APPROUVEE' and not p_approve and auth.uid()=tenant) then raise exception 'Cette demande a déjà été traitée';end if;
 if p_approve is null then raise exception 'Décision requise';end if;
 if not p_approve and nullif(trim(p_notes),'') is null then raise exception 'Motif de refus obligatoire';end if;
 if p_approve then
  if r.expected_return_at<=now() then raise exception 'La date prévue de retour est dépassée. Créez une nouvelle demande';end if;
  for item in select e.* from public.equipment e join public.equipment_request_items i on i.equipment_id=e.id where i.request_id=r.id order by e.id for update of e loop
   if item.status<>'DISPONIBLE' or exists(select 1 from public.equipment_request_items where equipment_id=item.id and reserved) then raise exception 'Matériel déjà réservé ou indisponible : %',item.name;end if;
  end loop;
 end if;
 update public.equipment_request_items set reserved=p_approve where request_id=r.id;
 update public.equipment_requests set status=case when p_approve then 'APPROUVEE' else 'REFUSEE' end,decision_by=auth.uid(),decision_name=(select full_name from public.profiles where id=auth.uid()),decision_at=now(),decision_notes=left(trim(p_notes),2000) where id=r.id;
 perform public.equipment_request_notify(r.id,case when p_approve then 'Sortie approuvée' else 'Sortie refusée' end,case when p_approve then 'Matériel réservé. La remise doit encore être enregistrée.' else left(trim(p_notes),2000) end);
 insert into public.activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id) values(tenant,auth.uid(),case when p_approve then 'Sortie approuvée' else 'Sortie refusée' end,'equipment_request',r.id);
end $$;

create or replace function public.checkout_equipment_request(p_request uuid,p_items jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.equipment_request_actor();r public.equipment_requests;item record;notes text;photos text[];begin
 if not public.equipment_request_reviewer() then raise exception 'Remise réservée au responsable matériel';end if;
 select * into r from public.equipment_requests where id=p_request and tenant_owner_id=tenant for update;
 if not found or r.status<>'APPROUVEE' then raise exception 'Demande approuvée requise';end if;
 if r.expected_return_at<=now() then raise exception 'La date prévue de retour est dépassée';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<>(select count(*) from public.equipment_request_items where request_id=r.id) or (select count(distinct x->>'equipment_id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'État au départ requis pour chaque matériel';end if;
 for item in select i.*,e.status from public.equipment_request_items i join public.equipment e on e.id=i.equipment_id and e.tenant_owner_id=tenant where i.request_id=r.id order by e.id for update of e loop
  notes:=(select nullif(trim(x->>'notes'),'') from jsonb_array_elements(p_items) x where x->>'equipment_id'=item.equipment_id::text);
  if notes is null or length(notes)>2000 then raise exception 'Décrivez l’état au départ : %',item.equipment_name;end if;
  if item.status<>'DISPONIBLE' or not item.reserved then raise exception 'Matériel indisponible';end if;
  photos:=public.checked_equipment_photos(r.id,item.equipment_id,'OUT',(select x->'photos' from jsonb_array_elements(p_items) x where x->>'equipment_id'=item.equipment_id::text));
  update public.equipment_request_items set condition_out=notes,condition_out_photos=photos where id=item.id;
  perform set_config('smartsell.equipment_request_write','yes',true);
  update public.equipment set status='EN_MISSION',condition=notes where id=item.equipment_id;
  insert into public.equipment_movements(tenant_owner_id,equipment_id,movement_type,handled_by,condition_notes,reason) values(tenant,item.equipment_id,'SORTIE',auth.uid(),notes,'Bon '||r.id::text||' · '||r.reason);
 end loop;
 update public.equipment_requests set status='SORTIE',checked_out_by=auth.uid(),checked_out_at=now() where id=r.id;
 perform public.equipment_request_notify(r.id,'Matériel sorti','Bon de sortie enregistré. Retour attendu le '||to_char(r.expected_return_at,'DD/MM/YYYY HH24:MI')||' UTC.');
 insert into public.activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id) values(tenant,auth.uid(),'Matériel remis','equipment_request',r.id);
 perform set_config('smartsell.equipment_request_write','',true);
end $$;

create or replace function public.return_equipment_request(p_request uuid,p_items jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.equipment_request_actor();r public.equipment_requests;x jsonb;item public.equipment_request_items;notes text;state text;photos text[];begin
 if not public.equipment_request_reviewer() then raise exception 'Réception réservée au responsable matériel';end if;
 select * into r from public.equipment_requests where id=p_request and tenant_owner_id=tenant for update;
 if not found or r.status not in ('SORTIE','RETOUR_PARTIEL') then raise exception 'Bon de sortie actif requis';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 or (select count(distinct z->>'equipment_id') from jsonb_array_elements(p_items) z)<>jsonb_array_length(p_items) then raise exception 'Sélection de retour invalide';end if;
 for x in select value from jsonb_array_elements(p_items) order by value->>'equipment_id' loop
  select * into item from public.equipment_request_items where request_id=r.id and equipment_id=(x->>'equipment_id')::uuid and returned_at is null for update;
  if not found then raise exception 'Matériel absent du bon ou déjà retourné';end if;
  notes:=nullif(trim(x->>'notes'),'');state:=x->>'condition';
  if notes is null or length(notes)>2000 or state is null or state not in ('CONFORME','DEGRADE','HORS_SERVICE') then raise exception 'État et observations au retour obligatoires';end if;
  photos:=public.checked_equipment_photos(r.id,item.equipment_id,'IN',x->'photos');
  perform set_config('smartsell.equipment_request_write','yes',true);
  update public.equipment set status=case state when 'CONFORME' then 'DISPONIBLE' when 'DEGRADE' then 'MAINTENANCE' else 'HORS_SERVICE' end,condition=notes where id=item.equipment_id and tenant_owner_id=tenant;
  update public.equipment_request_items set reserved=false,return_condition=state,condition_in=notes,condition_in_photos=photos,returned_at=now(),returned_by=auth.uid() where id=item.id;
  insert into public.equipment_movements(tenant_owner_id,equipment_id,movement_type,handled_by,condition_notes,reason) values(tenant,item.equipment_id,'RETOUR',auth.uid(),notes,'Retour bon '||r.id::text||' · '||state);
 end loop;
 update public.equipment_requests set status=case when exists(select 1 from public.equipment_request_items where request_id=r.id and returned_at is null) then 'RETOUR_PARTIEL' else 'RETOURNEE' end where id=r.id;
 perform public.equipment_request_notify(r.id,'Retour de matériel enregistré','Le bon de retour précise pour chaque matériel l’état au départ, l’état au retour et les écarts constatés.');
 insert into public.activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id) values(tenant,auth.uid(),'Retour matériel contrôlé','equipment_request',r.id);
 perform set_config('smartsell.equipment_request_write','',true);
end $$;

-- Empêche le contournement par l'ancien formulaire ou un appel REST direct.
create or replace function public.guard_equipment_reservation() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if current_setting('smartsell.equipment_request_write',true) is distinct from 'yes' and tg_op<>'DELETE' and new.status='EN_MISSION' and (tg_op='INSERT' or old.status is distinct from new.status) then raise exception 'Une sortie doit passer par une demande approuvée';end if;
 if tg_op='INSERT' then return new;end if;
 if current_setting('smartsell.equipment_request_write',true) is distinct from 'yes' and exists(select 1 from public.equipment_request_items where equipment_id=old.id and reserved) and (tg_op='DELETE' or new.status is distinct from old.status or new.condition is distinct from old.condition or new.tenant_owner_id is distinct from old.tenant_owner_id) then raise exception 'Matériel réservé : utilisez son bon de sortie ou de retour';end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists guard_equipment_reservation on public.equipment;
create trigger guard_equipment_reservation before insert or update or delete on public.equipment for each row execute function public.guard_equipment_reservation();
create or replace function public.record_equipment_movement(p_equipment_id uuid,p_movement_type text,p_condition_notes text default null,p_reason text default null) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$declare tenant uuid:=public.equipment_request_actor();e public.equipment;mid uuid;begin
 if not public.action_allowed('equipment.update') then raise exception 'Permission denied';end if;
 if not public.equipment_request_reviewer() then raise exception 'Mouvements réservés au responsable matériel';end if;
 select * into e from public.equipment where id=p_equipment_id and tenant_owner_id=tenant for update;
 if not found then raise exception 'Matériel introuvable';end if;
 if exists(select 1 from public.equipment_request_items where equipment_id=e.id and reserved) then raise exception 'Utilisez le bon de sortie ou de retour de la demande';end if;
 if p_movement_type is null or p_movement_type not in ('SORTIE','ENTREE','RETOUR') then raise exception 'Type de mouvement invalide';end if;
 if p_movement_type='SORTIE' then raise exception 'Créez une demande de sortie avec validation et photos';end if;
 if p_movement_type='SORTIE' and e.status<>'DISPONIBLE' then raise exception 'Matériel indisponible';end if;
 if p_movement_type='RETOUR' and e.status<>'EN_MISSION' then raise exception 'Ce matériel n’est pas en mission';end if;
 insert into public.equipment_movements(tenant_owner_id,equipment_id,movement_type,handled_by,condition_notes,reason) values(tenant,e.id,p_movement_type,auth.uid(),p_condition_notes,p_reason) returning id into mid;
 update public.equipment set status=case when p_movement_type='SORTIE' then 'EN_MISSION' else 'DISPONIBLE' end,condition=coalesce(nullif(trim(p_condition_notes),''),condition) where id=e.id;
 return mid;
end $$;
-- Mouvements immuables : écriture uniquement via les fonctions contrôlées.
revoke insert,update,delete on public.equipment_movements from authenticated;
drop policy if exists tenant_select on public.equipment;
drop policy if exists equipment_read on public.equipment;
create policy equipment_read on public.equipment for select to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('equipment.view') and not public.has_role('CLIENT'));
drop policy if exists tenant_write on public.equipment;
drop policy if exists equipment_insert on public.equipment;
drop policy if exists equipment_update on public.equipment;
drop policy if exists equipment_delete on public.equipment;
create policy equipment_insert on public.equipment for insert to authenticated with check(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('equipment.create'));
create policy equipment_update on public.equipment for update to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('equipment.update')) with check(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('equipment.update'));
create policy equipment_delete on public.equipment for delete to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('equipment.delete'));
do $$declare f record;begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('equipment_request_actor','equipment_request_reviewer','equipment_request_can_submit','equipment_request_notify','equipment_request_workspace','configure_equipment_reviewer','submit_equipment_request','decide_equipment_request','checkout_equipment_request','return_equipment_request','guard_equipment_reservation','record_equipment_movement','equipment_photo_access','checked_equipment_photos') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  if f.signature::text not like '%equipment_request_notify(%' and f.signature::text not like '%guard_equipment_reservation(%' and f.signature::text not like '%checked_equipment_photos(%' then execute format('grant execute on function %s to authenticated',f.signature);end if;
 end loop;
end $$;
commit;
