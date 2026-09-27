-- Campagnes Smartsell/client : gouvernance, validation et traçabilité.
alter table public.campaigns add column if not exists scope text not null default 'MARCEL';
alter table public.campaigns add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.campaigns add column if not exists objective text;
alter table public.campaigns add column if not exists approval_status text not null default 'BROUILLON';
alter table public.campaigns add column if not exists approved_at timestamptz;
alter table public.campaigns add constraint campaigns_scope_check check (scope in ('MARCEL','CLIENT'));
alter table public.campaigns add constraint campaigns_approval_status_check check (approval_status in ('BROUILLON','A_VALIDER','APPROUVE','REJETE'));
create index if not exists idx_campaigns_scope_client on public.campaigns(scope, client_id, created_at desc);
create index if not exists idx_campaigns_approval on public.campaigns(approval_status, scheduled_at);

-- Modèles de base utiles dès l'installation. Les insertions sont idempotentes.
insert into public.communication_templates(channel,name,subject,body,variables)
select 'SMS','Bienvenue collaborateur',null,'Bonjour {{nom}}, bienvenue chez Smartsell. Votre accès Smartsell est prêt.',array['nom']
where not exists (select 1 from public.communication_templates where name='Bienvenue collaborateur');
insert into public.communication_templates(channel,name,subject,body,variables)
select 'SMS','Rappel de tâche',null,'Bonjour {{nom}}, votre tâche « {{tache}} » arrive à échéance. Pensez à mettre SmartSell à jour.',array['nom','tache']
where not exists (select 1 from public.communication_templates where name='Rappel de tâche');
insert into public.communication_templates(channel,name,subject,body,variables)
select 'EMAIL','Bienvenue client','Bienvenue chez Smartsell','Bonjour {{nom}},\n\nVotre espace client Smartsell est prêt. Retrouvez vos projets, validations et factures depuis votre portail.',array['nom']
where not exists (select 1 from public.communication_templates where name='Bienvenue client');
insert into public.communication_templates(channel,name,subject,body,variables)
select 'EMAIL','Rapport de campagne','Rapport de campagne — {{entreprise}}','Bonjour {{nom}},\n\nVotre rapport de campagne est disponible : {{lien}}',array['nom','entreprise','lien']
where not exists (select 1 from public.communication_templates where name='Rapport de campagne');
