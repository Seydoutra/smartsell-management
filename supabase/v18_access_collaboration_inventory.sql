-- SmartSell V18 — confidentialité du dashboard, collaboration et inventaire complet.
-- Migration idempotente.

create or replace function public.action_allowed(required_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with required as (
    select case split_part(required_action, '.', 1)
      when 'clients' then 'Clients'
      when 'projects' then 'Projets'
      when 'tasks' then 'Tâches'
      when 'planning' then 'Planning'
      when 'editorial' then 'Éditorial'
      when 'services' then 'Services'
      when 'suppliers' then 'Fournisseurs'
      when 'invoices' then 'Facturation'
      when 'documents' then 'Documents'
      when 'accounting' then 'Comptabilité'
      when 'equipment' then 'Matériel'
      when 'communication' then 'Communication'
      when 'team' then 'Équipe'
      when 'hr' then 'RH'
      when 'reports' then 'Rapports'
      when 'portal' then 'Portail client'
      else null
    end as module_name
  )
  select coalesce(
    public.has_role('SUPER_ADMIN') or exists (
      select 1
      from public.user_access_controls access, required
      where access.profile_id = auth.uid()
        and required.module_name = any(access.allowed_modules)
        and not required_action = any(coalesce(access.denied_permissions, '{}'::text[]))
    ),
    false
  )
$$;

-- Les comptes historiques sans fiche de droits reçoivent un socle cohérent avec leur rôle.
insert into public.user_access_controls(profile_id,allowed_modules,can_initiate_calls,max_sms_per_day,max_emails_per_day,max_calls_per_day,max_export_rows,max_approval_amount)
select p.id,
  case
    when 'SUPER_ADMIN' = any(coalesce(p.roles,array[p.role])) then array['Clients','Projets','Tâches','Planning','Éditorial','Services','Fournisseurs','Facturation','Documents','Comptabilité','Matériel','Communication','Équipe','RH','Rapports','Jumeau numérique','Radar commercial','Studio campagnes IA','Autopilot IA','Portail client','Assistant IA']
    when 'ADMIN' = any(coalesce(p.roles,array[p.role])) then array['Clients','Projets','Tâches','Planning','Éditorial','Services','Fournisseurs','Facturation','Documents','Comptabilité','Matériel','Communication','Équipe','RH','Rapports','Portail client','Assistant IA']
    when 'MANAGER' = any(coalesce(p.roles,array[p.role])) then array['Clients','Projets','Tâches','Planning','Éditorial','Services','Fournisseurs','Facturation','Documents','Comptabilité','Matériel','Communication','Rapports','Assistant IA']
    when 'COMPTABLE' = any(coalesce(p.roles,array[p.role])) then array['Clients','Services','Fournisseurs','Facturation','Documents','Comptabilité','Rapports','Assistant IA']
    when 'COMMERCIAL' = any(coalesce(p.roles,array[p.role])) then array['Clients','Projets','Tâches','Planning','Facturation','Communication','Radar commercial','Assistant IA']
    when 'COMMUNITY_MANAGER' = any(coalesce(p.roles,array[p.role])) then array['Clients','Projets','Tâches','Planning','Éditorial','Communication','Assistant IA']
    else array['Projets','Tâches','Planning','Éditorial','Matériel','Assistant IA']
  end,
  ('SUPER_ADMIN' = any(coalesce(p.roles,array[p.role])) or 'ADMIN' = any(coalesce(p.roles,array[p.role])) or 'COMMERCIAL' = any(coalesce(p.roles,array[p.role]))),
  case when 'SUPER_ADMIN'=any(coalesce(p.roles,array[p.role])) then 1000 else 30 end,
  case when 'SUPER_ADMIN'=any(coalesce(p.roles,array[p.role])) then 2500 else 100 end,
  case when 'SUPER_ADMIN'=any(coalesce(p.roles,array[p.role])) then 100 else 15 end,
  case when 'SUPER_ADMIN'=any(coalesce(p.roles,array[p.role])) then 50000 else 2000 end,
  case when 'SUPER_ADMIN'=any(coalesce(p.roles,array[p.role])) then 999999999999 else 0 end
from public.profiles p
where not exists(select 1 from public.user_access_controls a where a.profile_id=p.id);

-- Affectations multiples, avec conservation des champs historiques principaux.
create table if not exists public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(task_id,profile_id)
);
insert into public.project_members(project_id,profile_id,role)
select id,manager_id,'RESPONSABLE' from public.projects where manager_id is not null
on conflict(project_id,profile_id) do nothing;
insert into public.task_assignees(task_id,profile_id)
select id,assignee_id from public.tasks where assignee_id is not null
on conflict(task_id,profile_id) do nothing;

