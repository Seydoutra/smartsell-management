begin;
alter table public.company_profile add column if not exists settings_revision integer not null default 0;
alter table public.company_profile add column if not exists timezone text not null default 'Africa/Conakry';
alter table public.company_profile add column if not exists locale text not null default 'fr';
create table if not exists public.treasury_accounts(
 id uuid primary key default gen_random_uuid(),tenant_owner_id uuid not null references profiles(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 120),kind text not null check(kind in ('BANQUE','CAISSE','MOBILE_MONEY')),
 currency text not null check(currency in ('GNF','EUR','USD')),bank_name text,account_reference text,
 opening_balance numeric(18,2) not null default 0 check(opening_balance>=0),opening_on date not null,
 active boolean not null default true,created_at timestamptz not null default now()
);
create table if not exists public.employee_finance_requests(
 id uuid primary key default gen_random_uuid(),tenant_owner_id uuid not null references profiles(id) on delete cascade,
 applicant_id uuid references profiles(id) on delete set null,applicant_name text not null,
 kind text not null check(kind in ('PRET','AVANCE_SALAIRE')),amount numeric(18,2) not null check(amount>0),
 currency text not null check(currency in ('GNF','EUR','USD')),reason text not null check(length(trim(reason)) between 5 and 2000),
 installments integer not null check(installments between 1 and 60),first_due_on date not null,
 status text not null default 'EN_ATTENTE' check(status in ('EN_ATTENTE','APPROUVE','REFUSE','VERSE','REMBOURSE','ANNULE')),
 decided_by uuid references profiles(id) on delete set null,decision_note text,decided_at timestamptz,
 disbursed_at date,created_at timestamptz not null default now()
);
create table if not exists public.treasury_entries(
 id uuid primary key default gen_random_uuid(),tenant_owner_id uuid not null references profiles(id) on delete cascade,
 account_id uuid not null references treasury_accounts(id),amount numeric(18,2) not null check(amount<>0),
 occurred_on date not null,description text not null check(length(trim(description)) between 3 and 500),reference text,
 operation_id uuid not null,leg integer not null default 0,loan_id uuid references employee_finance_requests(id),
 actor_id uuid references profiles(id) on delete set null,created_at timestamptz not null default now(),
 unique(tenant_owner_id,operation_id,leg)
);
create table if not exists public.finance_operation_receipts(
 tenant_owner_id uuid not null references profiles(id) on delete cascade,operation_id uuid not null,
 action text not null,payload jsonb not null,result jsonb,primary key(tenant_owner_id,operation_id)
);
create index if not exists treasury_entries_account on treasury_entries(account_id,occurred_on);
create index if not exists finance_requests_tenant on employee_finance_requests(tenant_owner_id,applicant_id,created_at);
do $$declare t text;begin foreach t in array array['treasury_accounts','treasury_entries','employee_finance_requests','finance_operation_receipts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;end$$;
-- New approval is opt-in for existing collaborators; owner is exempt by identity.
create table if not exists public.finance_schema_versions(version integer primary key);
alter table public.finance_schema_versions enable row level security;
revoke all on public.finance_schema_versions from public,anon,authenticated;
do $$declare first_run integer;begin
 insert into finance_schema_versions values(77) on conflict do nothing returning version into first_run;
 if first_run is not null then update user_access_controls set denied_permissions=array_append(coalesce(denied_permissions,'{}'),'hr.approve') where not 'hr.approve'=any(coalesce(denied_permissions,'{}'));end if;
end$$;

create or replace function public.workspace_settings()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not action_allowed('settings.view') then raise exception 'Réglages entreprise non autorisés';end if;
 return jsonb_build_object('company',(select to_jsonb(c) from company_profile c where tenant_owner_id=current_tenant_owner_id() order by updated_at desc,id limit 1),'can_edit',action_allowed('settings.update'));
end$$;
create or replace function public.save_workspace_settings(p_data jsonb,p_revision integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c company_profile;tenant uuid:=current_tenant_owner_id();k text;value text;
begin
 if auth.uid() is null or not current_account_has_access() or not action_allowed('settings.update') then raise exception 'Modification des réglages refusée';end if;
 perform pg_advisory_xact_lock(hashtext(tenant::text||':settings'));
 select * into c from company_profile where tenant_owner_id=tenant order by updated_at desc,id limit 1 for update;
 if coalesce(c.settings_revision,0) is distinct from p_revision then raise exception 'Réglages modifiés ailleurs. Actualisez avant de réessayer.';end if;
 if length(trim(coalesce(p_data->>'company_name',''))) not between 2 and 120 then raise exception 'Nom d’entreprise requis (2 à 120 caractères)';end if;
 if coalesce(p_data->>'currency','') not in ('GNF','EUR','USD') or coalesce(p_data->>'locale','') not in ('fr','en') then raise exception 'Devise ou langue invalide';end if;
 if not exists(select 1 from pg_timezone_names where name=p_data->>'timezone') then raise exception 'Fuseau horaire invalide';end if;
 foreach k in array array['primary_color','secondary_color','accent_color'] loop if coalesce(p_data->>k,'')!~'^#[0-9a-fA-F]{6}$' then raise exception 'Couleur invalide';end if;end loop;
 foreach k in array array['phone','whatsapp','email','website','tax_id','invoice_prefix','quote_prefix'] loop if length(coalesce(p_data->>k,''))>160 then raise exception 'Coordonnée trop longue';end if;end loop;
 foreach k in array array['website','logo_light','logo_dark'] loop value:=nullif(trim(p_data->>k),'');if value is not null and (value!~'^https://' or length(value)>2048) then raise exception 'Les liens doivent utiliser HTTPS';end if;end loop;
 if length(coalesce(p_data->>'address',''))>1000 or length(coalesce(p_data->>'payment_terms',''))>2000 then raise exception 'Texte trop long';end if;
 if nullif(p_data->>'email','') is not null and (p_data->>'email')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Adresse e-mail invalide';end if;
 if c.id is null then insert into company_profile(tenant_owner_id,company_name) values(tenant,trim(p_data->>'company_name')) returning * into c;end if;
 update company_profile set company_name=trim(p_data->>'company_name'),phone=nullif(trim(p_data->>'phone'),''),whatsapp=nullif(trim(p_data->>'whatsapp'),''),email=nullif(trim(p_data->>'email'),''),address=p_data->>'address',website=nullif(p_data->>'website',''),tax_id=p_data->>'tax_id',
 logo_light=nullif(p_data->>'logo_light',''),logo_dark=nullif(p_data->>'logo_dark',''),primary_color=p_data->>'primary_color',secondary_color=p_data->>'secondary_color',accent_color=p_data->>'accent_color',currency=p_data->>'currency',locale=p_data->>'locale',timezone=p_data->>'timezone',
 invoice_prefix=nullif(trim(p_data->>'invoice_prefix'),''),quote_prefix=nullif(trim(p_data->>'quote_prefix'),''),payment_terms=p_data->>'payment_terms',settings_revision=settings_revision+1,updated_at=now() where id=c.id returning * into c;
 insert into activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id,metadata) values(tenant,auth.uid(),'Réglages entreprise modifiés','company_profile',c.id,jsonb_build_object('revision',c.settings_revision));
 return to_jsonb(c);
end$$;

create or replace function public.finance_workspace()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare tenant uuid:=current_tenant_owner_id();staff boolean:=action_allowed('hr.view');finance boolean:=action_allowed('accounting.view');
begin
 if auth.uid() is null or not exists(select 1 from profiles where id=auth.uid() and active and not 'CLIENT'=any(coalesce(roles,array[role]))) then raise exception 'Accès réservé aux collaborateurs actifs';end if;
 return jsonb_build_object(
 'accounts',case when finance then coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('balance',a.opening_balance+coalesce((select sum(e.amount) from treasury_entries e where e.account_id=a.id),0))) from treasury_accounts a where a.tenant_owner_id=tenant),'[]'::jsonb) else '[]'::jsonb end,
 'entries',case when finance then coalesce((select jsonb_agg(to_jsonb(e) order by e.occurred_on desc,e.created_at desc) from (select * from treasury_entries where tenant_owner_id=tenant order by occurred_on desc,created_at desc limit 300) e),'[]'::jsonb) else '[]'::jsonb end,
 'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('repaid',coalesce((select sum(e.amount) from treasury_entries e where e.loan_id=r.id and e.amount>0),0)) order by r.created_at desc) from employee_finance_requests r where r.tenant_owner_id=tenant and (staff or r.applicant_id=auth.uid())),'[]'::jsonb),
 'rights',jsonb_build_object('finance',finance,'create_account',action_allowed('accounting.create'),'movement',action_allowed('accounting.update'),'all_requests',staff,'approve',action_allowed('hr.approve'),'submit',current_account_has_access(),'owner',auth.uid()=tenant));
