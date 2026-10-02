-- Only workspace owners can sponsor another workspace.
begin;
create or replace function public.get_or_create_referral_code() returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare result text;
begin
  if auth.uid() is null or not exists(
    select 1 from public.profiles where id=auth.uid() and tenant_owner_id=id
  ) then raise exception 'Seul le responsable de cet espace peut parrainer'; end if;
  select code into result from public.referral_codes where profile_id=auth.uid();
  if result is not null then return result; end if;
  result:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  insert into public.referral_codes(profile_id,code) values(auth.uid(),result)
  on conflict(profile_id) do update set code=public.referral_codes.code returning code into result;
  return result;
end $$;

create or replace function public.claim_referral_code(p_code text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare sponsor uuid; registrant public.profiles;
begin
  if auth.uid() is null or p_code !~ '^[A-F0-9]{10}$' then return false; end if;
  select * into registrant from public.profiles where id=auth.uid();
  if not found or not registrant.is_temporary or registrant.tenant_owner_id<>registrant.id
     or registrant.created_at<now()-interval '30 days' then return false; end if;
  select c.profile_id into sponsor from public.referral_codes c
  join public.profiles p on p.id=c.profile_id and p.tenant_owner_id=p.id
  where c.code=p_code;
  if sponsor is null or sponsor=auth.uid() then return false; end if;
  insert into public.referral_signups(referred_id,referrer_id,code)
  values(auth.uid(),sponsor,p_code) on conflict(referred_id) do nothing;
  return true;
end $$;
commit;
