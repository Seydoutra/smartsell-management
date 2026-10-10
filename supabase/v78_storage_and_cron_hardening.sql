alter type public.communication_status add value if not exists 'PROCESSING';
begin;
-- Reserve daily quota and durable log entries in one transaction, including campaigns.
create or replace function public.reserve_communication_dispatch(p_actor uuid,p_channel text,p_recipients text[],p_campaign uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p profiles;cap integer;used integer;ids jsonb;
begin
 if not member_action_allowed(p_actor,'communication.send') then raise exception 'Envoi non autorisé';end if;
 select * into p from profiles where id=p_actor;
 if p_channel not in ('SMS','EMAIL') or cardinality(p_recipients) not between 1 and 250 or array_position(p_recipients,null) is not null then raise exception 'Destinataires invalides';end if;
 if exists(select 1 from unnest(p_recipients) address where length(trim(address)) not between 3 and 320) then raise exception 'Adresse de destinataire invalide';end if;
 if p_campaign is not null and not exists(select 1 from campaigns where id=p_campaign and tenant_owner_id=p.tenant_owner_id and created_by=p_actor) then raise exception 'Campagne hors de votre entreprise';end if;
 perform pg_advisory_xact_lock(hashtext(p_actor::text||':'||p_channel));
 if not coalesce(p.is_platform_owner,false) and p.tenant_owner_id<>p.id then
 select case when p_channel='SMS' then max_sms_per_day else max_emails_per_day end into cap from user_access_controls where profile_id=p_actor;
 select count(*) into used from communication_logs where sent_by=p_actor and channel=p_channel and sent_at>=date_trunc('day',now()) and status in ('QUEUED','SENT','DELIVERED');
 if used+cardinality(p_recipients)>coalesce(cap,0) then raise exception 'Limite quotidienne de % % atteinte',coalesce(cap,0),p_channel;end if;
 end if;
 with reserved as (insert into communication_logs(tenant_owner_id,channel,recipient,campaign_id,status,sent_by,metadata) select p.tenant_owner_id,p_channel,address,p_campaign,'QUEUED',p_actor,jsonb_build_object('reservation',true) from unnest(p_recipients) address returning id)
 select jsonb_agg(id) into ids from reserved;
 return ids;
end$$;
revoke all on function public.reserve_communication_dispatch(uuid,text,text[],uuid) from public,anon,authenticated;
grant execute on function public.reserve_communication_dispatch(uuid,text,text[],uuid) to service_role;
-- Remove the old unrestricted authenticated read and role-based write policies.
-- Existing objects retain their filenames, ownership and attachments.
create or replace function public.workspace_file_allowed(p_bucket text,p_name text,p_owner text,p_write boolean)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare scope text;target text;
begin
 if auth.uid() is null or current_is_beta_tester() then return false;end if;
 if p_write and not current_account_has_access() then return false;end if;
 if not exists(select 1 from profiles where id::text=p_owner and tenant_owner_id=current_tenant_owner_id()) then return false;end if;
 scope:=case p_bucket when 'avatars' then case when p_name like 'branding/%' then 'settings' when p_name like 'profiles/%' then 'team' else 'clients' end
 when 'editorial-assets' then 'editorial' when 'client-files' then 'clients' when 'project-files' then 'projects'
 when 'expense-receipts' then 'accounting' when 'equipment-photos' then 'equipment' when 'contracts' then 'documents' when 'payments' then 'invoices' else null end;
 if scope is null then return false;end if;
 if p_bucket='avatars' and p_name like 'profiles/%' then
 target:=split_part(p_name,'/',2);
 if not exists(select 1 from profiles where id::text=target and tenant_owner_id=current_tenant_owner_id()) then return false;end if;
 if target=auth.uid()::text then return true;end if;
 end if;
 if scope='settings' and not p_write then return true;end if;
 return case when p_write then action_allowed(scope||'.update') or action_allowed(scope||'.create') else action_allowed(scope||'.view') end;
end$$;
revoke all on function public.workspace_file_allowed(text,text,text,boolean) from public,anon;
grant execute on function public.workspace_file_allowed(text,text,text,boolean) to authenticated;
drop policy if exists authenticated_storage_read on storage.objects;
drop policy if exists authenticated_storage_write on storage.objects;
drop policy if exists workspace_files_read on storage.objects;
drop policy if exists workspace_files_insert on storage.objects;
drop policy if exists workspace_files_update on storage.objects;
drop policy if exists workspace_files_delete on storage.objects;
create policy workspace_files_read on storage.objects for select to authenticated using(bucket_id<>'equipment-evidence' and workspace_file_allowed(bucket_id,name,owner_id,false));
create policy workspace_files_insert on storage.objects for insert to authenticated with check(bucket_id<>'equipment-evidence' and owner_id=auth.uid()::text and workspace_file_allowed(bucket_id,name,owner_id,true));
-- Generic attachments are immutable: upload a new file, never silently replace evidence.
create policy workspace_files_update on storage.objects for update to authenticated using(false) with check(false);
create policy workspace_files_delete on storage.objects for delete to authenticated using(false);
-- Reuse the existing Vault-protected invocation, not the publicly known anon key.
do $$declare source text;j record;command text;body text;begin
 select c.command into source from cron.job c where jobname='smartsell-task-reminders' and active and c.command like '%vault%' limit 1;
 if source is null or source!~'body\s*:=\s*''[^'']*''::jsonb' then raise exception 'Invocation sécurisée des rappels introuvable';end if;
 for j in select jobname,schedule from cron.job where jobname in ('smartsell-campaign-dispatch','smartsell-team-evening-digest','smartsell-team-weekly-digest') loop
 body:=case j.jobname when 'smartsell-team-weekly-digest' then '{"kind":"WEEKLY"}' when 'smartsell-team-evening-digest' then '{"kind":"EVENING"}' else '{}' end;
 command:=replace(source,'task-reminders',case when j.jobname='smartsell-campaign-dispatch' then 'campaign-dispatch' else 'team-digest' end);
 command:=regexp_replace(command,'body\s*:=\s*''[^'']*''::jsonb','body := '||quote_literal(body)||'::jsonb');
 perform cron.schedule(j.jobname,j.schedule,command);
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
