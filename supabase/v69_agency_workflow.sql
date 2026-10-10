begin;
create table if not exists public.client_brand_profiles(
 client_id uuid primary key references public.clients(id) on delete cascade,
 tenant_owner_id uuid not null references public.profiles(id),
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object' and octet_length(data::text)<=32768),
 revision integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid references public.profiles(id));
alter table public.client_brand_profiles enable row level security;
drop policy if exists brand_read on public.client_brand_profiles;
create policy brand_read on public.client_brand_profiles for select to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and (public.action_allowed('clients.view') or public.portal_client_allowed(client_id)));
grant select on public.client_brand_profiles to authenticated;
create or replace function public.save_client_brand(p_client_id uuid,p_data jsonb,p_revision integer)
returns public.client_brand_profiles language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.client_brand_profiles; current_revision integer;
begin
 if p_revision is null or p_revision<0 then raise exception 'Révision requise';end if;
 if not public.action_allowed('clients.update') or not exists(select 1 from clients where id=p_client_id and tenant_owner_id=public.current_tenant_owner_id()) then raise exception 'Modification du dossier de marque refusée';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,0));
 select revision into current_revision from client_brand_profiles where client_id=p_client_id;
 if coalesce(current_revision,0)<>p_revision then raise exception 'Le dossier a été modifié par un autre utilisateur. Rechargez avant de sauvegarder.';end if;
 insert into client_brand_profiles(client_id,tenant_owner_id,data,revision,updated_by) values(p_client_id,public.current_tenant_owner_id(),p_data,1,auth.uid())
 on conflict(client_id) do update set data=excluded.data,revision=client_brand_profiles.revision+1,updated_at=now(),updated_by=auth.uid() returning * into result;
 return result;
end $$;
create table if not exists public.operation_receipts(
 tenant_owner_id uuid not null,operation_id uuid not null,author_id uuid not null,kind text not null,payload jsonb not null,result_id uuid not null,created_at timestamptz not null default now(),primary key(tenant_owner_id,operation_id));
alter table public.operation_receipts enable row level security;
create or replace function public.create_billing_document_once(p_operation_id uuid,p_kind text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt public.operation_receipts; result uuid; tenant uuid:=public.current_tenant_owner_id();v_client_id uuid:=(p_payload->>'client_id')::uuid;v_project_id uuid:=nullif(p_payload->>'project_id','')::uuid;
begin
 if auth.uid() is null or p_operation_id is null or not public.action_allowed('invoices.create') then raise exception 'Création de document refusée';end if;
 if p_kind is null or p_kind not in ('FACTURE','DEVIS') then raise exception 'Type de document invalide';end if;
 if not exists(select 1 from clients where id=v_client_id and tenant_owner_id=tenant) then raise exception 'Client hors de votre espace';end if;
 if v_project_id is not null and not exists(select 1 from projects p where p.id=v_project_id and p.client_id=v_client_id and p.tenant_owner_id=tenant) then raise exception 'Projet hors du dossier client';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||p_operation_id::text,0));
 select * into receipt from operation_receipts where tenant_owner_id=tenant and operation_id=p_operation_id;
 if found then
  if receipt.kind<>p_kind or receipt.payload<>p_payload or receipt.author_id<>auth.uid() then raise exception 'Cette tentative correspond à un autre document. Vérifiez les documents existants.';end if;
  return receipt.result_id;
 end if;
 if p_kind='FACTURE' then result:=public.create_invoice_with_items(v_client_id,v_project_id,(p_payload->>'date')::date,p_payload->>'currency',(p_payload->>'discount')::numeric,p_payload->'items');
 else result:=public.create_quote_with_items(v_client_id,v_project_id,(p_payload->>'date')::date,p_payload->>'currency',(p_payload->>'discount')::numeric,p_payload->'items');end if;
 insert into operation_receipts values(tenant,p_operation_id,auth.uid(),p_kind,p_payload,result,now());return result;
end $$;
create table if not exists public.form_drafts(
 author_id uuid not null references profiles(id) on delete cascade,tenant_owner_id uuid not null references profiles(id),draft_key text not null check(length(draft_key)<=160),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=65536),updated_at timestamptz not null default now(),primary key(author_id,draft_key));
alter table public.form_drafts enable row level security;
drop policy if exists own_drafts on public.form_drafts;
create policy own_drafts on public.form_drafts for all to authenticated using(author_id=auth.uid() and tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('invoices.create')) with check(author_id=auth.uid() and tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('invoices.create'));
grant select,insert,update,delete on public.form_drafts to authenticated;
alter table public.projects add column if not exists source_quote_id uuid references public.quotes(id) on delete set null;
create unique index if not exists projects_source_quote_unique on public.projects(source_quote_id) where source_quote_id is not null;
create or replace function public.start_client_delivery(p_quote_id uuid,p_name text,p_starts_on date,p_ends_on date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare q public.quotes;result uuid;v_description text;
begin
 if not public.action_allowed('projects.create') or not public.action_allowed('invoices.update') then raise exception 'Démarrage de projet refusé';end if;
 select * into q from quotes where id=p_quote_id and tenant_owner_id=public.current_tenant_owner_id() for update;
 if not found then raise exception 'Devis introuvable';end if;
 if btrim(coalesce(p_name,''))='' or p_starts_on is null or p_ends_on is null or p_ends_on<p_starts_on then raise exception 'Nom et dates cohérentes obligatoires';end if;
 if q.project_id is not null then return q.project_id;end if;
 select id into result from projects where source_quote_id=q.id;if found then return result;end if;
 select string_agg(description,E'\n' order by sort_order,id) into v_description from quote_items where quote_id=q.id;
 insert into projects(tenant_owner_id,client_id,name,starts_on,ends_on,budget,currency,status,priority,progress,description,source_quote_id)
 values(q.tenant_owner_id,q.client_id,btrim(p_name),p_starts_on,p_ends_on,q.total,q.currency,'PLANIFIE','NORMALE',0,'Prestations du devis '||q.number||E'\n'||coalesce(v_description,''),q.id) returning id into result;
 update quotes set project_id=result where id=q.id;
 insert into activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id,metadata) values(q.tenant_owner_id,auth.uid(),'Démarrage confirmé depuis un devis','project',result,jsonb_build_object('quote_id',q.id));return result;
