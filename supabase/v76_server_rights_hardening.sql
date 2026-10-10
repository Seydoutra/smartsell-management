begin;
-- A collaborator cannot keep writing after their company's trial has ended.
create or replace function public.current_account_has_access()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select p.active and owner.active
 and (p.access_expires_at is null or p.access_expires_at>now())
 and (owner.access_expires_at is null or owner.access_expires_at>now())
 from profiles p join profiles owner on owner.id=coalesce(p.tenant_owner_id,p.id) where p.id=auth.uid()),false)
$$;
-- Central decision shared by RLS and service-role Edge Functions. Roles alone never bypass it.
create or replace function public.member_action_allowed(p_profile_id uuid,p_action text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 with required as (select case split_part(p_action,'.',1)
 when 'clients' then 'Clients' when 'projects' then 'Projets' when 'tasks' then 'Tâches'
 when 'planning' then 'Planning' when 'editorial' then 'Éditorial' when 'services' then 'Services'
 when 'suppliers' then 'Fournisseurs' when 'invoices' then 'Facturation' when 'documents' then 'Documents'
 when 'accounting' then 'Comptabilité' when 'equipment' then 'Matériel' when 'communication' then 'Communication'
 when 'team' then 'Équipe' when 'hr' then 'RH' when 'reports' then 'Rapports' when 'audit' then 'Rapports'
 when 'portal' then 'Portail client' when 'settings' then 'Paramètres entreprise' else null end module_name)
 select coalesce((select p.active and not ('CLIENT'=any(coalesce(p.roles,array[p.role])))
 and exists(select 1 from profiles owner where owner.id=coalesce(p.tenant_owner_id,p.id) and owner.active
 and (split_part(p_action,'.',2) in ('view','read') or ((p.access_expires_at is null or p.access_expires_at>now()) and (owner.access_expires_at is null or owner.access_expires_at>now()))))
 and (p.is_platform_owner or p.tenant_owner_id=p.id or exists(select 1 from user_access_controls a,required r
 where a.profile_id=p.id and r.module_name=any(a.allowed_modules)
 and not p_action=any(coalesce(a.denied_permissions,'{}'::text[]))
 and not (split_part(p_action,'.',1)||'.view')=any(coalesce(a.denied_permissions,'{}'::text[]))))
 from profiles p where p.id=p_profile_id),false)
$$;
revoke all on function public.member_action_allowed(uuid,text) from public,anon,authenticated;
grant execute on function public.member_action_allowed(uuid,text) to service_role;

-- No raw writes can bypass the atomic permission-save validator.
revoke insert,update,delete on public.user_access_controls from authenticated;
do $$begin
 if to_regprocedure('public.save_team_access_unchecked_v76(uuid,text[],jsonb)') is null then
 alter function public.save_team_access(uuid,text[],jsonb) rename to save_team_access_unchecked_v76;
 end if;
end$$;
revoke all on function public.save_team_access_unchecked_v76(uuid,text[],jsonb) from public,anon,authenticated;
create or replace function public.save_team_access(p_profile_id uuid,p_roles text[],p_access jsonb)
returns public.user_access_controls language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.user_access_controls;scope text;modname text;key text;target public.profiles;
begin
 if not current_account_has_access() or not can_manage_member(p_profile_id) then raise exception 'Gestion des droits refusée';end if;
 select * into target from profiles where id=p_profile_id;
 if auth.uid()<>current_tenant_owner_id() and not is_platform_owner() then
 select * into actor from user_access_controls where profile_id=auth.uid();
 if actor.profile_id is null then raise exception 'Droits de gestion absents';end if;
 for modname in select jsonb_array_elements_text(p_access->'allowed_modules') loop
 if not modname=any(actor.allowed_modules) then raise exception 'Vous ne pouvez pas déléguer un module auquel vous n’avez pas accès';end if;
 end loop;
 for key in select unnest(actor.denied_permissions) loop
 if not (p_access->'denied_permissions') ? key then raise exception 'Vous ne pouvez pas accorder une action qui vous est interdite';end if;
 end loop;
 if coalesce((p_access->>'max_sms_per_day')::numeric,0)>actor.max_sms_per_day
 or coalesce((p_access->>'max_emails_per_day')::numeric,0)>actor.max_emails_per_day
 or coalesce((p_access->>'max_calls_per_day')::numeric,0)>actor.max_calls_per_day
 or coalesce((p_access->>'max_export_rows')::numeric,0)>actor.max_export_rows
 or coalesce((p_access->>'max_approval_amount')::numeric,0)>actor.max_approval_amount
 or (coalesce((p_access->>'can_initiate_calls')::boolean,false) and not actor.can_initiate_calls)
 then raise exception 'Les plafonds délégués ne peuvent pas dépasser les vôtres';end if;
 end if;
 return public.save_team_access_unchecked_v76(p_profile_id,p_roles,p_access);
end$$;
revoke all on function public.save_team_access(uuid,text[],jsonb) from public,anon;
grant execute on function public.save_team_access(uuid,text[],jsonb) to authenticated;

-- Staff can read their company identity, not overwrite its settings by raw API calls.
drop policy if exists company_settings_insert_gate on company_profile;
drop policy if exists company_settings_update_gate on company_profile;
drop policy if exists company_settings_delete_gate on company_profile;
create policy company_settings_insert_gate on company_profile as restrictive for insert to authenticated with check(action_allowed('settings.update'));
create policy company_settings_update_gate on company_profile as restrictive for update to authenticated using(action_allowed('settings.update')) with check(action_allowed('settings.update'));
create policy company_settings_delete_gate on company_profile as restrictive for delete to authenticated using(false);

-- Previously broad tenant_write policies exposed the journal and ancillary tables.
do $$declare t text;op text;scope text;begin
 for t,scope in select * from (values ('communication_jobs','communication'),('communication_logs','communication'),('call_logs','communication'),('call_lists','communication'),('call_list_contacts','communication'),('equipment_movements','equipment'),('equipment_bookings','equipment'),('shoots','planning'),('shoot_members','planning'),('departments','hr'),('app_settings','settings'),('client_portal_access','portal'),('communication_providers','settings'),('client_notification_preferences','clients'),('publication_notifications','editorial'),('reminder_deliveries','tasks')) s(t,scope) loop
 if to_regclass('public.'||t) is null then continue;end if;
 foreach op in array array['select','insert','update','delete'] loop
 execute format('drop policy if exists hardening_%s on public.%I',op,t);
 if op='select' then
 execute format('create policy hardening_select on public.%I as restrictive for select to authenticated using(public.action_allowed(%L)%s)',t,scope||'.view',case when t='client_portal_access' then ' or profile_id=auth.uid()' else '' end);
 elsif op='insert' then
 execute format('create policy hardening_insert on public.%I as restrictive for insert to authenticated with check(public.action_allowed(%L))',t,scope||'.create');
 else execute format('create policy hardening_%s on public.%I as restrictive for %s to authenticated using(public.action_allowed(%L))%s',op,t,op,scope||'.'||case when t='client_portal_access' and op='delete' then 'revoke' else op end,case when op='update' then format(' with check(public.action_allowed(%L))',scope||'.update') else '' end);end if;
 end loop;
 end loop;
end$$;
-- Append-only audit: nobody can alter/delete history through the browser.
do $$declare p record;begin for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('activity_logs','user_sessions') loop
 execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;end$$;
create policy audit_read on activity_logs for select to authenticated using(tenant_owner_id=current_tenant_owner_id() and (actor_id=auth.uid() or action_allowed('audit.read')));
create policy audit_append on activity_logs for insert to authenticated with check(tenant_owner_id=current_tenant_owner_id() and actor_id=auth.uid());
create policy sessions_read on user_sessions for select to authenticated using(tenant_owner_id=current_tenant_owner_id() and (profile_id=auth.uid() or action_allowed('audit.read')));
create policy sessions_own on user_sessions for all to authenticated using(tenant_owner_id=current_tenant_owner_id() and profile_id=auth.uid()) with check(tenant_owner_id=current_tenant_owner_id() and profile_id=auth.uid());
-- Old personal AI records have no tenant column; only their author can read/write them.
do $$declare t text;key text;op text;begin
 for t,key in select * from (values('autopilot_settings','profile_id'),('autopilot_runs','requested_by'),('autopilot_actions','owner_id'),('agency_scenarios','owner_id'),('campaign_ai_drafts','owner_id'),('agency_briefings','owner_id'),('next_best_actions','owner_id')) x(t,key) loop
 if to_regclass('public.'||t) is null then continue;end if;
 execute format('drop policy if exists own_ai_scope on public.%I',t);
 execute format('create policy own_ai_scope on public.%I as restrictive for all to authenticated using(%I=auth.uid()) with check(%I=auth.uid())',t,key,key);
 end loop;
end$$;
-- Sensitive tokens and worker state are never exposed to the browser.
revoke all on public.calendar_connections from anon,authenticated;
grant select(profile_id,provider,calendar_email,connected,sync_enabled,calendar_id,updated_at) on public.calendar_connections to authenticated;
drop policy if exists own_calendar_scope on calendar_connections;
create policy own_calendar_scope on calendar_connections as restrictive for select to authenticated using(profile_id=auth.uid());
revoke insert,update,delete on public.equipment_movements,public.communication_logs,public.publication_notifications,public.reminder_deliveries from authenticated;
drop policy if exists own_notifications on notifications;
create policy own_notifications on notifications as restrictive for all to authenticated using(profile_id=auth.uid() and tenant_owner_id=current_tenant_owner_id()) with check(profile_id=auth.uid() and tenant_owner_id=current_tenant_owner_id());
drop policy if exists monitoring_owner on monitoring_preferences;
create policy monitoring_owner on monitoring_preferences as restrictive for all to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
-- Clients retain their own editorial portal; staff cannot bypass detailed actions.
drop policy if exists enforced_select on editorial_items;
create policy enforced_select on editorial_items as restrictive for select to authenticated using(action_allowed('editorial.view') or portal_client_allowed(client_id));
drop policy if exists feedback_read_gate on creative_feedback;
create policy feedback_read_gate on creative_feedback as restrictive for select to authenticated using(exists(select 1 from creative_approvals a where a.id=approval_id and (action_allowed('editorial.view') or action_allowed('portal.view') or portal_client_allowed(a.client_id))));
revoke insert,update,delete on creative_feedback from authenticated;
drop policy if exists portal_messages_gate on client_portal_messages;
create policy portal_messages_gate on client_portal_messages as restrictive for all to authenticated using(action_allowed('portal.view') or portal_client_allowed(client_id)) with check(sender_id=auth.uid() and (action_allowed('portal.update') or portal_comment_allowed(client_id)));
-- A tenant column is not enough: prevent linking an own record to another tenant's parent.
create or replace function public.guard_business_relationship_scope() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare fk record;body jsonb:=to_jsonb(new);parent_tenant uuid;v text;tenant uuid:=(body->>'tenant_owner_id')::uuid;
begin
 for fk in select parent.relname parent_table,child_col.attname child_column,parent_col.attname parent_column
 from pg_constraint c join pg_class parent on parent.oid=c.confrelid
 join pg_attribute child_col on child_col.attrelid=c.conrelid and child_col.attnum=c.conkey[1]
 join pg_attribute parent_col on parent_col.attrelid=c.confrelid and parent_col.attnum=c.confkey[1]
 where c.conrelid=tg_relid and c.contype='f' and cardinality(c.conkey)=1
 and child_col.attname in ('client_id','project_id','task_id','invoice_id','quote_id','supplier_id','template_id','source_purchase_id','category_id','equipment_id','campaign_id','group_id','request_id','approval_id','profile_id','recipient_id','assignee_id','manager_id','owner_id')
 and exists(select 1 from pg_attribute a where a.attrelid=c.confrelid and a.attname='tenant_owner_id' and not a.attisdropped)
 loop
 v:=body->>fk.child_column;if v is null then continue;end if;
 execute format('select tenant_owner_id from public.%I where %I::text=$1',fk.parent_table,fk.parent_column) into parent_tenant using v;
 if parent_tenant is distinct from tenant then raise exception 'Relation hors de votre entreprise : %',fk.child_column;end if;
 end loop;
 return new;
end$$;
revoke all on function guard_business_relationship_scope() from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['service_catalog','social_integrations','communication_jobs','communication_logs','call_logs','call_list_contacts','equipment_movements','purchase_requests','contracts','documents','clients','client_contacts','prospects','prospect_activities','projects','project_members','tasks','task_assignees','task_comments','editorial_items','editorial_comments','invoices','invoice_items','quotes','quote_items','payments','expenses','commercial_documents','commercial_document_items','equipment_bookings','shoots','shoot_members','campaigns','campaign_recipients','contact_group_members','employee_records','leave_requests','client_portal_access','client_portal_messages','creative_approvals','creative_feedback'] loop
 if to_regclass('public.'||t) is null then continue;end if;
 execute format('drop trigger if exists business_relationship_scope on public.%I',t);
 execute format('create trigger business_relationship_scope before insert or update on public.%I for each row execute function guard_business_relationship_scope()',t);
 end loop;end$$;
-- Anonymous users have no table access; public verification remains a token-limited RPC.
do $$declare t record;begin for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' loop
 execute format('revoke all on public.%I from anon',t.relname);
 end loop;end$$;
-- Trigger/internal utilities are not browser APIs. The service role still operates reminders.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.prorettype='trigger'::regtype or p.proname='rebuild_task_reminders') loop
 execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
 for f in select p.oid::regprocedure signature,has_function_privilege('authenticated',p.oid,'EXECUTE') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.prorettype<>'trigger'::regtype and p.proname not in ('verify_commercial_document','rebuild_task_reminders') loop
 if f.allowed then execute format('grant execute on function %s to authenticated',f.signature);end if;
 execute format('revoke execute on function %s from public,anon',f.signature);
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
