begin;
alter table public.prospects add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.tasks add column if not exists source_quote_item_id uuid references public.quote_items(id) on delete set null;
create unique index if not exists task_quote_item_once on public.tasks(source_quote_item_id) where source_quote_item_id is not null;
create table if not exists public.orchestration_jobs(
 id uuid primary key default gen_random_uuid(),tenant_owner_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('PROSPECT_CLIENT','QUOTE_DELIVERY')),source_id uuid not null,
 status text not null default 'A_VALIDER' check(status in ('A_VALIDER','TERMINE','IGNORE','ERREUR')),
 result jsonb not null default '{}',executed_payload jsonb,error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(tenant_owner_id,kind,source_id));
create table if not exists public.orchestration_events(
 id uuid primary key default gen_random_uuid(),tenant_owner_id uuid not null references public.profiles(id) on delete cascade,job_id uuid references public.orchestration_jobs(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,kind text not null,source_id uuid,event text not null,detail text,created_at timestamptz not null default now());
alter table public.orchestration_jobs enable row level security;
alter table public.orchestration_events enable row level security;
revoke all on public.orchestration_jobs,public.orchestration_events from public,anon,authenticated;
grant all on public.orchestration_jobs,public.orchestration_events to service_role;
create index if not exists orchestration_events_tenant on public.orchestration_events(tenant_owner_id,created_at desc);

create or replace function public.queue_commercial_orchestration() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.tenant_owner_id is null then return new; end if;
 if tg_table_name='prospects' then
  if new.client_id is not null and not exists(select 1 from public.clients where id=new.client_id and tenant_owner_id=new.tenant_owner_id) then raise exception 'Client hors de votre entreprise';end if;
  if new.stage='GAGNE' and new.client_id is null then insert into orchestration_jobs(tenant_owner_id,kind,source_id) values(new.tenant_owner_id,'PROSPECT_CLIENT',new.id) on conflict do nothing;end if;
 elsif new.status in ('ACCEPTE','ACCEPTEE','FACTURE') then
  insert into orchestration_jobs(tenant_owner_id,kind,source_id) values(new.tenant_owner_id,'QUOTE_DELIVERY',new.id) on conflict do nothing;
 end if;return new;
end $$;
revoke all on function public.queue_commercial_orchestration() from public,anon,authenticated;
drop trigger if exists queue_commercial_orchestration on public.prospects;
create trigger queue_commercial_orchestration after insert or update on public.prospects for each row execute function public.queue_commercial_orchestration();
drop trigger if exists queue_commercial_orchestration on public.quotes;
create trigger queue_commercial_orchestration after insert or update on public.quotes for each row execute function public.queue_commercial_orchestration();

create or replace function public.orchestration_workspace() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.current_tenant_owner_id();jobs jsonb;quotes_data jsonb;clients_data jsonb;staff jsonb;events jsonb;
begin
 if auth.uid() is null or public.has_client_role(auth.uid()) or not public.action_allowed('clients.view') then raise exception 'Accès refusé';end if;
 select coalesce(jsonb_agg((to_jsonb(j)-'executed_payload')||jsonb_build_object('title',case when j.kind='PROSPECT_CLIENT' then (select company from prospects where id=j.source_id and tenant_owner_id=tenant) else (select number from quotes where id=j.source_id and tenant_owner_id=tenant) end) order by j.created_at desc),'[]') into jobs from orchestration_jobs j where j.tenant_owner_id=tenant and (j.kind='PROSPECT_CLIENT' or public.action_allowed('invoices.view'));
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) order by name),'[]') into clients_data from clients where tenant_owner_id=tenant;
 if public.action_allowed('invoices.view') then
 select coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'description',i.description) order by i.sort_order,i.id),'[]') from quote_items i where i.quote_id=q.id)) order by q.created_at desc),'[]') into quotes_data from quotes q where q.tenant_owner_id=tenant;
 else quotes_data:='[]';end if;
 if public.action_allowed('tasks.create') and public.action_allowed('tasks.assign') then
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name),'[]') into staff from profiles where coalesce(tenant_owner_id,id)=tenant and active and not public.has_client_role(id);
 else staff:='[]';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') into events from (select * from orchestration_events where tenant_owner_id=tenant and (kind='PROSPECT_CLIENT' or (public.action_allowed('invoices.view') and (kind<>'PAYMENT' or public.action_allowed('accounting.view')))) order by created_at desc limit 60) e;
 return jsonb_build_object('jobs',jobs,'quotes',quotes_data,'clients',clients_data,'staff',staff,'events',events,'rights',jsonb_build_object('view_projects',public.action_allowed('projects.view'),'view_tasks',public.action_allowed('tasks.view'),'view_billing',public.action_allowed('invoices.view'),'convert',public.action_allowed('clients.create') and public.action_allowed('clients.update'),'accept_quote',public.action_allowed('invoices.update'),'delivery',public.action_allowed('projects.create') and public.action_allowed('projects.view') and public.action_allowed('invoices.update'),'tasks',public.action_allowed('tasks.create'),'invoice',public.action_allowed('invoices.create') and public.action_allowed('invoices.view')));
