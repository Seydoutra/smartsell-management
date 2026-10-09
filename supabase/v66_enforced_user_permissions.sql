begin;
-- A role is not an exemption. Only the actual workspace/platform owner bypasses overrides.
create or replace function public.member_action_allowed(p_profile_id uuid,p_action text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 with required as (select case split_part(p_action,'.',1)
 when 'clients' then 'Clients' when 'projects' then 'Projets' when 'tasks' then 'Tâches'
 when 'planning' then 'Planning' when 'editorial' then 'Éditorial' when 'services' then 'Services'
 when 'suppliers' then 'Fournisseurs' when 'invoices' then 'Facturation' when 'documents' then 'Documents'
 when 'accounting' then 'Comptabilité' when 'equipment' then 'Matériel' when 'communication' then 'Communication'
 when 'team' then 'Équipe' when 'hr' then 'RH' when 'reports' then 'Rapports' when 'audit' then 'Rapports'
 when 'portal' then 'Portail client' else null end module_name)
 select coalesce((select p.active and not ('CLIENT'=any(coalesce(p.roles,array[p.role]))) and (
 p.is_platform_owner or p.tenant_owner_id=p.id or exists(select 1 from user_access_controls a,required r
 where a.profile_id=p.id and r.module_name=any(a.allowed_modules)
 and not p_action=any(coalesce(a.denied_permissions,'{}'::text[]))
 and not (split_part(p_action,'.',1)||'.view')=any(coalesce(a.denied_permissions,'{}'::text[]))))
 from profiles p where p.id=p_profile_id),false)
$$;
-- Avoid dependence on the caller's role when checking another profile from an Edge Function.
create or replace function public.has_client_role(p_profile_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select 'CLIENT'=any(coalesce(roles,array[role])) from profiles where id=p_profile_id),false)
$$;
create or replace function public.action_allowed(required_action text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select public.member_action_allowed(auth.uid(),required_action)
$$;
revoke all on function public.member_action_allowed(uuid,text) from public,anon,authenticated;
grant execute on function public.member_action_allowed(uuid,text) to service_role;
revoke all on function public.has_client_role(uuid) from public,anon,authenticated;
revoke all on function public.action_allowed(text) from public,anon;
grant execute on function public.action_allowed(text) to authenticated;

create or replace function public.can_manage_member(p_target uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(exists(select 1 from profiles actor join profiles target on target.id=p_target
 where actor.id=auth.uid() and actor.active
 and target.tenant_owner_id=public.current_tenant_owner_id()
 and (actor.is_platform_owner or actor.tenant_owner_id=actor.id or (
 public.action_allowed('team.update') and target.id<>actor.id
 and target.id<>target.tenant_owner_id and not target.is_platform_owner))),false)
$$;
revoke all on function public.can_manage_member(uuid) from public,anon;
grant execute on function public.can_manage_member(uuid) to authenticated;

-- Replace permissive self-edit access: a collaborator must not grant themselves rights.
do $$declare p record;begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='user_access_controls' loop
 execute format('drop policy %I on public.user_access_controls',p.policyname);end loop;
end $$;
create policy access_controls_read on public.user_access_controls for select to authenticated using(
 profile_id=auth.uid() or public.can_manage_member(profile_id));
create policy access_controls_write on public.user_access_controls for all to authenticated using(
 public.can_manage_member(profile_id)) with check(public.can_manage_member(profile_id));
-- Account creation/deletion goes through authenticated server workflows, never raw profile writes.
drop policy if exists enforced_profile_insert on public.profiles;
create policy enforced_profile_insert on public.profiles as restrictive for insert to authenticated with check(false);
drop policy if exists enforced_profile_delete on public.profiles;
create policy enforced_profile_delete on public.profiles as restrictive for delete to authenticated using(false);

create or replace function public.guard_member_privileges() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then return coalesce(new,old);end if;
 if tg_table_name='user_access_controls' then
  if tg_op='UPDATE' and (new.profile_id is distinct from old.profile_id or new.tenant_owner_id is distinct from old.tenant_owner_id) then raise exception 'Identité des droits immuable';end if;
  if not public.can_manage_member(case when tg_op='DELETE' then old.profile_id else new.profile_id end) then raise exception 'Modification des droits non autorisée';end if;
 else
  if new.tenant_owner_id is distinct from old.tenant_owner_id or new.is_platform_owner is distinct from old.is_platform_owner then raise exception 'Propriété du compte immuable';end if;
  if (new.role is distinct from old.role or new.roles is distinct from old.roles or new.active is distinct from old.active or new.is_beta_tester is distinct from old.is_beta_tester)
  and not public.can_manage_member(old.id) then raise exception 'Modification des privilèges non autorisée';end if;
 end if;
 return coalesce(new,old);
end $$;
drop trigger if exists guard_member_privileges on public.profiles;
create trigger guard_member_privileges before update on public.profiles for each row execute function public.guard_member_privileges();
drop trigger if exists guard_member_privileges on public.user_access_controls;
create trigger guard_member_privileges before insert or update or delete on public.user_access_controls for each row execute function public.guard_member_privileges();

-- Restore restrictive CRUD gates lost when tenant policies were replaced.
do $$declare item record; op text; required text; read_clause text;begin
 for item in select * from (values
 ('clients','clients'),('client_contacts','clients'),('prospects','clients'),('prospect_activities','clients'),
 ('projects','projects'),('project_members','projects'),('tasks','tasks'),('task_comments','tasks'),('task_assignees','tasks'),
 ('editorial_items','editorial'),('editorial_comments','editorial'),('service_catalog','services'),('services','services'),
 ('invoices','invoices'),('invoice_items','invoices'),('quotes','invoices'),('quote_items','invoices'),
 ('commercial_documents','documents'),('commercial_document_items','documents'),('documents','documents'),('contracts','documents'),
 ('expenses','accounting'),('purchase_requests','accounting'),('equipment','equipment'),('equipment_categories','equipment'),
 ('employee_records','hr'),('leave_requests','hr'),('social_integrations','communication'),
 ('campaigns','communication'),('campaign_recipients','communication'),('communication_templates','communication'),
 ('contact_groups','communication'),('contact_group_members','communication')) as t(table_name,scope) loop
  if to_regclass('public.'||item.table_name) is null then continue;end if;
  read_clause:=format('public.action_allowed(%L)',item.scope||'.view');
  -- The existing client portal policies still narrow these reads to the client's own records.
  if item.table_name in ('clients','projects','invoices') then read_clause:=read_clause||' or public.has_role(''CLIENT'')';end if;
  if item.table_name='invoice_items' then read_clause:=read_clause||' or (public.has_role(''CLIENT'') and exists(select 1 from public.invoices i where i.id=invoice_items.invoice_id))';end if;
  foreach op in array array['select','insert','update','delete'] loop
   execute format('drop policy if exists enforced_%s on public.%I',op,item.table_name);
   required:=item.scope||'.'||case op when 'select' then 'view' when 'insert' then 'create' else op end;
   if item.table_name in ('task_assignees','project_members') and op in ('insert','delete') then
    if op='insert' then execute format('create policy enforced_insert on public.%I as restrictive for insert to authenticated with check(public.action_allowed(%L) or public.action_allowed(%L))',item.table_name,item.scope||'.create',item.scope||'.update');
    else execute format('create policy enforced_delete on public.%I as restrictive for delete to authenticated using(public.action_allowed(%L))',item.table_name,item.scope||'.update');end if;
   elsif op='select' then execute format('create policy enforced_select on public.%I as restrictive for select to authenticated using(%s)',item.table_name,read_clause);
   elsif op='insert' then execute format('create policy enforced_insert on public.%I as restrictive for insert to authenticated with check(public.action_allowed(%L))',item.table_name,required);
   else execute format('create policy enforced_%s on public.%I as restrictive for %s to authenticated using(public.action_allowed(%L))%s',op,item.table_name,op,required,case when op='update' then format(' with check(public.action_allowed(%L))',required) else '' end);end if;
  end loop;
 end loop;
end $$;

drop policy if exists enforced_select on public.payments;
create policy enforced_select on public.payments as restrictive for select to authenticated using(public.action_allowed('invoices.view') or public.action_allowed('accounting.view') or public.has_role('CLIENT'));
drop policy if exists enforced_insert on public.payments;
create policy enforced_insert on public.payments as restrictive for insert to authenticated with check(public.action_allowed('invoices.update'));
drop policy if exists enforced_update on public.payments;
create policy enforced_update on public.payments as restrictive for update to authenticated using(public.action_allowed('invoices.update')) with check(public.action_allowed('invoices.update'));
drop policy if exists enforced_delete on public.payments;
create policy enforced_delete on public.payments as restrictive for delete to authenticated using(public.action_allowed('invoices.delete'));

-- Atomic roles + overrides save, acknowledged only after the transaction succeeds.
create or replace function public.save_team_access(p_profile_id uuid,p_roles text[],p_access jsonb)
returns public.user_access_controls language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.profiles; result public.user_access_controls; primary_role public.app_role;tenant uuid:=public.current_tenant_owner_id();
begin
 if not public.can_manage_member(p_profile_id) then raise exception 'Gestion des droits refusée';end if;
 select * into target from profiles where id=p_profile_id for update;
 if cardinality(p_roles) is null or cardinality(p_roles)=0 or array_position(p_roles,null) is not null then raise exception 'Choisissez au moins un rôle valide';end if;
 if not p_roles<@array['SUPER_ADMIN','ADMIN','MANAGER','CHEF_DE_PROJET','COMMERCIAL','COMMUNITY_MANAGER','COMPTABLE','DEVELOPPEUR','GRAPHISTE','VIDEASTE','PHOTOGRAPHE','COLLABORATEUR']::text[] then raise exception 'Rôle invalide';end if;
 if 'SUPER_ADMIN'=any(p_roles) and auth.uid()<>tenant and not public.is_platform_owner() then raise exception 'Seul le propriétaire peut attribuer ce rôle';end if;
 select candidate::public.app_role into primary_role from unnest(array['SUPER_ADMIN','ADMIN','MANAGER','CHEF_DE_PROJET','COMMERCIAL','COMMUNITY_MANAGER','COMPTABLE','DEVELOPPEUR','GRAPHISTE','VIDEASTE','PHOTOGRAPHE','COLLABORATEUR']) with ordinality as r(candidate,rank) where candidate=any(p_roles) order by rank limit 1;
 if jsonb_typeof(p_access->'allowed_modules') is distinct from 'array' or jsonb_typeof(p_access->'denied_permissions') is distinct from 'array' then raise exception 'Liste de droits invalide';end if;
 insert into user_access_controls(profile_id,tenant_owner_id,allowed_modules,denied_permissions,can_initiate_calls,max_sms_per_day,max_emails_per_day,max_calls_per_day,max_export_rows,max_approval_amount,updated_by)
 values(p_profile_id,tenant,array(select jsonb_array_elements_text(p_access->'allowed_modules')),array(select jsonb_array_elements_text(p_access->'denied_permissions')),
 coalesce((p_access->>'can_initiate_calls')::boolean,false),greatest(0,(p_access->>'max_sms_per_day')::integer),greatest(0,(p_access->>'max_emails_per_day')::integer),greatest(0,(p_access->>'max_calls_per_day')::integer),greatest(0,(p_access->>'max_export_rows')::integer),greatest(0,(p_access->>'max_approval_amount')::numeric),auth.uid())
 on conflict(profile_id) do update set allowed_modules=excluded.allowed_modules,denied_permissions=excluded.denied_permissions,can_initiate_calls=excluded.can_initiate_calls,max_sms_per_day=excluded.max_sms_per_day,max_emails_per_day=excluded.max_emails_per_day,max_calls_per_day=excluded.max_calls_per_day,max_export_rows=excluded.max_export_rows,max_approval_amount=excluded.max_approval_amount,updated_by=excluded.updated_by returning * into result;
 update profiles set roles=p_roles::public.app_role[],role=primary_role where id=p_profile_id;
 insert into activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id,metadata) values(tenant,auth.uid(),'Droits utilisateur modifiés','profile',p_profile_id,jsonb_build_object('roles',p_roles,'allowed_modules',result.allowed_modules,'denied_permissions',result.denied_permissions));
 return result;
end $$;
revoke all on function public.save_team_access(uuid,text[],jsonb) from public,anon;
grant execute on function public.save_team_access(uuid,text[],jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
