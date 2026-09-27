-- SmartSell V26 — le créateur d'un espace SaaS devient propriétaire de son espace.
-- À exécuter dans Supabase SQL Editor après V19/V25.
-- Le rôle SUPER_ADMIN est appliqué au profil créé par l'inscription publique,
-- tandis que les collaborateurs invités continuent d'utiliser leurs rôles choisis.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Propriétaire SmartSell'
  );
begin
  insert into public.profiles (
    id, full_name, role, roles, active, must_change_password,
    is_temporary, access_expires_at
  ) values (
    new.id, requested_name, 'SUPER_ADMIN',
    array['SUPER_ADMIN']::public.app_role[], true, false, true,
    now() + interval '72 hours'
  ) on conflict (id) do update set
    full_name = excluded.full_name,
    role = 'SUPER_ADMIN',
    roles = array['SUPER_ADMIN']::public.app_role[],
    active = true;

  insert into public.notifications (profile_id, channel, title, body, entity_type)
  values (
    new.id, 'IN_APP', 'Bienvenue sur SmartSell',
    'Votre espace propriétaire est prêt. Vous disposez de 72 heures pour tester les modules.',
    'ONBOARDING'
  ) on conflict do nothing;

  return new;
end
$$;

comment on function public.handle_new_user() is
  'Crée le propriétaire SUPER_ADMIN de chaque nouvel espace SaaS avec un essai de 72 heures.';

commit;
