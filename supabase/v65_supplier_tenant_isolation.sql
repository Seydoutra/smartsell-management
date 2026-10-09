-- Correct the suppliers table omitted from the original tenant migration.
begin;
alter table public.suppliers add column if not exists tenant_owner_id uuid;

do $$
declare supplier record; owners uuid[]; platform_owners uuid[];
begin
 select array_agg(distinct coalesce(tenant_owner_id,id)) into platform_owners
 from public.profiles where is_platform_owner;
 for supplier in select id from public.suppliers where tenant_owner_id is null loop
  select array_agg(distinct tenant_owner_id) into owners from (
   select tenant_owner_id from public.service_catalog where supplier_id=supplier.id
   union select tenant_owner_id from public.expenses where supplier_id=supplier.id
  ) references_to_supplier where tenant_owner_id is not null;
  if coalesce(cardinality(owners),0)>1 then
   raise exception 'Fournisseur rattaché à plusieurs espaces : résolution manuelle requise';
  elsif cardinality(owners)=1 then
   update public.suppliers set tenant_owner_id=owners[1] where id=supplier.id;
  elsif cardinality(platform_owners)=1 then
   -- Unlinked historical suppliers predate SaaS and belong to the original owner.
   update public.suppliers set tenant_owner_id=platform_owners[1] where id=supplier.id;
  else raise exception 'Propriétaire historique des fournisseurs indéterminé';
  end if;
 end loop;
end $$;
alter table public.suppliers alter column tenant_owner_id set not null;
create index if not exists suppliers_tenant_name_idx on public.suppliers(tenant_owner_id,name);
drop trigger if exists assign_tenant_owner on public.suppliers;
create trigger assign_tenant_owner before insert on public.suppliers for each row execute function public.assign_tenant_owner();
drop trigger if exists enforce_trial_write_access on public.suppliers;
create trigger enforce_trial_write_access before insert or update or delete on public.suppliers for each row execute function public.enforce_trial_write_access();

create or replace function public.guard_supplier_tenant() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if new.tenant_owner_id is distinct from old.tenant_owner_id then
  raise exception 'Entreprise du fournisseur immuable';
 end if;
 return new;
end $$;
drop trigger if exists guard_supplier_tenant on public.suppliers;
create trigger guard_supplier_tenant before update on public.suppliers for each row execute function public.guard_supplier_tenant();
alter table public.suppliers enable row level security;
do $$declare p record;begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='suppliers' loop
  execute format('drop policy %I on public.suppliers',p.policyname);
 end loop;
end $$;
create policy supplier_tenant_read on public.suppliers for select to authenticated using (
 tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('suppliers.view')
 and not public.has_role('CLIENT') and public.current_account_has_access() and not public.current_is_beta_tester());
create policy supplier_tenant_insert on public.suppliers for insert to authenticated with check (
 tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('suppliers.create')
 and not public.has_role('CLIENT') and public.current_account_has_access() and not public.current_is_beta_tester());
create policy supplier_tenant_update on public.suppliers for update to authenticated using (
 tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('suppliers.update')
 and not public.has_role('CLIENT') and public.current_account_has_access() and not public.current_is_beta_tester())
 with check(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('suppliers.update'));
create policy supplier_tenant_delete on public.suppliers for delete to authenticated using (
 tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed('suppliers.delete')
 and not public.has_role('CLIENT') and public.current_account_has_access() and not public.current_is_beta_tester());
notify pgrst,'reload schema';
commit;
