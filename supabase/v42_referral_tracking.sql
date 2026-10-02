-- Referral attribution only. Rewards require a verified paid invoice and an
-- owner-approved commercial rule; signup alone never grants a discount.
begin;
create table if not exists public.referral_codes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^[A-F0-9]{10}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.referral_signups (
  referred_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  status text not null default 'SIGNED_UP' check (status in ('SIGNED_UP','CONVERTED')),
  created_at timestamptz not null default now(),
  converted_at timestamptz,
  check (referred_id<>referrer_id)
);
create index if not exists referral_signups_referrer_idx on public.referral_signups(referrer_id,created_at desc);
alter table public.referral_codes enable row level security;
alter table public.referral_signups enable row level security;
drop policy if exists referral_codes_own on public.referral_codes;
create policy referral_codes_own on public.referral_codes for select to authenticated using (profile_id=auth.uid() or public.is_platform_owner());
drop policy if exists referral_signups_own on public.referral_signups;
create policy referral_signups_own on public.referral_signups for select to authenticated using (referrer_id=auth.uid() or referred_id=auth.uid() or public.is_platform_owner());
grant select on public.referral_codes,public.referral_signups to authenticated;

create or replace function public.get_or_create_referral_code() returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare result text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select code into result from public.referral_codes where profile_id=auth.uid();
  if result is not null then return result; end if;
  result:=upper(substr(encode(gen_random_bytes(8),'hex'),1,10));
  insert into public.referral_codes(profile_id,code) values(auth.uid(),result)
  on conflict(profile_id) do update set code=public.referral_codes.code
  returning code into result;
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
  select profile_id into sponsor from public.referral_codes where code=p_code;
  if sponsor is null or sponsor=auth.uid() then return false; end if;
  insert into public.referral_signups(referred_id,referrer_id,code)
  values(auth.uid(),sponsor,p_code) on conflict(referred_id) do nothing;
  return true;
end $$;

create or replace function public.my_referral_summary() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'code',(select code from public.referral_codes where profile_id=auth.uid()),
    'signups',(select count(*) from public.referral_signups where referrer_id=auth.uid()),
    'converted',(select count(*) from public.referral_signups where referrer_id=auth.uid() and status='CONVERTED')
  )
$$;
revoke all on function public.get_or_create_referral_code(),public.claim_referral_code(text),public.my_referral_summary() from public;
grant execute on function public.get_or_create_referral_code(),public.claim_referral_code(text),public.my_referral_summary() to authenticated;
commit;
