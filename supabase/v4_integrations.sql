-- SmartSell V4 — Nimba SMS et connexion individuelle Google Agenda.
alter table public.calendar_connections add column if not exists encrypted_access_token text;
alter table public.calendar_connections add column if not exists access_token_iv text;
alter table public.calendar_connections add column if not exists access_token_tag text;
alter table public.calendar_connections add column if not exists refresh_token_iv text;
alter table public.calendar_connections add column if not exists refresh_token_tag text;
alter table public.calendar_connections add column if not exists token_expires_at timestamptz;
alter table public.calendar_connections add column if not exists scope text;
alter table public.calendar_connections add column if not exists calendar_id text default 'primary';
alter table public.tasks add column if not exists google_event_id text;
alter table public.tasks add column if not exists calendar_synced_at timestamptz;

create table if not exists public.calendar_oauth_states(
  state_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.calendar_oauth_states enable row level security;
revoke all on public.calendar_oauth_states from anon, authenticated;
create index if not exists idx_calendar_oauth_states_expiry on public.calendar_oauth_states(expires_at);