end$$;

create or replace function public.finance_command(p_operation uuid,p_action text,p_body jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=current_tenant_owner_id();receipt finance_operation_receipts;a treasury_accounts;b treasury_accounts;r employee_finance_requests;v_result jsonb;v_amount numeric;v_date date;v_id uuid;v_balance numeric;v_repaid numeric;cap numeric;note text;
begin
 if auth.uid() is null or not current_account_has_access() or not exists(select 1 from profiles where id=auth.uid() and not 'CLIENT'=any(coalesce(roles,array[role]))) then raise exception 'Action refusée : compte inactif ou essai expiré';end if;
 if p_operation is null or p_body is null or p_action not in ('ACCOUNT','ARCHIVE','MOVEMENT','TRANSFER','REQUEST','APPROVE','REJECT','CANCEL','DISBURSE','REPAY') then raise exception 'Opération invalide';end if;
 if p_body ? 'amount' then v_amount:=(p_body->>'amount')::numeric;if v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<>round(v_amount,2) then raise exception 'Montant invalide : deux décimales au maximum';end if;end if;
 if p_body ? 'opening_balance' then v_amount:=(p_body->>'opening_balance')::numeric;if v_amount::text in ('NaN','Infinity','-Infinity') or v_amount<>round(v_amount,2) then raise exception 'Solde initial invalide';end if;end if;
 if p_action='ACCOUNT' and not action_allowed('accounting.create') then raise exception 'Création de compte refusée';end if;
 if p_action in ('ARCHIVE','MOVEMENT','TRANSFER','DISBURSE','REPAY') and not action_allowed('accounting.update') then raise exception 'Écriture comptable refusée';end if;
 if p_action in ('APPROVE','REJECT') and not action_allowed('hr.approve') then raise exception 'Approbation RH refusée';end if;
 insert into finance_operation_receipts(tenant_owner_id,operation_id,action,payload) values(tenant,p_operation,p_action,p_body) on conflict do nothing;
 select * into receipt from finance_operation_receipts where tenant_owner_id=tenant and operation_id=p_operation for update;
 if receipt.action is distinct from p_action or receipt.payload is distinct from p_body then raise exception 'Identifiant déjà utilisé pour une autre opération';end if;
 if receipt.result is not null then return receipt.result;end if;
 if p_action='ACCOUNT' then
 v_amount:=coalesce((p_body->>'opening_balance')::numeric,0);v_date:=(p_body->>'opening_on')::date;
 if v_date is null or v_date>current_date or v_amount<0 then raise exception 'Solde initial ou date invalide';end if;
 insert into treasury_accounts(tenant_owner_id,name,kind,currency,bank_name,account_reference,opening_balance,opening_on) values(tenant,trim(p_body->>'name'),p_body->>'kind',p_body->>'currency',left(p_body->>'bank_name',120),left(p_body->>'account_reference',160),v_amount,v_date) returning id into v_id;
 elsif p_action='REQUEST' then
 if length(coalesce(p_body->>'reason',''))>2000 or (p_body->>'first_due_on')::date<current_date then raise exception 'Motif ou début de remboursement invalide';end if;
 insert into employee_finance_requests(tenant_owner_id,applicant_id,applicant_name,kind,amount,currency,reason,installments,first_due_on) select tenant,id,full_name,p_body->>'kind',(p_body->>'amount')::numeric,p_body->>'currency',trim(p_body->>'reason'),(p_body->>'installments')::integer,(p_body->>'first_due_on')::date from profiles where id=auth.uid() returning id into v_id;
 elsif p_action in ('APPROVE','REJECT','CANCEL','DISBURSE','REPAY') then
 select * into r from employee_finance_requests where id=(p_body->>'id')::uuid and tenant_owner_id=tenant for update;
 if r.id is null then raise exception 'Demande introuvable dans cet espace';end if;
 v_id:=r.id;
 if p_action='CANCEL' then
 if r.applicant_id is distinct from auth.uid() or r.status<>'EN_ATTENTE' then raise exception 'Annulation refusée';end if;
 update employee_finance_requests set status='ANNULE' where id=r.id;
 elsif p_action in ('APPROVE','REJECT') then
 if r.status<>'EN_ATTENTE' or r.applicant_id=auth.uid() then raise exception 'Demande déjà traitée ou auto-approbation interdite';end if;
 note:=trim(coalesce(p_body->>'note',''));if length(note) not between 3 and 1000 then raise exception 'Motif de décision requis';end if;
 if auth.uid()<>tenant and not is_platform_owner() then
 if r.currency<>'GNF' then raise exception 'Approbation en devise étrangère réservée au propriétaire : plafond configuré en GNF';end if;
 select max_approval_amount into cap from user_access_controls where profile_id=auth.uid();if r.amount>coalesce(cap,0) then raise exception 'Plafond d’approbation dépassé';end if;end if;
 update employee_finance_requests set status=case when p_action='APPROVE' then 'APPROUVE' else 'REFUSE' end,decided_by=auth.uid(),decided_at=now(),decision_note=note where id=r.id;
 else
 if (p_action='DISBURSE' and r.status<>'APPROUVE') or (p_action='REPAY' and r.status<>'VERSE') then raise exception 'État de demande incompatible';end if;
 select * into a from treasury_accounts where id=(p_body->>'account_id')::uuid and tenant_owner_id=tenant and active for update;
 if a.id is null or a.currency<>r.currency then raise exception 'Compte absent ou devise incompatible';end if;
 v_amount:=case when p_action='DISBURSE' then r.amount else (p_body->>'amount')::numeric end;v_date:=(p_body->>'date')::date;
 if v_date is null or v_date<a.opening_on or v_date>current_date or v_amount is null or v_amount<=0 then raise exception 'Date ou montant invalide';end if;
 select coalesce(sum(amount),0) into v_repaid from treasury_entries where loan_id=r.id and amount>0;
 if p_action='REPAY' and v_amount>r.amount-v_repaid then raise exception 'Remboursement supérieur au restant dû';end if;
 select a.opening_balance+coalesce(sum(amount),0) into v_balance from treasury_entries where account_id=a.id;
 if p_action='DISBURSE' and v_balance<v_amount then raise exception 'Solde insuffisant';end if;
 insert into treasury_entries(tenant_owner_id,account_id,amount,occurred_on,description,reference,operation_id,loan_id,actor_id) values(tenant,a.id,case when p_action='DISBURSE' then -v_amount else v_amount end,v_date,case when p_action='DISBURSE' then 'Versement : ' else 'Remboursement : ' end||r.applicant_name,left(p_body->>'reference',160),p_operation,r.id,auth.uid());
 update employee_finance_requests set status=case when p_action='DISBURSE' then 'VERSE' when v_repaid+v_amount=r.amount then 'REMBOURSE' else 'VERSE' end,disbursed_at=case when p_action='DISBURSE' then v_date else disbursed_at end where id=r.id;
 end if;
 else
 -- Deterministic lock ordering prevents deadlocks on opposite transfers.
 perform 1 from treasury_accounts where tenant_owner_id=tenant and id in (nullif(p_body->>'account_id','')::uuid,nullif(p_body->>'target_id','')::uuid) order by id for update;
 select * into a from treasury_accounts where id=(p_body->>'account_id')::uuid and tenant_owner_id=tenant;
 if a.id is null then raise exception 'Compte introuvable dans cet espace';end if;
 v_id:=a.id;
 if p_action='ARCHIVE' then update treasury_accounts set active=not active where id=a.id;
 else
 if not a.active then raise exception 'Compte archivé';end if;
 v_amount:=(p_body->>'amount')::numeric;v_date:=(p_body->>'date')::date;note:=trim(coalesce(p_body->>'description',''));
 if v_amount is null or v_amount<=0 or v_date is null or v_date<a.opening_on or v_date>current_date or length(note) not between 3 and 500 then raise exception 'Montant, date ou description invalide';end if;
 if p_action='TRANSFER' then
 select * into b from treasury_accounts where id=(p_body->>'target_id')::uuid and tenant_owner_id=tenant and active;
 if b.id is null or b.id=a.id or b.currency<>a.currency or v_date<b.opening_on then raise exception 'Destination du transfert invalide';end if;
 elsif p_body->>'direction' not in ('ENTREE','SORTIE') or p_body->>'direction' is null then raise exception 'Sens de mouvement invalide';end if;
 select a.opening_balance+coalesce(sum(amount),0) into v_balance from treasury_entries where account_id=a.id;
 if (p_action='TRANSFER' or p_body->>'direction'='SORTIE') and v_balance<v_amount then raise exception 'Solde insuffisant';end if;
 insert into treasury_entries(tenant_owner_id,account_id,amount,occurred_on,description,reference,operation_id,actor_id) values(tenant,a.id,case when p_action='TRANSFER' or p_body->>'direction'='SORTIE' then -v_amount else v_amount end,v_date,note,left(p_body->>'reference',160),p_operation,auth.uid());
 if p_action='TRANSFER' then insert into treasury_entries(tenant_owner_id,account_id,amount,occurred_on,description,reference,operation_id,leg,actor_id) values(tenant,b.id,v_amount,v_date,note,left(p_body->>'reference',160),p_operation,1,auth.uid());end if;
 end if;
 end if;
 v_result:=jsonb_build_object('id',v_id,'action',p_action);
 update finance_operation_receipts set result=v_result where tenant_owner_id=tenant and operation_id=p_operation;
 insert into activity_logs(tenant_owner_id,actor_id,action,entity_type,entity_id,metadata) values(tenant,auth.uid(),p_action,'finance',v_id,jsonb_build_object('operation_id',p_operation));
 return v_result;
end$$;
revoke all on function public.workspace_settings(),public.save_workspace_settings(jsonb,integer),public.finance_workspace(),public.finance_command(uuid,text,jsonb) from public,anon;
grant execute on function public.workspace_settings(),public.save_workspace_settings(jsonb,integer),public.finance_workspace(),public.finance_command(uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
