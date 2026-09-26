-- SmartSell V19 — inscription autonome et essai de 72 heures.
-- Les e-mails de confirmation sont envoyés par Supabase Auth. Configurez le
-- SMTP personnalisé dans Supabase pour utiliser contact.smartsell@gmail.com.

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
    'Nouvel utilisateur'
  );
begin
  insert into public.profiles (
    id, full_name, role, roles, active, must_change_password,
    is_temporary, access_expires_at
  ) values (
    new.id, requested_name, 'COLLABORATEUR',
    array['COLLABORATEUR']::public.app_role[], true, false, true,
    now() + interval '72 hours'
  ) on conflict (id) do nothing;

  insert into public.notifications (profile_id, channel, title, body, entity_type)
  values (
    new.id, 'IN_APP', 'Bienvenue sur SmartSell',
    'Votre espace d’essai est actif pendant 72 heures. Prenez le temps d’explorer les modules et de découvrir votre nouvelle façon de travailler.',
    'ONBOARDING'
  );

  return new;
end
$$;

comment on function public.handle_new_user() is
  'Crée le profil autonome, active un essai de 72 heures et ajoute le message de bienvenue.';

commit;
