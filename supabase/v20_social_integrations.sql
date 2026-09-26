-- SmartSell V20 — connecteurs sociaux et outils créatifs.
create table if not exists public.social_integrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  provider text not null check(provider in ('FACEBOOK','INSTAGRAM','LINKEDIN','X','TIKTOK','YOUTUBE','CANVA')),
  account_name text,
  account_url text,
  status text not null default 'NON_CONFIGURE' check(status in ('NON_CONFIGURE','CONNECTE','ERREUR')),
  metrics jsonb not null default '{}'::jsonb,
  access_token_ref text,
  last_synced_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(client_id,provider)
);
alter table public.social_integrations enable row level security;
drop policy if exists social_integrations_read on public.social_integrations;
create policy social_integrations_read on public.social_integrations for select to authenticated using(public.action_allowed('communication.view'));
drop policy if exists social_integrations_write on public.social_integrations;
create policy social_integrations_write on public.social_integrations for all to authenticated using(public.action_allowed('communication.update')) with check(public.action_allowed('communication.update'));
