-- Canva is an explicit, opt-in permission for each collaborator.
-- The tenant owner always retains access to their own Canva connection.
alter table public.user_access_controls
  add column if not exists canva_access boolean not null default false;

comment on column public.user_access_controls.canva_access is
  'Autorisation individuelle de consulter les créations Canva de l espace, en plus du droit de voir le calendrier éditorial.';
