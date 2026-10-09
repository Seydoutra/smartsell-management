-- Smart Social inside the existing Smartsell Management tenant model.
-- Additive hardening only: no organization backfill, no tenant reassignment,
-- no deleted business data, no new provider credentials or external calls.
-- Prerequisites: v34 tenant isolation + v45 portal + v47 editorial + v48 Canva
-- and granular action_allowed.
-- Review/apply separately after a backup and real JWT RLS validation.
begin;

do $$
begin
  if to_regclass('public.editorial_items') is null
    or to_regclass('public.creative_approvals') is null
    or to_regclass('public.social_integrations') is null
    or to_regprocedure('public.current_tenant_owner_id()') is null
    or to_regprocedure('public.action_allowed(text)') is null
    or to_regprocedure('public.portal_client_allowed(uuid)') is null
    or to_regprocedure('public.portal_comment_allowed(uuid)') is null then
    raise exception 'Smart Social: les migrations tenant et portail existantes sont requises';
  end if;
end $$;

alter table public.creative_approvals add column if not exists editorial_snapshot jsonb;

create or replace function public.smart_social_content_snapshot(item public.editorial_items)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
  select jsonb_build_object('title',coalesce(item.title,''),'caption',coalesce(item.caption,''),
    'hashtags',coalesce(item.hashtags,''),'production_notes',coalesce(item.production_notes,''),
    'asset_urls',coalesce(to_jsonb(item.asset_urls),'[]'::jsonb),'canva_design_id',item.canva_design_id,
    'platforms',case when coalesce(cardinality(item.platforms),0)>0 then to_jsonb(item.platforms)
      when item.platform is not null then jsonb_build_array(item.platform) else '[]'::jsonb end,
    'content_type',coalesce(item.content_type,''),'visual_title',coalesce(item.visual_title,''),
    'visual_subtitle',coalesce(item.visual_subtitle,''),'objective',coalesce(item.objective,''))
$$;

create or replace function public.smart_social_capture_approval()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.editorial_items;
begin
  if tg_op='UPDATE' then
    if new.client_id is distinct from old.client_id or new.tenant_owner_id is distinct from old.tenant_owner_id
      or (new.editorial_item_id is distinct from old.editorial_item_id and not (
        new.editorial_item_id is null and old.editorial_item_id is not null and
        not exists(select 1 from public.editorial_items where id=old.editorial_item_id)
      )) then
      raise exception 'Une validation ne peut pas être déplacée vers un autre contenu ou espace';
    end if;
    new.editorial_snapshot:=old.editorial_snapshot;
  elsif new.editorial_item_id is not null then
    select * into item from public.editorial_items where id=new.editorial_item_id;
    if not found or item.tenant_owner_id is distinct from new.tenant_owner_id
      or item.client_id is distinct from new.client_id then
      raise exception 'Publication ou client incompatible avec cet espace';
    end if;
    new.editorial_snapshot:=public.smart_social_content_snapshot(item);
  else
    new.editorial_snapshot:=null;
  end if;
  if auth.role()='authenticated' then
    if tg_op='INSERT' then new.status:='A_VALIDER';
    elsif new.status is distinct from old.status and new.status in ('APPROUVE','MODIFICATIONS_DEMANDEES')
      and not public.portal_comment_allowed(new.client_id) then
      raise exception 'La décision de validation appartient au client autorisé';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists zz_smart_social_capture_approval on public.creative_approvals;
create trigger zz_smart_social_capture_approval before insert or update on public.creative_approvals
for each row execute function public.smart_social_capture_approval();

create or replace function public.smart_social_check_editorial()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare review public.creative_approvals;
begin
  if new.client_id is not null and not exists(select 1 from public.clients c
    where c.id=new.client_id and c.tenant_owner_id=new.tenant_owner_id) then
    raise exception 'Client incompatible avec cet espace';
  end if;
  if new.project_id is not null and not exists(select 1 from public.projects p
    where p.id=new.project_id and p.tenant_owner_id=new.tenant_owner_id
      and p.client_id is not distinct from new.client_id) then
    raise exception 'Projet incompatible avec ce client et cet espace';
  end if;
  if auth.role()='authenticated' and new.client_id is not null
    and new.status in ('VALIDE_CLIENT','PLANIFIE','PUBLIE') then
    select * into review from public.creative_approvals a
      where a.editorial_item_id=new.id and a.client_id=new.client_id and a.tenant_owner_id=new.tenant_owner_id
      order by a.version desc,a.created_at desc,a.id desc limit 1;
    if not found or review.status<>'APPROUVE' or review.editorial_snapshot is null
      or review.editorial_snapshot is distinct from public.smart_social_content_snapshot(new) then
      raise exception 'Le client doit approuver la dernière version exacte avant sa diffusion';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists zz_smart_social_check_editorial on public.editorial_items;
