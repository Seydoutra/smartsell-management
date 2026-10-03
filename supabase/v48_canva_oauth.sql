-- Canva Connect: private OAuth credentials, never readable by browser clients.
create table if not exists public.canva_oauth_states (
  state_hash text primary key,
  profile_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.canva_connections (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  access_token_iv text not null,
  refresh_token_iv text not null,
  token_expires_at timestamptz not null,
  scope text,
  updated_at timestamptz not null default now()
);
alter table public.canva_oauth_states enable row level security;
alter table public.canva_connections enable row level security;
revoke all on public.canva_oauth_states from anon, authenticated;
revoke all on public.canva_connections from anon, authenticated;

alter table public.editorial_items
  add column if not exists canva_design_id text,
  add column if not exists canva_design_title text;
