-- Achats internes et dépenses : un seul registre de charges, conversion sans doublon.
begin;
alter table public.expenses add column if not exists kind text not null default 'DEPENSE' check(kind in ('ACHAT','DEPENSE'));
alter table public.expenses add column if not exists supplier_id uuid references public.suppliers(id);
alter table public.expenses add column if not exists reference text;
alter table public.expenses add column if not exists notes text;
alter table public.expenses add column if not exists source_purchase_id uuid references public.purchase_requests(id);
create unique index if not exists expense_one_purchase on public.expenses(source_purchase_id) where source_purchase_id is not null;
create or replace function public.guard_company_expense() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$begin
 if tg_op='UPDATE' and (new.tenant_owner_id is distinct from old.tenant_owner_id or new.source_purchase_id is distinct from old.source_purchase_id or new.submitted_by is distinct from old.submitted_by) then raise exception 'Identité de la dépense immuable';end if;
 if new.supplier_id is not null and not exists(select 1 from public.suppliers where id=new.supplier_id and tenant_owner_id=new.tenant_owner_id) then raise exception 'Fournisseur hors de votre entreprise';end if;
 if new.project_id is not null and not exists(select 1 from public.projects where id=new.project_id and tenant_owner_id=new.tenant_owner_id) then raise exception 'Projet hors de votre entreprise';end if;
 if new.source_purchase_id is not null and not exists(select 1 from public.purchase_requests where id=new.source_purchase_id and tenant_owner_id=new.tenant_owner_id) then raise exception 'Achat hors de votre entreprise';end if;
 if new.description is null or trim(new.description)='' or new.currency is null or new.currency not in ('GNF','EUR','USD') or new.status is null or new.status not in ('BROUILLON','APPROUVE','REFUSE') then raise exception 'Description, devise et statut valides requis';end if;
 if new.status='APPROUVE' then new.approved_by:=auth.uid();else new.approved_by:=null;end if;
 return new;
end $$;
drop trigger if exists guard_company_expense on public.expenses;
create trigger guard_company_expense before insert or update on public.expenses for each row execute function public.guard_company_expense();
drop policy if exists tenant_write on public.expenses;
drop policy if exists tenant_select on public.expenses;
drop policy if exists company_expense_read on public.expenses;
create policy company_expense_read on public.expenses for select to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('accounting.view') and not public.has_role('CLIENT'));
drop policy if exists company_expense_insert on public.expenses;
drop policy if exists company_expense_update on public.expenses;
drop policy if exists company_expense_delete on public.expenses;
create policy company_expense_insert on public.expenses for insert to authenticated with check(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('accounting.create') and submitted_by=auth.uid() and status='BROUILLON' and source_purchase_id is null);
create policy company_expense_update on public.expenses for update to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('accounting.update')) with check(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('accounting.update'));
create policy company_expense_delete on public.expenses for delete to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('accounting.delete') and source_purchase_id is null);
-- Les demandes d'achat sont pilotées par RPC, pas par écritures REST libres.
revoke insert,update,delete on public.purchase_requests from authenticated;
drop policy if exists tenant_write on public.purchase_requests;
drop policy if exists tenant_select on public.purchase_requests;
drop policy if exists company_purchase_read on public.purchase_requests;
create policy company_purchase_read on public.purchase_requests for select to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('accounting.view') and not public.has_role('CLIENT'));
create or replace function public.company_purchase_action(p_action text,p_body jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.equipment_request_actor();r public.purchase_requests;eid uuid;amount numeric;begin
 if p_action='CREATE' then
  if not public.action_allowed('accounting.create') then raise exception 'Création non autorisée';end if;
  amount:=(p_body->>'amount')::numeric;
  if amount is null or amount<=0 or p_body->>'currency' is null or p_body->>'currency' not in ('GNF','EUR','USD') or nullif(trim(p_body->>'title'),'') is null or nullif(trim(p_body->>'justification'),'') is null then raise exception 'Objet, justification, montant positif et devise requis';end if;
  insert into public.purchase_requests(tenant_owner_id,title,justification,estimated_cost,currency,priority,status,requested_by) values(tenant,trim(p_body->>'title'),trim(p_body->>'justification'),amount,p_body->>'currency','NORMALE','EN_ATTENTE',auth.uid()) returning id into eid;return eid;
 end if;
 if not public.action_allowed('accounting.update') then raise exception 'Traitement non autorisé';end if;
 select * into r from public.purchase_requests where id=(p_body->>'id')::uuid and tenant_owner_id=tenant for update;
 if not found then raise exception 'Demande d’achat introuvable';end if;
 if p_action in ('APPROVE','REJECT') then
  if r.status not in ('EN_ATTENTE','BROUILLON') then raise exception 'Demande déjà traitée';end if;
  update public.purchase_requests set status=case when p_action='APPROVE' then 'APPROUVE' else 'REFUSE' end,approved_by=auth.uid() where id=r.id;eid:=r.id;
 elsif p_action='CONVERT' then
  select id into eid from public.expenses where source_purchase_id=r.id;
  if eid is not null then return eid;end if;
  if r.status<>'APPROUVE' then raise exception 'Approuvez d’abord la demande d’achat';end if;
  amount:=(p_body->>'amount')::numeric;
  if amount is null or amount<=0 or p_body->>'date' is null then raise exception 'Montant réel positif et date requis';end if;
  insert into public.expenses(tenant_owner_id,kind,source_purchase_id,supplier_id,reference,project_id,category,description,amount,currency,spent_on,status,submitted_by)
  values(tenant,'ACHAT',r.id,nullif(p_body->>'supplier_id','')::uuid,nullif(p_body->>'reference',''),nullif(p_body->>'project_id','')::uuid,'Achat',r.title,amount,r.currency,(p_body->>'date')::date,'BROUILLON',auth.uid()) returning id into eid;
  update public.purchase_requests set status='CONVERTI' where id=r.id;
 else raise exception 'Action d’achat inconnue';end if;
 insert into public.activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id) values(tenant,auth.uid(),'Achat '||p_action,'purchase_request',r.id);
 return eid;
end $$;
revoke all on function public.company_purchase_action(text,jsonb) from public,anon;
grant execute on function public.company_purchase_action(text,jsonb) to authenticated;
revoke all on function public.guard_company_expense() from public,anon,authenticated;
commit;
