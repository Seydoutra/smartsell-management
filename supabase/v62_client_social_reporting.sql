-- Client service commitments and dated social measurements. Additive only.
-- Apply after reviewing RLS with staff/client JWTs; no provider API or email send.
begin;
create table if not exists public.client_social_measurements (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  network text not null check(network in ('FACEBOOK','INSTAGRAM','LINKEDIN','TIKTOK','YOUTUBE','X')),
  account_key text not null check(length(trim(account_key)) between 1 and 200),
  kind text not null check(kind in ('BASELINE','SNAPSHOT')),
  measured_on date not null check(measured_on<=current_date),
  followers bigint check(followers>=0), likes bigint check(likes>=0), shares bigint check(shares>=0),
  reach bigint check(reach>=0), impressions bigint check(impressions>=0), engagements bigint check(engagements>=0),
  notes text, created_at timestamptz not null default now(),
  unique(tenant_owner_id,client_id,network,account_key,kind,measured_on)
);
create unique index if not exists client_social_one_baseline on public.client_social_measurements(tenant_owner_id,client_id,network,account_key) where kind='BASELINE';
create table if not exists public.client_monthly_commitments (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  month date not null check(extract(day from month)=1),
  publications integer not null default 0 check(publications>=0),
  videos integer not null default 0 check(videos>=0), reels integer not null default 0 check(reels>=0),
  notes text, created_at timestamptz not null default now(),
  unique(tenant_owner_id,client_id,month)
);
-- Recurring contract volumes, entered once. New versions take effect from a month;
-- monthly exceptions remain separate and frozen reports preserve their snapshot.
create table if not exists public.client_service_commitments (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  effective_month date not null check(extract(day from effective_month)=1),
  publications integer not null check(publications>=0), videos integer not null check(videos>=0), reels integer not null check(reels>=0),
  notes text, created_at timestamptz not null default now(),
  unique(tenant_owner_id,client_id,effective_month)
);
create table if not exists public.client_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null references public.profiles(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  month date not null check(extract(day from month)=1),
  payload jsonb not null, generated_at timestamptz not null default now(),
  unique(tenant_owner_id,client_id,month)
);

create or replace function public.guard_client_social_scope() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.clients where id=new.client_id and tenant_owner_id=new.tenant_owner_id) then
    raise exception 'Client incompatible avec cet espace';
  end if;
  if tg_op='UPDATE' and (new.tenant_owner_id is distinct from old.tenant_owner_id or new.client_id is distinct from old.client_id) then
    raise exception 'Un suivi client ne peut pas changer d’espace ou de client';
  end if;
  if tg_table_name='client_social_measurements' and to_jsonb(new)->>'kind'='SNAPSHOT' then
    if not exists(select 1 from public.client_social_measurements b where b.client_id=new.client_id and b.tenant_owner_id=new.tenant_owner_id
      and b.kind='BASELINE' and b.network=to_jsonb(new)->>'network' and b.account_key=to_jsonb(new)->>'account_key'
      and b.measured_on<=(to_jsonb(new)->>'measured_on')::date) then
      raise exception 'Enregistrez d’abord la situation de départ de cette page, à une date antérieure au relevé';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_client_social_scope() from public;
