-- V32 — coordonnées des demandes SaaS dans l’espace privé du Super Admin.
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email
from auth.users u where u.id = p.id and (p.email is null or p.email = '');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare requested_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),nullif(trim(new.raw_user_meta_data->>'name'),''),split_part(coalesce(new.email,''),'@',1),'Utilisateur SmartSell');
begin
  insert into public.profiles(id,full_name,email,role,roles,active,must_change_password,is_temporary,access_expires_at)
  values(new.id,requested_name,new.email,'SUPER_ADMIN',array['SUPER_ADMIN']::public.app_role[],true,false,true,now()+interval '72 hours')
  on conflict(id) do update set full_name=excluded.full_name,email=excluded.email;
  return new;
end $$;