alter table public.task_assignees enable row level security;
drop policy if exists task_assignees_read on public.task_assignees;
create policy task_assignees_read on public.task_assignees for select to authenticated using(public.action_allowed('tasks.view'));
drop policy if exists task_assignees_write on public.task_assignees;
drop policy if exists task_assignees_insert on public.task_assignees;
create policy task_assignees_insert on public.task_assignees as restrictive for insert to authenticated with check(public.action_allowed('tasks.create') or public.action_allowed('tasks.update'));
drop policy if exists task_assignees_update on public.task_assignees;
create policy task_assignees_update on public.task_assignees as restrictive for update to authenticated using(public.action_allowed('tasks.update')) with check(public.action_allowed('tasks.update'));
drop policy if exists task_assignees_delete on public.task_assignees;
create policy task_assignees_delete on public.task_assignees as restrictive for delete to authenticated using(public.action_allowed('tasks.update'));
drop policy if exists task_assignees_base_write on public.task_assignees;
create policy task_assignees_base_write on public.task_assignees for all to authenticated using(true) with check(true);
drop policy if exists granular_project_members_select on public.project_members;
create policy granular_project_members_select on public.project_members as restrictive for select to authenticated using(public.action_allowed('projects.view'));
drop policy if exists granular_project_members_write on public.project_members;
drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert on public.project_members as restrictive for insert to authenticated with check(public.action_allowed('projects.create') or public.action_allowed('projects.update'));
drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members as restrictive for update to authenticated using(public.action_allowed('projects.update')) with check(public.action_allowed('projects.update'));
drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members as restrictive for delete to authenticated using(public.action_allowed('projects.update'));
drop policy if exists project_members_base_write on public.project_members;
create policy project_members_base_write on public.project_members for all to authenticated using(true) with check(true);
drop policy if exists profiles_assignment_directory on public.profiles;
create policy profiles_assignment_directory on public.profiles for select to authenticated using(
  public.action_allowed('projects.view') or public.action_allowed('tasks.view') or public.action_allowed('team.view')
);

-- Inventaire : modèle, catégories configurables et mouvements entrée/sortie.
alter table public.equipment add column if not exists model text;
create table if not exists public.equipment_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
insert into public.equipment_categories(name,description) values
  ('Caméra','Boîtiers photo et vidéo'),('Objectif','Objectifs et optiques'),('Audio','Micros, enregistreurs et accessoires'),
  ('Éclairage','Lumières, flashs et modificateurs'),('Informatique','Ordinateurs et périphériques'),
  ('Téléphone','Téléphones et tablettes'),('Réseau','Routeurs et équipements réseau'),('Mobilier','Mobilier de bureau et studio'),
  ('Accessoire','Accessoires de production'),('Autre','Équipements non classés')
on conflict(name) do nothing;
alter table public.equipment add column if not exists category_id uuid references public.equipment_categories(id);
update public.equipment e set category_id=c.id from public.equipment_categories c where e.category_id is null and lower(e.category)=lower(c.name);
alter table public.equipment_movements add column if not exists reason text;
do $$ declare constraint_name text; begin
  select conname into constraint_name from pg_constraint
  where conrelid='public.equipment_movements'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%movement_type%' limit 1;
  if constraint_name is not null then execute format('alter table public.equipment_movements drop constraint %I',constraint_name); end if;
end $$;
alter table public.equipment_movements add constraint equipment_movements_type_check check(movement_type in ('SORTIE','ENTREE','RETOUR'));
alter table public.equipment_categories enable row level security;
drop policy if exists equipment_categories_read on public.equipment_categories;
create policy equipment_categories_read on public.equipment_categories for select to authenticated using(public.action_allowed('equipment.view'));
drop policy if exists equipment_categories_write on public.equipment_categories;
create policy equipment_categories_write on public.equipment_categories for all to authenticated using(public.action_allowed('equipment.create')) with check(public.action_allowed('equipment.create'));

