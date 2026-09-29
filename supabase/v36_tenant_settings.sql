-- V36 — paramètres indépendants pour chaque espace SaaS.
begin;
alter table public.app_settings drop constraint if exists app_settings_key_key;
create unique index if not exists uq_app_settings_tenant_key on public.app_settings(tenant_owner_id, key);
commit;