end $$;

create or replace function public.analyze_commercial_orchestration() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.current_tenant_owner_id();
begin
 if auth.uid() is null or not public.current_account_has_access() or not public.action_allowed('clients.update') then raise exception 'Analyse refusée';end if;
 insert into orchestration_jobs(tenant_owner_id,kind,source_id) select tenant,'PROSPECT_CLIENT',id from prospects where tenant_owner_id=tenant and stage='GAGNE' and client_id is null on conflict do nothing;
 if public.action_allowed('invoices.view') then insert into orchestration_jobs(tenant_owner_id,kind,source_id) select tenant,'QUOTE_DELIVERY',id from quotes where tenant_owner_id=tenant and status in ('ACCEPTE','ACCEPTEE','FACTURE') on conflict do nothing;end if;
end $$;

create or replace function public.confirm_quote_acceptance(p_quote uuid,p_note text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.quotes;
begin
 if auth.uid() is null or not public.current_account_has_access() or not public.action_allowed('invoices.update') or not public.action_allowed('invoices.view') then raise exception 'Confirmation refusée';end if;
 if length(btrim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'Précisez la preuve ou le contexte de l’accord client';end if;
 select * into q from quotes where id=p_quote and tenant_owner_id=public.current_tenant_owner_id() for update;
 if not found then raise exception 'Devis introuvable';end if;
 if q.status in ('REFUSE','REFUSEE','ANNULE','ANNULEE','EXPIRE') then raise exception 'Devis clôturé sans acceptation';end if;
 if q.status not in ('ACCEPTE','ACCEPTEE','FACTURE') then update quotes set status='ACCEPTE' where id=q.id;end if;
 insert into orchestration_jobs(tenant_owner_id,kind,source_id) values(q.tenant_owner_id,'QUOTE_DELIVERY',q.id) on conflict do nothing;
 insert into orchestration_events(tenant_owner_id,actor_id,kind,source_id,event,detail) values(q.tenant_owner_id,auth.uid(),'QUOTE_DELIVERY',q.id,'ACCORD_CONFIRME',btrim(p_note));
end $$;

create or replace function public.execute_commercial_orchestration(p_job uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
<<flow>>
declare j public.orchestration_jobs;p public.prospects;q public.quotes;cid uuid;pid uuid;iid uuid;task_id uuid;s jsonb;line public.quote_items;assignee uuid;task_ids jsonb:='[]';result jsonb;err text;
begin
 if auth.uid() is null or not public.current_account_has_access() or public.has_client_role(auth.uid()) or not public.action_allowed('clients.view') then raise exception 'Accès refusé';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>32768 then raise exception 'Paramètres invalides';end if;
 select * into j from orchestration_jobs where id=p_job and tenant_owner_id=public.current_tenant_owner_id() for update;
 if not found then raise exception 'Proposition introuvable';end if;
 if j.kind='PROSPECT_CLIENT' then
  if not public.action_allowed('clients.create') or not public.action_allowed('clients.update') then raise exception 'Conversion refusée';end if;
 else
  if not public.action_allowed('invoices.view') or not public.action_allowed('invoices.update') or not public.action_allowed('projects.create') or not public.action_allowed('projects.view') then raise exception 'Démarrage refusé';end if;
  if coalesce((p_payload->>'invoice')::boolean,false) and not public.action_allowed('invoices.create') then raise exception 'Facturation refusée';end if;
  if coalesce(jsonb_array_length(p_payload->'tasks'),0)>0 and not public.action_allowed('tasks.create') then raise exception 'Création de tâches refusée';end if;
 end if;
 if j.status='TERMINE' then if j.executed_payload is distinct from p_payload then raise exception 'Déjà exécuté avec d’autres paramètres. Consultez les résultats.';end if;return jsonb_build_object('ok',true,'result',j.result,'reused',true);end if;
 if j.status='IGNORE' then raise exception 'Proposition ignorée';end if;
 begin
 if j.kind='PROSPECT_CLIENT' then
  select * into p from prospects where id=j.source_id and tenant_owner_id=j.tenant_owner_id for update;
  if not found or p.stage<>'GAGNE' then raise exception 'Prospect non gagné ou supprimé';end if;
  cid:=coalesce(p.client_id,nullif(p_payload->>'client_id','')::uuid);
  if cid is not null then
   if not exists(select 1 from clients where id=cid and tenant_owner_id=j.tenant_owner_id) then raise exception 'Client hors de votre entreprise';end if;
  else
   if p.email is not null then perform pg_advisory_xact_lock(hashtextextended(j.tenant_owner_id::text||lower(p.email),75));end if;
   if p.email is not null and exists(select 1 from clients where tenant_owner_id=j.tenant_owner_id and lower(email)=lower(p.email)) then raise exception 'Un client a déjà cet email : sélectionnez le client existant';end if;
   insert into clients(tenant_owner_id,name,sector,phone,email,whatsapp,notes) values(j.tenant_owner_id,p.company,p.sector,p.phone,p.email,p.whatsapp,p.notes) returning id into cid;
  end if;
  update prospects set client_id=cid where id=p.id;
  result:=jsonb_build_object('client_id',cid);
 else
  select * into q from quotes where id=j.source_id and tenant_owner_id=j.tenant_owner_id for update;
  if not found or q.status not in ('ACCEPTE','ACCEPTEE','FACTURE') then raise exception 'Accord client non confirmé';end if;
  pid:=public.start_client_delivery(q.id,p_payload->>'name',(p_payload->>'starts')::date,(p_payload->>'ends')::date);
  if not exists(select 1 from projects where id=pid and tenant_owner_id=j.tenant_owner_id and client_id=q.client_id) then raise exception 'Projet incohérent';end if;
  update invoices set project_id=pid where quote_id=q.id and tenant_owner_id=j.tenant_owner_id and project_id is distinct from pid;
  if jsonb_typeof(coalesce(p_payload->'tasks','[]'))<>'array' or jsonb_array_length(coalesce(p_payload->'tasks','[]'))>50 then raise exception 'Maximum 50 tâches';end if;
  if (select count(distinct x->>'item_id') from jsonb_array_elements(coalesce(p_payload->'tasks','[]')) x)<>jsonb_array_length(coalesce(p_payload->'tasks','[]')) then raise exception 'Prestations dupliquées dans les tâches';end if;
  for s in select * from jsonb_array_elements(coalesce(p_payload->'tasks','[]')) loop
   select * into line from quote_items where id=(s->>'item_id')::uuid and quote_id=q.id;
   if not found or length(btrim(coalesce(s->>'title',''))) not between 1 and 200 then raise exception 'Prestation ou titre invalide';end if;
   assignee:=nullif(s->>'assignee_id','')::uuid;
   if assignee is not null and (not public.action_allowed('tasks.assign') or not exists(select 1 from profiles where id=assignee and coalesce(tenant_owner_id,id)=j.tenant_owner_id and active and not public.has_client_role(id))) then raise exception 'Attribution refusée ou responsable hors équipe';end if;
   if (s->>'due_on')::date is null or (s->>'due_on')::date<(p_payload->>'starts')::date or (s->>'due_on')::date>(p_payload->>'ends')::date then raise exception 'Échéance de tâche hors du projet';end if;
   insert into tasks(tenant_owner_id,project_id,title,description,assignee_id,creator_id,due_at,source_quote_item_id)
   values(j.tenant_owner_id,pid,btrim(s->>'title'),'Prestation du devis '||q.number||E'\n'||line.description,assignee,auth.uid(),((s->>'due_on')::date+time '17:00') at time zone 'Africa/Conakry',line.id)
   on conflict(source_quote_item_id) where source_quote_item_id is not null do nothing returning id into task_id;
   if task_id is null then select id into task_id from tasks where source_quote_item_id=line.id and tenant_owner_id=j.tenant_owner_id and project_id=pid;if not found then raise exception 'Tâche déjà liée ailleurs';end if;end if;
   task_ids:=task_ids||jsonb_build_array(task_id);
  end loop;
  if coalesce((p_payload->>'invoice')::boolean,false) then
   select id into iid from invoices where quote_id=q.id and tenant_owner_id=j.tenant_owner_id;
   if iid is null then iid:=public.create_invoice_from_quote(q.id,(p_payload->>'due')::date);end if;
   update invoices set project_id=pid where id=iid and tenant_owner_id=j.tenant_owner_id;
  end if;
  result:=jsonb_build_object('client_id',q.client_id,'project_id',pid,'invoice_id',iid,'task_ids',task_ids);
 end if;
 update orchestration_jobs set status='TERMINE',result=flow.result,executed_payload=p_payload,error=null,updated_at=now() where id=j.id;
 insert into orchestration_events(tenant_owner_id,job_id,actor_id,kind,source_id,event,detail) values(j.tenant_owner_id,j.id,auth.uid(),j.kind,j.source_id,'EXECUTE','Relations créées ou récupérées sans doublon');
 return jsonb_build_object('ok',true,'result',result);
 exception when others then
  get stacked diagnostics err=message_text;
  update orchestration_jobs set status='ERREUR',error=left(err,1000),updated_at=now() where id=j.id;
  insert into orchestration_events(tenant_owner_id,job_id,actor_id,kind,source_id,event,detail) values(j.tenant_owner_id,j.id,auth.uid(),j.kind,j.source_id,'ECHEC',left(err,1000));
  return jsonb_build_object('ok',false,'error',err);
 end;
end $$;

-- An invoice created before the mission follows its quote when the project is attached.
create or replace function public.sync_quote_invoice_project() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.project_id is distinct from old.project_id and new.project_id is not null then
  if not exists(select 1 from projects where id=new.project_id and tenant_owner_id=new.tenant_owner_id and client_id=new.client_id) then raise exception 'Projet hors du dossier client';end if;
  update invoices set project_id=new.project_id where quote_id=new.id and tenant_owner_id=new.tenant_owner_id;
 end if;return new;
end $$;
revoke all on function public.sync_quote_invoice_project() from public,anon,authenticated;
drop trigger if exists sync_quote_invoice_project on quotes;
create trigger sync_quote_invoice_project after update of project_id on quotes for each row execute function public.sync_quote_invoice_project();
create or replace function public.trace_orchestrated_payment() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid;
begin
 if tg_op='DELETE' then tenant:=old.tenant_owner_id;else tenant:=new.tenant_owner_id;end if;
 if tenant is not null then insert into orchestration_events(tenant_owner_id,actor_id,kind,source_id,event,detail) values(tenant,auth.uid(),'PAYMENT',case when tg_op='DELETE' then old.invoice_id else new.invoice_id end,'PAYMENT_'||tg_op,'Paiement enregistré ; statut et solde de facture recalculés par le circuit de facturation');end if;
 return null;
end $$;
revoke all on function public.trace_orchestrated_payment() from public,anon,authenticated;
drop trigger if exists trace_orchestrated_payment on payments;
create trigger trace_orchestrated_payment after insert or update or delete on payments for each row execute function public.trace_orchestrated_payment();
revoke all on function public.orchestration_workspace(),public.analyze_commercial_orchestration(),public.confirm_quote_acceptance(uuid,text),public.execute_commercial_orchestration(uuid,jsonb) from public,anon;
grant execute on function public.orchestration_workspace(),public.analyze_commercial_orchestration(),public.confirm_quote_acceptance(uuid,text),public.execute_commercial_orchestration(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
