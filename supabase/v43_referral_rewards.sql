-- Referral rewards are accounting entitlements, never granted for signup alone.
begin;

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','REDEEMED')),
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_request_id uuid unique references public.subscription_requests(id),
  check (referrer_id <> referred_id)
);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards(referrer_id,status,created_at);
alter table public.referral_rewards enable row level security;
create policy referral_rewards_read on public.referral_rewards for select to authenticated
using (referrer_id=auth.uid() or public.is_platform_owner());
grant select on public.referral_rewards to authenticated;

alter table public.subscription_requests add column if not exists base_amount_gnf bigint;
alter table public.subscription_requests add column if not exists discount_gnf bigint not null default 0;
alter table public.subscription_requests add column if not exists discount_kind text not null default 'NONE';
alter table public.subscription_requests add column if not exists reward_id uuid references public.referral_rewards(id);
update public.subscription_requests set base_amount_gnf=amount_gnf where base_amount_gnf is null;
alter table public.subscription_requests alter column base_amount_gnf set not null;
alter table public.subscription_requests drop constraint if exists subscription_requests_price_check;
alter table public.subscription_requests add constraint subscription_requests_price_check check (
  base_amount_gnf = case
    when plan='ESSENTIEL' and billing_period='MONTHLY' then 300000
    when plan='ESSENTIEL' and billing_period='ANNUAL' then 3240000
    when plan='CROISSANCE' and billing_period='MONTHLY' then 700000
    when plan='CROISSANCE' and billing_period='ANNUAL' then 7560000
    when plan='ENTREPRISE' and billing_period='MONTHLY' then 1000000
    when plan='ENTREPRISE' and billing_period='ANNUAL' then 10800000
    else 0 end
  and discount_kind in ('NONE','FILLEUL','PARRAIN')
  and (discount_kind='NONE' and discount_gnf=0 and reward_id is null
    or discount_kind='FILLEUL' and billing_period='MONTHLY' and discount_gnf=base_amount_gnf/10 and reward_id is null
    or discount_kind='PARRAIN' and billing_period='MONTHLY' and discount_gnf=base_amount_gnf/10 and reward_id is not null)
  and amount_gnf=base_amount_gnf-discount_gnf
);

drop policy if exists subscription_requests_insert on public.subscription_requests;
revoke insert on public.subscription_requests from authenticated;

create or replace function public.create_subscription_request(
  p_plan text,p_billing_period text,p_payment_method text,p_phone text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  base_price bigint;
  discount_type text:='NONE';
  discount bigint:=0;
  available_reward uuid;
  request_id uuid;
  owner_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into owner_profile from public.profiles where id=auth.uid();
  if not found or owner_profile.tenant_owner_id<>auth.uid() then
    raise exception 'Seul le responsable de cet espace peut souscrire';
  end if;
  if p_payment_method not in ('ORANGE_MONEY','MOBILE_MONEY') or length(trim(p_phone)) not between 8 and 20 then
    raise exception 'Moyen de paiement ou téléphone invalide';
  end if;
  base_price:=case
    when p_plan='ESSENTIEL' and p_billing_period='MONTHLY' then 300000
    when p_plan='ESSENTIEL' and p_billing_period='ANNUAL' then 3240000
    when p_plan='CROISSANCE' and p_billing_period='MONTHLY' then 700000
    when p_plan='CROISSANCE' and p_billing_period='ANNUAL' then 7560000
    when p_plan='ENTREPRISE' and p_billing_period='MONTHLY' then 1000000
    when p_plan='ENTREPRISE' and p_billing_period='ANNUAL' then 10800000
    else null end;
  if base_price is null then raise exception 'Formule invalide'; end if;

  -- First monthly payment of the referred owner only. No stacking.
  if p_billing_period='MONTHLY' then
    if exists(select 1 from public.referral_signups where referred_id=auth.uid())
      and not exists(select 1 from public.subscription_requests where tenant_owner_id=auth.uid() and status='PAID') then
      discount_type:='FILLEUL';
    else
      select id into available_reward from public.referral_rewards
      where referrer_id=auth.uid() and status='AVAILABLE'
        and not exists(select 1 from public.subscription_requests
          where reward_id=public.referral_rewards.id and status in ('PENDING_GATEWAY','PAYMENT_PENDING','PAID'))
      order by created_at,id limit 1;
      if available_reward is not null then discount_type:='PARRAIN'; end if;
    end if;
  end if;
  if discount_type<>'NONE' then discount:=base_price/10; end if;
  insert into public.subscription_requests(
    tenant_owner_id,requested_by,plan,billing_period,base_amount_gnf,
    discount_gnf,discount_kind,reward_id,amount_gnf,payment_method,phone,status
  ) values (
    auth.uid(),auth.uid(),p_plan,p_billing_period,base_price,
    discount,discount_type,available_reward,base_price-discount,p_payment_method,trim(p_phone),'PENDING_GATEWAY'
  ) returning id into request_id;
  return jsonb_build_object('id',request_id,'base_amount_gnf',base_price,
    'discount_gnf',discount,'discount_kind',discount_type,'amount_gnf',base_price-discount);
end $$;
revoke all on function public.create_subscription_request(text,text,text,text) from public;
grant execute on function public.create_subscription_request(text,text,text,text) to authenticated;

-- Only a privileged, independently verified payment update may trigger rewards.
create or replace function public.apply_verified_referral_payment() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare linked public.referral_signups;
begin
  if old.status='PAID' or new.status<>'PAID' then return new; end if;
  if new.discount_kind='FILLEUL' then
    if exists(select 1 from public.subscription_requests where tenant_owner_id=new.tenant_owner_id and status='PAID' and id<>new.id) then
      raise exception 'Réduction filleul déjà utilisée';
    end if;
  elsif new.discount_kind='PARRAIN' then
    update public.referral_rewards set status='REDEEMED',redeemed_at=now(),redeemed_request_id=new.id
    where id=new.reward_id and referrer_id=new.tenant_owner_id and status='AVAILABLE';
    if not found then raise exception 'Crédit parrain indisponible'; end if;
  end if;
  -- A sponsor earns one credit only after this person's first verified payment.
  if not exists(select 1 from public.subscription_requests
    where tenant_owner_id=new.tenant_owner_id and status='PAID' and id<>new.id) then
    select * into linked from public.referral_signups where referred_id=new.tenant_owner_id;
    if found then
      update public.referral_signups set status='CONVERTED',converted_at=now()
      where referred_id=new.tenant_owner_id and status='SIGNED_UP';
      insert into public.referral_rewards(referrer_id,referred_id)
      values(linked.referrer_id,linked.referred_id) on conflict(referred_id) do nothing;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists apply_verified_referral_payment on public.subscription_requests;
create trigger apply_verified_referral_payment after update of status on public.subscription_requests
for each row execute function public.apply_verified_referral_payment();

create or replace function public.my_referral_summary() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'code',(select code from public.referral_codes where profile_id=auth.uid()),
    'signups',(select count(*) from public.referral_signups where referrer_id=auth.uid()),
    'converted',(select count(*) from public.referral_signups where referrer_id=auth.uid() and status='CONVERTED'),
    'credits_available',(select count(*) from public.referral_rewards where referrer_id=auth.uid() and status='AVAILABLE'),
    'credits_redeemed',(select count(*) from public.referral_rewards where referrer_id=auth.uid() and status='REDEEMED')
  )
$$;
commit;
