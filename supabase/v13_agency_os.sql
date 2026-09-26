-- SmartSell Agency OS — cockpit IA, prochaines actions et validations créatives

create table if not exists public.agency_briefings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  briefing_date date not null default current_date,
  greeting text not null,
  summary text not null,
  opportunities jsonb not null default '[]'::jsonb,
  watchouts jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique(owner_id, briefing_date)
);

create table if not exists public.next_best_actions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  client_id uuid references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  reason text not null,
  priority text not null default 'NORMALE',
  action_type text not null default 'NAVIGATE',
  target_page text not null,
  action_payload jsonb not null default '{}'::jsonb,
  status text not null default 'A_FAIRE',
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  constraint next_best_action_status check(status in ('A_FAIRE','TERMINEE','IGNOREE')),
  constraint next_best_action_type check(action_type in ('NAVIGATE','COMPLETE_TASK','MARK_INVOICE_SENT','CREATE_FOLLOW_UP'))
);

create index if not exists idx_next_best_actions_owner on public.next_best_actions(owner_id,status,created_at desc);

create table if not exists public.creative_approvals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  editorial_item_id uuid references public.editorial_items(id) on delete set null,
  title text not null,
  description text,
  asset_url text not null,
  asset_type text not null default 'VISUEL',
  version integer not null default 1 check(version > 0),
  status text not null default 'A_VALIDER',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint creative_approval_status check(status in ('A_VALIDER','APPROUVE','MODIFICATIONS_DEMANDEES','ARCHIVE'))
);

create table if not exists public.creative_feedback (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.creative_approvals(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  decision text,
  created_at timestamptz not null default now(),
  constraint creative_feedback_decision check(decision is null or decision in ('APPROUVE','MODIFICATIONS_DEMANDEES'))
);

create index if not exists idx_creative_approvals_client on public.creative_approvals(client_id,status,created_at desc);
create index if not exists idx_creative_feedback_approval on public.creative_feedback(approval_id,created_at);

alter table public.agency_briefings enable row level security;
alter table public.next_best_actions enable row level security;
alter table public.creative_approvals enable row level security;
alter table public.creative_feedback enable row level security;

drop policy if exists agency_briefings_owner on public.agency_briefings;
create policy agency_briefings_owner on public.agency_briefings for select to authenticated
using(owner_id=auth.uid() or public.is_admin());

drop policy if exists next_best_actions_owner on public.next_best_actions;
create policy next_best_actions_owner on public.next_best_actions for select to authenticated
using(owner_id=auth.uid() or public.is_admin());
drop policy if exists next_best_actions_update on public.next_best_actions;
create policy next_best_actions_update on public.next_best_actions for update to authenticated
using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());

drop policy if exists creative_approvals_staff_all on public.creative_approvals;
create policy creative_approvals_staff_all on public.creative_approvals for all to authenticated
using(public.current_role()::text <> 'CLIENT') with check(public.current_role()::text <> 'CLIENT');
drop policy if exists creative_approvals_client_read on public.creative_approvals;
create policy creative_approvals_client_read on public.creative_approvals for select to authenticated
using(exists(select 1 from public.client_portal_access a where a.profile_id=auth.uid() and a.client_id=creative_approvals.client_id and a.active));

drop policy if exists creative_feedback_staff_all on public.creative_feedback;
create policy creative_feedback_staff_all on public.creative_feedback for all to authenticated
using(public.current_role()::text <> 'CLIENT') with check(public.current_role()::text <> 'CLIENT');
drop policy if exists creative_feedback_client_read on public.creative_feedback;
create policy creative_feedback_client_read on public.creative_feedback for select to authenticated
using(exists(select 1 from public.creative_approvals ca join public.client_portal_access a on a.client_id=ca.client_id where ca.id=creative_feedback.approval_id and a.profile_id=auth.uid() and a.active));

create or replace function public.respond_creative_approval(p_approval_id uuid,p_decision text,p_comment text)
returns public.creative_approvals
language plpgsql security definer set search_path=public as $$
declare result public.creative_approvals;
begin
  if p_decision not in ('APPROUVE','MODIFICATIONS_DEMANDEES') then raise exception 'Décision invalide'; end if;
  if not exists(
    select 1 from public.creative_approvals ca
    join public.client_portal_access a on a.client_id=ca.client_id
    where ca.id=p_approval_id and a.profile_id=auth.uid() and a.active and a.can_comment
  ) then raise exception 'Accès refusé'; end if;
  update public.creative_approvals set status=p_decision,responded_at=now() where id=p_approval_id returning * into result;
  insert into public.creative_feedback(approval_id,author_id,body,decision) values(p_approval_id,auth.uid(),coalesce(nullif(trim(p_comment),''),case when p_decision='APPROUVE' then 'Création approuvée' else 'Modifications demandées' end),p_decision);
  insert into public.notifications(profile_id,title,body,entity_type,entity_id)
    select created_by,'Retour client sur une création',case when p_decision='APPROUVE' then 'La création a été approuvée.' else 'Le client demande des modifications.' end,'creative_approval',p_approval_id
    from public.creative_approvals where id=p_approval_id;
  return result;
end $$;

grant execute on function public.respond_creative_approval(uuid,text,text) to authenticated;