do $$ declare tbl text; begin
  foreach tbl in array array['client_social_measurements','client_monthly_commitments','client_service_commitments','client_monthly_reports'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('drop trigger if exists guard_client_social_scope on public.%I',tbl);
    execute format('create trigger guard_client_social_scope before insert or update on public.%I for each row execute function public.guard_client_social_scope()',tbl);
    execute format('drop trigger if exists enforce_trial_write_access on public.%I',tbl);
    execute format('create trigger enforce_trial_write_access before insert or update or delete on public.%I for each row execute function public.enforce_trial_write_access()',tbl);
    execute format('drop policy if exists client_social_read on public.%I',tbl);
    execute format('create policy client_social_read on public.%I for select to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and ((public.action_allowed(''clients.view'') and not public.has_role(''CLIENT'')) or public.portal_client_allowed(client_id)))',tbl);
    execute format('revoke all on public.%I from anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('grant all on public.%I to service_role',tbl);
    if tbl<>'client_monthly_reports' then
      execute format('grant insert,update on public.%I to authenticated',tbl);
      execute format('drop policy if exists client_social_insert on public.%I',tbl);
      execute format('create policy client_social_insert on public.%I for insert to authenticated with check(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed(''clients.update'') and not public.has_role(''CLIENT''))',tbl);
      execute format('drop policy if exists client_social_update on public.%I',tbl);
      execute format('create policy client_social_update on public.%I for update to authenticated using(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed(''clients.update'') and not public.has_role(''CLIENT'')) with check(tenant_owner_id=public.current_tenant_owner_id() and public.action_allowed(''clients.update'') and not public.has_role(''CLIENT''))',tbl);
    end if;
  end loop;
end $$;

-- Internal generator: callable only by the scheduler/service role or owner.
-- Authenticated users must use the checked wrapper below.
create or replace function public.build_client_monthly_report(p_tenant uuid,p_client uuid,p_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare report_id uuid; target jsonb; results jsonb; social jsonb; client_name text;
begin
  if p_month is null or extract(day from p_month)<>1 or p_month>=date_trunc('month',now() at time zone 'Africa/Conakry')::date then
    raise exception 'Le rapport définitif est généré uniquement pour un mois terminé';
  end if;
  select name into client_name from public.clients where id=p_client and tenant_owner_id=p_tenant;
  if not found then raise exception 'Client introuvable dans cet espace';end if;
  select id into report_id from public.client_monthly_reports where tenant_owner_id=p_tenant and client_id=p_client and month=p_month;
  if found then return report_id;end if;
  select jsonb_build_object('publications',publications,'videos',videos,'reels',reels,'notes',notes)
    into target from public.client_monthly_commitments where tenant_owner_id=p_tenant and client_id=p_client and month=p_month;
  if target is null then
    select jsonb_build_object('publications',publications,'videos',videos,'reels',reels,'notes',notes,'effective_month',effective_month)
      into target from public.client_service_commitments where tenant_owner_id=p_tenant and client_id=p_client and effective_month<=p_month
      order by effective_month desc limit 1;
  end if;
  select jsonb_build_object('publications',count(*) filter(where format='PUBLICATION'),'videos',count(*) filter(where format='VIDEO'),'reels',count(*) filter(where format='REEL'))
    into results from (
      select case when upper(coalesce(nullif(content_type,''),post_type,'')) like '%REEL%' then 'REEL'
        when upper(coalesce(nullif(content_type,''),post_type,'')) similar to '%(VIDEO|VIDÉO)%' then 'VIDEO' else 'PUBLICATION' end as format
      from public.editorial_items where tenant_owner_id=p_tenant and client_id=p_client and status='PUBLIE'
        and publish_at>=p_month::timestamp at time zone 'Africa/Conakry'
        and publish_at<(p_month+interval '1 month')::timestamp at time zone 'Africa/Conakry'
    ) items;
  select coalesce(jsonb_agg(jsonb_build_object('network',b.network,'account_key',b.account_key,'baseline',to_jsonb(b),'latest',to_jsonb(s)) order by b.network,b.account_key),'[]'::jsonb)
    into social from public.client_social_measurements b
    left join lateral (select * from public.client_social_measurements m where m.tenant_owner_id=p_tenant and m.client_id=p_client
      and m.network=b.network and m.account_key=b.account_key and m.kind='SNAPSHOT'
      and m.measured_on>=p_month and m.measured_on<p_month+interval '1 month' and m.measured_on>=b.measured_on
      order by measured_on desc limit 1) s on true
    where b.tenant_owner_id=p_tenant and b.client_id=p_client and b.kind='BASELINE' and b.measured_on<p_month+interval '1 month';
  insert into public.client_monthly_reports(tenant_owner_id,client_id,month,payload)
    values(p_tenant,p_client,p_month,jsonb_build_object('client_name',client_name,'month',to_char(p_month,'YYYY-MM'),
      'commitments',target,'delivered',results,'social',social,'method','Un contenu publié compte une fois. Publications hors vidéos/reels ; vidéos hors reels. Statistiques saisies et datées, non synchronisées automatiquement.'))
    on conflict(tenant_owner_id,client_id,month) do nothing returning id into report_id;
  if report_id is null then select id into report_id from public.client_monthly_reports where tenant_owner_id=p_tenant and client_id=p_client and month=p_month;return report_id;end if;
  -- Make the report available to the correct portal users; never claim an email was sent.
  insert into public.notifications(tenant_owner_id,profile_id,channel,title,body,entity_type,entity_id)
    select p_tenant,a.profile_id,'IN_APP','Votre rapport mensuel est disponible',
      'Consultez votre espace client, rubrique Performance, pour le bilan de '||to_char(p_month,'MM/YYYY')||'.','client_report',report_id
    from public.client_portal_access a join public.profiles p on p.id=a.profile_id and p.tenant_owner_id=p_tenant and p.active
    where a.tenant_owner_id=p_tenant and a.client_id=p_client and a.active;
  return report_id;
end $$;
revoke all on function public.build_client_monthly_report(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.build_client_monthly_report(uuid,uuid,date) to service_role;

create or replace function public.generate_client_monthly_report(p_client uuid,p_month date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or not public.action_allowed('clients.update') or public.has_role('CLIENT') then
    raise exception 'Vous n’avez pas les droits pour générer un rapport client';
  end if;
  return public.build_client_monthly_report(public.current_tenant_owner_id(),p_client,p_month);
end $$;
revoke all on function public.generate_client_monthly_report(uuid,date) from public,anon;
grant execute on function public.generate_client_monthly_report(uuid,date) to authenticated;

create or replace function public.generate_due_client_monthly_reports()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare target record; count_reports integer:=0; previous_month date:=(date_trunc('month',now() at time zone 'Africa/Conakry')-interval '1 month')::date;
begin
  for target in select tenant_owner_id,client_id from public.client_monthly_commitments where month=previous_month
    union select tenant_owner_id,client_id from public.client_service_commitments where effective_month<=previous_month loop
    perform public.build_client_monthly_report(target.tenant_owner_id,target.client_id,previous_month);
    count_reports:=count_reports+1;
  end loop;
  return count_reports;
end $$;
revoke all on function public.generate_due_client_monthly_reports() from public,anon,authenticated;
grant execute on function public.generate_due_client_monthly_reports() to service_role;
-- Database-local automation. No third-party credentials or outbound SMS/email.
do $$ begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('smartsell-client-monthly-reports','5 0 1 * *','select public.generate_due_client_monthly_reports()');
  else raise notice 'pg_cron absent : activer le planificateur pour les rapports mensuels automatiques';end if;
end $$;
commit;
