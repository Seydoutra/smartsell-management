-- Photo facultative des collaborateurs, utilisée dans l'équipe et les affectations.
alter table public.profiles add column if not exists avatar_url text;