create trigger zz_smart_social_check_editorial before insert or update on public.editorial_items
for each row execute function public.smart_social_check_editorial();

-- A manually entered reference is not an OAuth connection. Only server-side
-- connectors may write credentials, connection status or provider metrics.
create or replace function public.smart_social_check_reference()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.client_id is not null and not exists(select 1 from public.clients c
    where c.id=new.client_id and c.tenant_owner_id=new.tenant_owner_id) then
    raise exception 'Page et client incompatibles avec cet espace';
  end if;
  if tg_op='UPDATE' and new.tenant_owner_id is distinct from old.tenant_owner_id then
    raise exception 'Une connexion ne peut pas changer d’espace';
  end if;
  if auth.role()='authenticated' then
    if tg_op='INSERT' and (new.status<>'NON_CONFIGURE' or new.access_token_ref is not null
      or new.last_synced_at is not null or coalesce(new.metrics,'{}'::jsonb)<>'{}'::jsonb) then
      raise exception 'Une connexion OAuth doit être configurée côté serveur';
    elsif tg_op='UPDATE' and (old.status<>'NON_CONFIGURE'
      or row(new.status,new.metrics,new.last_synced_at,new.access_token_ref)
      is distinct from row(old.status,old.metrics,old.last_synced_at,old.access_token_ref)) then
      raise exception 'Cette connexion est gérée par son connecteur sécurisé';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists zz_smart_social_check_reference on public.social_integrations;
create trigger zz_smart_social_check_reference before insert or update on public.social_integrations
for each row execute function public.smart_social_check_reference();

-- Restrictive policies are ANDed with the existing tenant/portal policies.
-- They do not add access or allow the platform owner to cross tenants here.
drop policy if exists social_editorial_read_guard on public.editorial_items;
create policy social_editorial_read_guard on public.editorial_items as restrictive for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (
  public.action_allowed('editorial.view') or public.portal_client_allowed(client_id)));
drop policy if exists social_editorial_insert_guard on public.editorial_items;
create policy social_editorial_insert_guard on public.editorial_items as restrictive for insert to authenticated
with check (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('editorial.create'));
drop policy if exists social_editorial_update_guard on public.editorial_items;
create policy social_editorial_update_guard on public.editorial_items as restrictive for update to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('editorial.update'))
with check (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('editorial.update'));
drop policy if exists social_editorial_delete_guard on public.editorial_items;
create policy social_editorial_delete_guard on public.editorial_items as restrictive for delete to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('editorial.delete'));

drop policy if exists social_approval_read_guard on public.creative_approvals;
create policy social_approval_read_guard on public.creative_approvals as restrictive for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (
  public.action_allowed('editorial.view') or public.action_allowed('portal.view') or public.portal_client_allowed(client_id)));
drop policy if exists social_approval_insert_guard on public.creative_approvals;
create policy social_approval_insert_guard on public.creative_approvals as restrictive for insert to authenticated
with check (tenant_owner_id=public.current_tenant_owner_id() and (
  public.action_allowed('editorial.update') or public.action_allowed('portal.create')));
drop policy if exists social_approval_update_guard on public.creative_approvals;
create policy social_approval_update_guard on public.creative_approvals as restrictive for update to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and (
  public.action_allowed('editorial.update') or public.action_allowed('portal.update')))
with check (tenant_owner_id=public.current_tenant_owner_id() and (
  public.action_allowed('editorial.update') or public.action_allowed('portal.update')));
drop policy if exists social_approval_delete_guard on public.creative_approvals;
create policy social_approval_delete_guard on public.creative_approvals as restrictive for delete to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('editorial.delete'));

drop policy if exists social_reference_read_guard on public.social_integrations;
create policy social_reference_read_guard on public.social_integrations as restrictive for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('communication.view'));
drop policy if exists social_reference_insert_guard on public.social_integrations;
create policy social_reference_insert_guard on public.social_integrations as restrictive for insert to authenticated
with check (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('communication.create'));
drop policy if exists social_reference_update_guard on public.social_integrations;
create policy social_reference_update_guard on public.social_integrations as restrictive for update to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('communication.update'))
with check (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('communication.update'));
drop policy if exists social_reference_delete_guard on public.social_integrations;
create policy social_reference_delete_guard on public.social_integrations as restrictive for delete to authenticated
using (tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('communication.delete') and status='NON_CONFIGURE');

revoke all on function public.smart_social_capture_approval(),public.smart_social_check_editorial(),public.smart_social_check_reference(),public.smart_social_content_snapshot(public.editorial_items) from public;
grant execute on function public.smart_social_content_snapshot(public.editorial_items) to authenticated,service_role;
commit;
