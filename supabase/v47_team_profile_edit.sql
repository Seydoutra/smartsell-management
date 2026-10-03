begin;

-- Tenant owners may edit their collaborators' public profile fields without
-- gaining unrestricted UPDATE access to security-sensitive profile columns.
create or replace function public.update_team_member_profile(
  p_profile_id uuid,
  p_full_name text,
  p_phone text default null,
  p_avatar_url text default null
) returns public.profiles
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  result public.profiles;
  tenant_id uuid;
begin
  tenant_id := public.current_tenant_owner_id();
  if auth.uid() is null or tenant_id is null or auth.uid() <> tenant_id then
    raise exception 'Seul le responsable de cet espace peut modifier un profil collaborateur.';
  end if;
  if p_full_name is null or length(btrim(p_full_name)) < 2 or length(btrim(p_full_name)) > 120 then
    raise exception 'Le nom doit contenir entre 2 et 120 caractères.';
  end if;
  if p_phone is not null and length(btrim(p_phone)) > 30 then
    raise exception 'Le numéro de téléphone est trop long.';
  end if;
  if p_avatar_url is not null and length(p_avatar_url) > 2048 then
    raise exception 'Adresse de photo invalide.';
  end if;

  update public.profiles
     set full_name = btrim(p_full_name),
         phone = nullif(btrim(p_phone), ''),
         avatar_url = p_avatar_url
   where id = p_profile_id
     and tenant_owner_id = tenant_id
     and (not is_platform_owner or id = auth.uid())
  returning * into result;
  if result.id is null then
    raise exception 'Collaborateur introuvable dans cet espace.';
  end if;
  return result;
end $$;

revoke all on function public.update_team_member_profile(uuid,text,text,text) from public;
grant execute on function public.update_team_member_profile(uuid,text,text,text) to authenticated;

commit;
