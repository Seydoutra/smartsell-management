-- SmartSell V6 — rôles cumulables par collaborateur.
alter table public.profiles
  add column if not exists roles public.app_role[];

update public.profiles
set roles = array[role]::public.app_role[]
where roles is null or cardinality(roles) = 0;

alter table public.profiles
  alter column roles set default array['COLLABORATEUR']::public.app_role[],
  alter column roles set not null;

alter table public.profiles drop constraint if exists profiles_roles_not_empty;
alter table public.profiles
  add constraint profiles_roles_not_empty check (cardinality(roles) > 0);

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql stable security definer set search_path=public
as $$
  select coalesce(required_role = any(roles), role = required_role, false)
  from public.profiles
  where id=auth.uid()
$$;

create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path=public
as $$
  select coalesce(
    (select candidate
     from unnest(array[
       'SUPER_ADMIN','ADMIN','MANAGER','CHEF_DE_PROJET','COMMERCIAL',
       'COMMUNITY_MANAGER','COMPTABLE','DEVELOPPEUR','GRAPHISTE',
       'VIDEASTE','PHOTOGRAPHE','COLLABORATEUR'
     ]::public.app_role[]) candidate
     where candidate = any(coalesce(roles,array[role]))
     limit 1),
    role
  )
  from public.profiles
  where id=auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path=public
as $$ select coalesce(public.has_role('SUPER_ADMIN') or public.has_role('ADMIN'),false) $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,full_name,roles)
  values(new.id,coalesce(new.raw_user_meta_data->>'name',''),array['COLLABORATEUR']::public.app_role[])
  on conflict(id) do nothing;
  return new;
end
$$;
