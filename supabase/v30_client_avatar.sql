-- Photo facultative pour les fiches clients.
alter table public.clients add column if not exists avatar_url text;
