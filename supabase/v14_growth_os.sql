-- SmartSell Growth OS — jumeau numérique, radar commercial et studio IA

create table if not exists public.agency_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  parameters jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  objective text not null,
  audience text not null,
  offer text,
  channels text[] not null default array['EMAIL']::text[],
  tone text not null default 'PROFESSIONNEL',
  budget numeric(18,2) not null default 0,
  currency text not null default 'GNF',
  status text not null default 'BROUILLON',
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  constraint campaign_ai_draft_status check(status in ('BROUILLON','A_VALIDER','APPROUVE','REJETE'))
);

create index if not exists idx_agency_scenarios_owner on public.agency_scenarios(owner_id,created_at desc);
create index if not exists idx_campaign_ai_drafts_owner on public.campaign_ai_drafts(owner_id,status,created_at desc);

alter table public.agency_scenarios enable row level security;
alter table public.campaign_ai_drafts enable row level security;

drop policy if exists agency_scenarios_direction on public.agency_scenarios;
create policy agency_scenarios_direction on public.agency_scenarios for all to authenticated
using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());

drop policy if exists campaign_ai_drafts_read on public.campaign_ai_drafts;
create policy campaign_ai_drafts_read on public.campaign_ai_drafts for select to authenticated
using(owner_id=auth.uid() or public.is_admin());
drop policy if exists campaign_ai_drafts_insert on public.campaign_ai_drafts;
create policy campaign_ai_drafts_insert on public.campaign_ai_drafts for insert to authenticated
with check(owner_id=auth.uid());
drop policy if exists campaign_ai_drafts_update on public.campaign_ai_drafts;
create policy campaign_ai_drafts_update on public.campaign_ai_drafts for update to authenticated
using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());

grant select,insert,update,delete on public.agency_scenarios to authenticated;
grant select,insert,update on public.campaign_ai_drafts to authenticated;
