-- SmartSell v11 — compte bêta isolé de toutes les données métier réelles.
alter table public.profiles add column if not exists is_beta_tester boolean not null default false;

create or replace function public.current_is_beta_tester()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_beta_tester from public.profiles where id = auth.uid()), false)
$$;

-- Une politique restrictive s'ajoute aux règles existantes : un profil bêta ne
-- peut ni lire ni écrire les tables métier, même en fabriquant une requête API.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'departments','app_settings','company_profile','clients','client_contacts','prospects','prospect_activities',
    'projects','project_members','tasks','task_comments','shoots','shoot_members','editorial_items','editorial_comments',
    'quotes','quote_items','invoices','invoice_items','payments','expenses','equipment','equipment_bookings',
    'equipment_movements','purchase_requests','contracts','documents','notifications','activity_logs','user_sessions',
    'monitoring_preferences','communication_providers','user_access_controls','call_logs','communication_templates',
    'campaigns','campaign_recipients','communication_jobs','communication_logs','client_notification_preferences',
    'publication_notifications','service_catalog','commercial_documents','suppliers','calendar_connections',
    'reminder_deliveries','employee_records','leave_requests','client_portal_access'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists beta_sandbox_isolation on public.%I', table_name);
      execute format('create policy beta_sandbox_isolation on public.%I as restrictive for all to authenticated using (not public.current_is_beta_tester()) with check (not public.current_is_beta_tester())', table_name);
    end if;
  end loop;
end $$;

drop policy if exists beta_sandbox_storage_isolation on storage.objects;
create policy beta_sandbox_storage_isolation on storage.objects as restrictive for all to authenticated
using (not public.current_is_beta_tester())
with check (not public.current_is_beta_tester());

grant execute on function public.current_is_beta_tester() to authenticated;