create or replace function public.record_equipment_movement(p_equipment_id uuid,p_movement_type text,p_condition_notes text default null,p_reason text default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  if not public.action_allowed('equipment.update') then raise exception 'Permission denied'; end if;
  if p_movement_type not in ('SORTIE','ENTREE','RETOUR') then raise exception 'Invalid movement type'; end if;
  insert into public.equipment_movements(equipment_id,movement_type,handled_by,condition_notes,reason)
  values(p_equipment_id,p_movement_type,auth.uid(),p_condition_notes,p_reason) returning id into v_id;
  update public.equipment set status=case when p_movement_type='SORTIE' then 'EN_MISSION' else 'DISPONIBLE' end,
    condition=coalesce(nullif(p_condition_notes,''),condition) where id=p_equipment_id;
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),p_movement_type,'equipment',p_equipment_id,jsonb_build_object('movement_id',v_id,'reason',p_reason));
  return v_id;
end $$;
grant execute on function public.record_equipment_movement(uuid,text,text,text) to authenticated;
grant execute on function public.action_allowed(text) to authenticated;

-- Le bon d'entrée complète le bon de sortie.
do $$ declare constraint_name text; begin
  select conname into constraint_name from pg_constraint
  where conrelid='public.commercial_documents'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%kind%' limit 1;
  if constraint_name is not null then execute format('alter table public.commercial_documents drop constraint %I',constraint_name); end if;
end $$;
alter table public.commercial_documents add constraint commercial_documents_kind_check check(kind in ('BON_COMMANDE','BON_LIVRAISON','BON_VENTE','BON_SORTIE','BON_ENTREE'));
create or replace function public.create_commercial_document(
  p_kind text,p_client_id uuid,p_project_id uuid,p_expected_date date,p_currency text,p_total numeric,p_notes text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_number text;
begin
  if not public.action_allowed('documents.create') then raise exception 'Permission denied'; end if;
  v_number := case p_kind when 'BON_COMMANDE' then 'BC' when 'BON_LIVRAISON' then 'BL' when 'BON_VENTE' then 'BV' when 'BON_ENTREE' then 'BE' else 'BS' end
    ||'-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.commercial_document_seq')::text,4,'0');
  insert into public.commercial_documents(number,kind,client_id,project_id,expected_date,currency,total,notes,created_by)
  values(v_number,p_kind,p_client_id,p_project_id,p_expected_date,coalesce(p_currency,'GNF'),coalesce(p_total,0),p_notes,auth.uid()) returning id into v_id;
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'CREATE','commercial_document',v_id,jsonb_build_object('number',v_number,'kind',p_kind));
  return v_id;
end $$;

-- Les politiques fines exigent maintenant module + action.
do $$
declare item record; policy_prefix text;
begin
  for item in select * from (values
    ('clients','clients'),('projects','projects'),('tasks','tasks'),('editorial_items','editorial'),('service_catalog','services'),
    ('suppliers','suppliers'),('invoices','invoices'),('invoice_items','invoices'),('quotes','invoices'),('quote_items','invoices'),
    ('commercial_documents','documents'),('expenses','accounting'),('payments','accounting'),('equipment','equipment'),
    ('equipment_movements','equipment'),('equipment_categories','equipment')
  ) as permissions(table_name,scope)
  loop
    if to_regclass('public.'||item.table_name) is null then continue; end if;
    policy_prefix := 'granular_'||item.table_name;
    execute format('drop policy if exists %I_select on public.%I',policy_prefix,item.table_name);
    execute format('create policy %I_select on public.%I as restrictive for select to authenticated using(public.action_allowed(%L))',policy_prefix,item.table_name,item.scope||'.view');
    execute format('drop policy if exists %I_insert on public.%I',policy_prefix,item.table_name);
    execute format('create policy %I_insert on public.%I as restrictive for insert to authenticated with check(public.action_allowed(%L))',policy_prefix,item.table_name,item.scope||'.create');
    execute format('drop policy if exists %I_update on public.%I',policy_prefix,item.table_name);
    execute format('create policy %I_update on public.%I as restrictive for update to authenticated using(public.action_allowed(%L)) with check(public.action_allowed(%L))',policy_prefix,item.table_name,item.scope||'.update',item.scope||'.update');
    execute format('drop policy if exists %I_delete on public.%I',policy_prefix,item.table_name);
    execute format('create policy %I_delete on public.%I as restrictive for delete to authenticated using(public.action_allowed(%L))',policy_prefix,item.table_name,item.scope||'.delete');
    execute format('drop policy if exists granular_base_write on public.%I',item.table_name);
    execute format('create policy granular_base_write on public.%I for all to authenticated using(true) with check(true)',item.table_name);
  end loop;
end $$;
