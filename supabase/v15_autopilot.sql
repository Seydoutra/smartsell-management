-- SmartSell Autopilot — orchestration supervisée, décisions et audit

create table if not exists public.autopilot_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  mode text not null default 'COPILOTE' check(mode in ('OBSERVATION','COPILOTE','AUTOPILOTE')),
  daily_briefing boolean not null default true,
  max_actions_per_run integer not null default 12 check(max_actions_per_run between 1 and 30),
  approval_threshold text not null default 'TOUJOURS' check(approval_threshold='TOUJOURS'),
  updated_at timestamptz not null default now()
);

create table if not exists public.autopilot_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'EN_COURS' check(status in ('EN_COURS','TERMINE','ECHEC')),
  summary text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.autopilot_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.autopilot_runs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  rationale text not null,
  category text not null check(category in ('FINANCE','PROJET','COMMERCIAL','COMMUNICATION')),
  priority text not null default 'NORMALE' check(priority in ('NORMALE','HAUTE','URGENTE')),
  action_type text not null check(action_type in ('OPEN_PAGE','COMPLETE_TASK','MARK_INVOICE_SENT','SCHEDULE_FOLLOW_UP','PREPARE_MESSAGE')),
  target_page text not null,
  source_type text not null,
  source_id uuid,
  proposed_payload jsonb not null default '{}'::jsonb,
  risk_level text not null default 'FAIBLE' check(risk_level in ('FAIBLE','MODERE','ELEVE')),
  approval_required boolean not null default true check(approval_required=true),
  status text not null default 'A_VALIDER' check(status in ('A_VALIDER','APPROUVEE','REJETEE','EXECUTEE','ECHEC')),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  executed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_autopilot_runs_owner on public.autopilot_runs(requested_by,started_at desc);
create index if not exists idx_autopilot_actions_queue on public.autopilot_actions(owner_id,status,created_at desc);

alter table public.autopilot_settings enable row level security;
alter table public.autopilot_runs enable row level security;
alter table public.autopilot_actions enable row level security;

drop policy if exists autopilot_settings_owner on public.autopilot_settings;
create policy autopilot_settings_owner on public.autopilot_settings for all to authenticated
using(profile_id=auth.uid() or public.is_admin()) with check(profile_id=auth.uid() or public.is_admin());

drop policy if exists autopilot_runs_owner on public.autopilot_runs;
create policy autopilot_runs_owner on public.autopilot_runs for select to authenticated
using(requested_by=auth.uid() or public.is_admin());

drop policy if exists autopilot_actions_owner on public.autopilot_actions;
create policy autopilot_actions_owner on public.autopilot_actions for select to authenticated
using(owner_id=auth.uid() or public.is_admin());

grant select,insert,update on public.autopilot_settings to authenticated;
grant select on public.autopilot_runs,public.autopilot_actions to authenticated;
