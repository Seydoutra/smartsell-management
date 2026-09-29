-- Assisted SMS onboarding: metadata is separate from Vault credentials.
begin;
create table if not exists public.tenant_sms_settings (
 tenant_owner_id uuid primary key references public.profiles(id) on delete cascade,
 organization_name text not null default '',
 sender_name text not null default '',
 status text not null default 'REQUESTED' check(status in ('REQUESTED','CONFIGURED','ACTIVE','PAUSED')),
 sid_secret_id uuid,
 token_secret_id uuid,
 updated_at timestamptz not null default now()
);
alter table public.tenant_sms_settings enable row level security;
revoke all on public.tenant_sms_settings from public,anon,authenticated;
grant all on public.tenant_sms_settings to service_role;

create or replace function public.save_tenant_sms_credentials(p_tenant uuid,p_sid text,p_token text)
returns void language plpgsql security definer set search_path=public,vault,pg_temp as $$
declare s uuid; t uuid;
begin
 select sid_secret_id,token_secret_id into s,t from public.tenant_sms_settings where tenant_owner_id=p_tenant for update;
 if not found then raise exception 'SMS configuration missing'; end if;
 if nullif(trim(p_sid),'') is not null then
  if s is null then select vault.create_secret(p_sid) into s; else perform vault.update_secret(s,p_sid); end if;
 end if;
 if nullif(trim(p_token),'') is not null then
  if t is null then select vault.create_secret(p_token) into t; else perform vault.update_secret(t,p_token); end if;
 end if;
 update public.tenant_sms_settings set sid_secret_id=s,token_secret_id=t where tenant_owner_id=p_tenant;
end $$;
create or replace function public.get_tenant_sms_credentials(p_tenant uuid)
returns table(service_id text,secret_token text,sender_name text)
language sql security definer set search_path=public,vault,pg_temp as $$
 select sid.decrypted_secret,tok.decrypted_secret,c.sender_name
 from public.tenant_sms_settings c
 join vault.decrypted_secrets sid on sid.id=c.sid_secret_id
 join vault.decrypted_secrets tok on tok.id=c.token_secret_id
 where c.tenant_owner_id=p_tenant and c.status='ACTIVE'
$$;
revoke all on function public.save_tenant_sms_credentials(uuid,text,text) from public,anon,authenticated;
revoke all on function public.get_tenant_sms_credentials(uuid) from public,anon,authenticated;
grant execute on function public.save_tenant_sms_credentials(uuid,text,text) to service_role;
grant execute on function public.get_tenant_sms_credentials(uuid) to service_role;
commit;