end $$;
alter table public.creative_approvals add column if not exists editorial_snapshot jsonb;
create or replace function public.capture_creative_snapshot() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.status in ('APPROUVE','MODIFICATIONS_DEMANDEES') and new.status is distinct from old.status and old.status<>'A_VALIDER' then raise exception 'Cette version ne peut plus être validée. Consultez la dernière version.';end if;
 if tg_op='UPDATE' and (new.title,new.description,new.asset_url,new.asset_type,new.version,new.editorial_snapshot) is distinct from (old.title,old.description,old.asset_url,old.asset_type,old.version,old.editorial_snapshot) then raise exception 'Une version envoyée au client est immuable. Créez une nouvelle version.';end if;
 if tg_op='INSERT' and new.editorial_item_id is not null then
  select jsonb_build_object('title',e.title,'caption',e.caption,'hashtags',e.hashtags,'asset_urls',e.asset_urls,'platforms',e.platforms) into new.editorial_snapshot from editorial_items e where e.id=new.editorial_item_id and e.client_id=new.client_id and e.tenant_owner_id=new.tenant_owner_id;
  if new.editorial_snapshot is null then raise exception 'Contenu hors du dossier client';end if;
 end if;return new;
end $$;
drop trigger if exists zz_capture_creative_snapshot on creative_approvals;
create trigger zz_capture_creative_snapshot before insert or update on creative_approvals for each row execute function capture_creative_snapshot();
create table if not exists public.creative_annotations(
 id uuid primary key default gen_random_uuid(),approval_id uuid not null references creative_approvals(id) on delete cascade,tenant_owner_id uuid not null,author_id uuid not null references profiles(id),body text not null check(length(btrim(body)) between 1 and 2000),x numeric check(x between 0 and 1),y numeric check(y between 0 and 1),time_seconds numeric check(time_seconds>=0),created_at timestamptz not null default now(),check((x is null)=(y is null)),check(x is null or time_seconds is null));
alter table public.creative_annotations enable row level security;
drop policy if exists annotation_read on creative_annotations;
create policy annotation_read on creative_annotations for select to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and exists(select 1 from creative_approvals a where a.id=approval_id and (public.action_allowed('editorial.view') or public.portal_client_allowed(a.client_id))));
grant select on creative_annotations to authenticated;
create or replace function public.add_creative_annotation(p_approval_id uuid,p_body text,p_x numeric default null,p_y numeric default null,p_time_seconds numeric default null)
returns public.creative_annotations language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.creative_approvals;result public.creative_annotations;
begin
 select * into a from creative_approvals where id=p_approval_id and tenant_owner_id=public.current_tenant_owner_id() for update;
 if not found or not (public.action_allowed('editorial.update') or public.portal_comment_allowed(a.client_id)) then raise exception 'Annotation refusée';end if;
 if a.status<>'A_VALIDER' then raise exception 'Cette version est clôturée';end if;
 insert into creative_annotations(approval_id,tenant_owner_id,author_id,body,x,y,time_seconds) values(a.id,a.tenant_owner_id,auth.uid(),btrim(p_body),p_x,p_y,p_time_seconds) returning * into result;
 if a.created_by<>auth.uid() then insert into notifications(tenant_owner_id,profile_id,title,body,entity_type,entity_id) values(a.tenant_owner_id,a.created_by,'Commentaire sur une création',left(p_body,200),'creative_approval',a.id);end if;
 return result;
end $$;
create or replace function public.request_editorial_review(p_editorial_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.editorial_items;result uuid;v_version integer;
begin
 if not public.action_allowed('editorial.update') then raise exception 'Envoi en validation refusé';end if;
 select * into e from editorial_items where id=p_editorial_id and tenant_owner_id=public.current_tenant_owner_id() for update;
 if not found or e.client_id is null then raise exception 'Contenu client introuvable';end if;
 select id into result from creative_approvals where editorial_item_id=e.id and status='A_VALIDER' order by version desc limit 1;
 if found then return result;end if;
 select coalesce(max(version),0)+1 into v_version from creative_approvals where editorial_item_id=e.id;
 insert into creative_approvals(tenant_owner_id,client_id,editorial_item_id,title,description,asset_url,asset_type,version,created_by)
 values(e.tenant_owner_id,e.client_id,e.id,e.title,concat_ws(E'\n\n',e.caption,e.hashtags),(e.asset_urls)[1],coalesce(e.content_type,'VISUEL'),v_version,auth.uid()) returning id into result;
 update editorial_items set status='A_VALIDER' where id=e.id;return result;
end $$;
revoke all on function request_editorial_review(uuid) from public,anon;
grant execute on function request_editorial_review(uuid) to authenticated;
revoke all on function save_client_brand(uuid,jsonb,integer),create_billing_document_once(uuid,text,jsonb),start_client_delivery(uuid,text,date,date),add_creative_annotation(uuid,text,numeric,numeric,numeric) from public,anon;
grant execute on function save_client_brand(uuid,jsonb,integer),create_billing_document_once(uuid,text,jsonb),start_client_delivery(uuid,text,date,date),add_creative_annotation(uuid,text,numeric,numeric,numeric) to authenticated;
notify pgrst,'reload schema';
commit;
