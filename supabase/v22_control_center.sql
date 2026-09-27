-- SmartSell Control Center — gouvernance, notifications, export et conformité.
-- Migration idempotente à exécuter après le schéma principal.

alter table public.company_profile add column if not exists tax_id text;
create index if not exists idx_notifications_unread on public.notifications(profile_id, read_at, created_at desc);
create index if not exists idx_activity_entity_date on public.activity_logs(entity_type, created_at desc);
create index if not exists idx_sessions_recent on public.user_sessions(last_seen_at desc);

alter table public.notifications enable row level security;
drop policy if exists notifications_owner_or_admin on public.notifications;
create policy notifications_owner_or_admin on public.notifications for all to authenticated
  using(profile_id=auth.uid() or public.is_admin())
  with check(profile_id=auth.uid() or public.is_admin());

comment on table public.notifications is 'Centre de notification SmartSell : rappels, validations et alertes de sécurité.';
comment on table public.activity_logs is 'Journal d audit immuable des actions métier et administratives.';
comment on table public.app_settings is 'Paramètres persistants de gouvernance et d automatisation.';
