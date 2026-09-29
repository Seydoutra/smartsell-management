-- SmartSell V34 — isolation réelle des espaces SaaS.
-- Les données historiques sont rattachées au propriétaire actuel.
-- Les nouveaux comptes commencent dans un espace vide.
begin;

alter table public.profiles add column if not exists tenant_owner_id uuid;
alter table public.profiles add column if not exists is_platform_owner boolean not null default false;

do $$
declare owner_id uuid;
begin
  select id into owner_id from public.profiles
  where role = 'SUPER_ADMIN' and coalesce(is_temporary,false) = false
  order by created_at asc limit 1;
  if owner_id is null then
    select id into owner_id from public.profiles order by created_at asc limit 1;
  end if;
  update public.profiles
    set tenant_owner_id = case when coalesce(is_temporary,false) then id else coalesce(tenant_owner_id, owner_id) end,
        is_platform_owner = (id = owner_id)
    where tenant_owner_id is null or is_platform_owner <> (id = owner_id);
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'departments','app_settings','company_profile','clients','client_contacts','prospects','prospect_activities',
    'projects','project_members','tasks','task_assignees','task_comments','shoots','shoot_members',
    'editorial_items','editorial_comments','quotes','quote_items','invoices','invoice_items','payments','expenses',
    'equipment','equipment_categories','equipment_bookings','equipment_movements','purchase_requests','contracts','documents',
    'notifications','activity_logs','user_sessions','monitoring_preferences','communication_providers','communication_templates',
    'campaigns','campaign_recipients','communication_jobs','communication_logs','client_notification_preferences',
    'publication_notifications','user_access_controls','call_logs','service_catalog','commercial_documents','commercial_document_items',
    'employee_records','leave_requests','client_portal_access','social_integrations','calendar_connections','reminder_deliveries',
    'task_reminder_schedule','team_digest_deliveries','contact_groups','contact_group_members','call_lists','call_list_contacts'
  ] loop
    if to_regclass('public.'||table_name) is not null then
      execute format('alter table public.%I add column if not exists tenant_owner_id uuid', table_name);
      execute format('update public.%I set tenant_owner_id = (select p.tenant_owner_id from public.profiles p where p.is_platform_owner = true limit 1) where tenant_owner_id is null', table_name);
    end if;
  end loop;
end $$;

create or replace function public.current_tenant_owner_id() returns uuid
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(p.tenant_owner_id,p.id) from public.profiles p where p.id=auth.uid()
$$;

create or replace function public.is_platform_owner() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select is_platform_owner from public.profiles where id=auth.uid()),false)
$$;

create or replace function public.assign_tenant_owner() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid;
begin
  if new.tenant_owner_id is null then
    select coalesce(p.tenant_owner_id,p.id) into owner_id from public.profiles p where p.id=auth.uid();
    new.tenant_owner_id := coalesce(owner_id, case when tg_table_name='profiles' then new.id else null end);
  end if;
  return new;
end $$;

drop trigger if exists assign_tenant_owner on public.profiles;
create trigger assign_tenant_owner before insert on public.profiles for each row execute function public.assign_tenant_owner();

do $$
declare table_name text; policy_row record;
begin
  foreach table_name in array array[
    'departments','app_settings','company_profile','clients','client_contacts','prospects','prospect_activities',
    'projects','project_members','tasks','task_assignees','task_comments','shoots','shoot_members',
    'editorial_items','editorial_comments','quotes','quote_items','invoices','invoice_items','payments','expenses',
    'equipment','equipment_categories','equipment_bookings','equipment_movements','purchase_requests','contracts','documents',
    'notifications','activity_logs','user_sessions','monitoring_preferences','communication_providers','communication_templates',
    'campaigns','campaign_recipients','communication_jobs','communication_logs','client_notification_preferences',
    'publication_notifications','user_access_controls','call_logs','service_catalog','commercial_documents','commercial_document_items',
    'employee_records','leave_requests','client_portal_access','social_integrations','calendar_connections','reminder_deliveries',
    'task_reminder_schedule','team_digest_deliveries','contact_groups','contact_group_members','call_lists','call_list_contacts'
  ] loop
    if to_regclass('public.'||table_name) is null then continue; end if;
    execute format('drop trigger if exists assign_tenant_owner on public.%I',table_name);
    execute format('create trigger assign_tenant_owner before insert on public.%I for each row execute function public.assign_tenant_owner()',table_name);
    execute format('alter table public.%I enable row level security',table_name);
    for policy_row in select policyname from pg_policies where schemaname='public' and tablename=table_name loop
      execute format('drop policy if exists %I on public.%I',policy_row.policyname,table_name);
    end loop;
    if table_name = 'activity_logs' then
      execute format('create policy tenant_select on public.%I for select to authenticated using (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id() and actor_id=auth.uid()))',table_name);
      execute format('create policy tenant_write on public.%I for all to authenticated using (tenant_owner_id=public.current_tenant_owner_id()) with check (tenant_owner_id=public.current_tenant_owner_id())',table_name);
    elsif table_name = 'user_sessions' then
      execute format('create policy tenant_select on public.%I for select to authenticated using (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid()))',table_name);
      execute format('create policy tenant_write on public.%I for all to authenticated using (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid()) with check (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid())',table_name);
    elsif table_name = 'notifications' then
      execute format('create policy tenant_select on public.%I for select to authenticated using (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid()))',table_name);
      execute format('create policy tenant_write on public.%I for all to authenticated using (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid()) with check (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid())',table_name);
    elsif table_name = 'monitoring_preferences' then
      execute format('create policy tenant_all on public.%I for all to authenticated using (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid()) with check (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid())',table_name);
    elsif table_name = 'user_access_controls' then
      execute format('create policy tenant_all on public.%I for all to authenticated using (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid())) with check (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id() and profile_id=auth.uid()))',table_name);
    else
      execute format('create policy tenant_select on public.%I for select to authenticated using (tenant_owner_id=public.current_tenant_owner_id())',table_name);
      execute format('create policy tenant_write on public.%I for all to authenticated using (tenant_owner_id=public.current_tenant_owner_id()) with check (tenant_owner_id=public.current_tenant_owner_id())',table_name);
    end if;
  end loop;
end $$;

drop policy if exists own_profile on public.profiles;
drop policy if exists admin_profiles on public.profiles;
create policy tenant_profiles_select on public.profiles for select to authenticated using (public.is_platform_owner() or tenant_owner_id=public.current_tenant_owner_id());
create policy tenant_profiles_write on public.profiles for all to authenticated using (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id() and id=auth.uid())) with check (public.is_platform_owner() or (tenant_owner_id=public.current_tenant_owner_id() and id=auth.uid()));

revoke all on function public.current_tenant_owner_id() from public;
revoke all on function public.is_platform_owner() from public;
grant execute on function public.current_tenant_owner_id() to authenticated,service_role;
grant execute on function public.is_platform_owner() to authenticated,service_role;

commit;
