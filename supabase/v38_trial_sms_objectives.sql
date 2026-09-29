begin;
create table if not exists public.trial_sms_usage (
 id uuid primary key default gen_random_uuid(),
 tenant_owner_id uuid not null references public.profiles(id) on delete cascade,
 phone text not null, created_at timestamptz not null default now()
);
alter table public.trial_sms_usage enable row level security;
revoke all on public.trial_sms_usage from public,anon,authenticated;
grant all on public.trial_sms_usage to service_role;
create or replace function public.trial_sms_status(p_tenant uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.profiles; ph text; deadline timestamptz; used integer;
begin
 select * into p from public.profiles where id=p_tenant and tenant_owner_id=id;
 if not found or not p.active or not p.is_temporary or coalesce(p.is_beta_tester,false) then return jsonb_build_object('eligible',false,'remaining',0); end if;
 deadline:=least(p.access_expires_at,p.created_at+interval '72 hours');
 if deadline is null or deadline<=now() then return jsonb_build_object('eligible',false,'remaining',0); end if;
 select regexp_replace(c.phone,'[^0-9]','','g') into ph from public.signup_otp_challenges c
 where lower(c.email)=lower(p.email) and c.verified_at is not null
 and regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(p.phone,'[^0-9]','','g')
 order by c.verified_at desc limit 1;
 if ph is null then return jsonb_build_object('eligible',false,'remaining',0,'reason','Numéro vérifié par SMS requis'); end if;
 select count(*) into used from public.trial_sms_usage where tenant_owner_id=p_tenant or phone=ph;
 return jsonb_build_object('eligible',true,'remaining',greatest(0,5-used),'limit',5,'expires_at',deadline,'phone',ph);
end $$;
create or replace function public.reserve_trial_sms(p_tenant uuid,p_phone text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb;
begin
 -- Serialize reservations across accounts sharing the same verified number.
 perform pg_advisory_xact_lock(hashtextextended(p_phone,38));
 perform 1 from public.profiles where id=p_tenant for update;
 s:=public.trial_sms_status(p_tenant);
 if not coalesce((s->>'eligible')::boolean,false) or (s->>'remaining')::integer<1 or s->>'phone' is distinct from p_phone then
  raise exception 'Essai SMS indisponible : quota épuisé, essai terminé ou numéro non vérifié';
 end if;
 insert into public.trial_sms_usage(tenant_owner_id,phone) values(p_tenant,p_phone);
end $$;
revoke all on function public.trial_sms_status(uuid), public.reserve_trial_sms(uuid,text) from public,anon,authenticated;
grant execute on function public.trial_sms_status(uuid), public.reserve_trial_sms(uuid,text) to service_role;

create table if not exists public.performance_goals (
 id uuid primary key default gen_random_uuid(), tenant_owner_id uuid not null references public.profiles(id),
 title text not null, metric text not null, target numeric not null check(target>0), period date not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','CLOSED')),
 plan jsonb not null default '[]', review text not null default '', revision integer not null default 1,
 created_by uuid not null references public.profiles(id), validated_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.performance_goals enable row level security;
revoke all on public.performance_goals from public,anon,authenticated;
grant all on public.performance_goals to service_role;
create index if not exists performance_goals_tenant on public.performance_goals(tenant_owner_id,period);
create table if not exists public.performance_goal_events (
 id uuid primary key default gen_random_uuid(),goal_id uuid references public.performance_goals(id) on delete cascade,
 actor_id uuid references public.profiles(id),action text not null,created_at timestamptz not null default now()
);
alter table public.performance_goal_events enable row level security;
revoke all on public.performance_goal_events from public,anon,authenticated;
grant all on public.performance_goal_events to service_role;
create or replace function public.performance_goal_command(p_actor uuid,p_body jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
<<goal_cmd>>
declare actor public.profiles; tenant uuid; manager boolean; mode text:=coalesce(p_body->>'mode','list');
 g public.performance_goals; plan jsonb; step jsonb; stepid text; total numeric:=0; actual numeric; month_start date;
 result jsonb; team jsonb; goal_id uuid; found_step boolean:=false;
begin
 select * into actor from public.profiles where id=p_actor;
 if not found or not actor.active or (actor.access_expires_at is not null and actor.access_expires_at<=now()) or actor.role::text='CLIENT' then raise exception 'Accès refusé'; end if;
 tenant:=coalesce(actor.tenant_owner_id,actor.id);
 manager:=actor.role::text in ('SUPER_ADMIN','ADMIN','MANAGER') or coalesce(actor.roles::text[] && array['SUPER_ADMIN','ADMIN','MANAGER'],false);
 if mode<>'list' then
  if mode='create' then
   if not manager then raise exception 'Création réservée au manager'; end if;
   month_start:=date_trunc('month',(p_body->>'period')::date)::date;
   if month_start is null or length(trim(coalesce(p_body->>'title',''))) not between 1 and 200 or length(trim(coalesce(p_body->>'metric',''))) not between 1 and 80 or not coalesce((p_body->>'target')::numeric between 0.01 and 1e15,false) then raise exception 'Objectif invalide'; end if;
   insert into public.performance_goals(tenant_owner_id,title,metric,target,period,created_by)
   values(tenant,trim(p_body->>'title'),trim(p_body->>'metric'),(p_body->>'target')::numeric,month_start,p_actor) returning * into g;
  else
   select * into g from public.performance_goals where id=(p_body->>'id')::uuid and tenant_owner_id=tenant for update;
   if not found then raise exception 'Objectif introuvable'; end if;
   if g.revision is distinct from (p_body->>'revision')::integer then raise exception 'Objectif modifié entre-temps. Actualisez la page.'; end if;
  end if;
  if mode in ('create','plan','validate') then
   if not manager or g.status<>'DRAFT' then raise exception 'Seul le manager peut répartir un brouillon'; end if;
   plan:=coalesce(p_body->'plan',g.plan);
   if jsonb_typeof(plan)<>'array' or jsonb_array_length(plan) not between 1 and 400 then raise exception 'Répartition requise (400 étapes maximum)'; end if;
   if (select count(distinct x->>'id') from jsonb_array_elements(plan) x)<>jsonb_array_length(plan) then raise exception 'Identifiants des étapes dupliqués'; end if;
   for step in select * from jsonb_array_elements(plan) loop
    if coalesce(step->>'id','')='' or length(coalesce(step->>'activity','')) not between 1 and 500 or length(coalesce(step->>'team',''))>100 or not coalesce((step->>'target')::numeric between 0.01 and 1e15,false) or not coalesce((step->>'week')::integer between 1 and 4,false) or step->>'due_on' is null then raise exception 'Étape invalide'; end if;
    if not exists(select 1 from public.profiles where id=(step->>'profile_id')::uuid and tenant_owner_id=tenant and active and role::text<>'CLIENT') then raise exception 'Responsable hors de votre entreprise'; end if;
    if (step->>'due_on')::date < g.period or (step->>'due_on')::date >= g.period+interval '1 month' then raise exception 'Échéance hors du mois'; end if;
    total:=total+(step->>'target')::numeric;
   end loop;
   if mode='validate' and abs(total-g.target)>0.01 then raise exception 'La somme des étapes doit être égale à la cible'; end if;
   select jsonb_agg(x||jsonb_build_object('actual',0,'note','')) into plan from jsonb_array_elements(plan) x;
   update public.performance_goals pg set plan=goal_cmd.plan,status=case when mode='validate' then 'ACTIVE' else 'DRAFT' end,
     validated_by=case when mode='validate' then p_actor else null end,revision=pg.revision+1,updated_at=now() where pg.id=g.id;
  elsif mode='progress' then
   if g.status<>'ACTIVE' then raise exception 'Objectif non actif'; end if;
   actual:=(p_body->>'actual')::numeric;
   if actual is null or actual<0 or actual>1e15 or length(coalesce(p_body->>'note',''))>2000 then raise exception 'Progression invalide'; end if;
   plan:='[]'; stepid:=p_body->>'step_id';
   for step in select * from jsonb_array_elements(g.plan) loop
    if step->>'id'=stepid then
     if not manager and step->>'profile_id'<>p_actor::text then raise exception 'Vous ne pouvez modifier que vos étapes'; end if;
     found_step:=true; step:=step||jsonb_build_object('actual',actual,'note',coalesce(p_body->>'note',''),'updated_at',now());
    end if;
    plan:=plan||jsonb_build_array(step);
   end loop;
   if not found_step then raise exception 'Étape introuvable'; end if;
   update public.performance_goals pg set plan=goal_cmd.plan,revision=pg.revision+1,updated_at=now() where pg.id=g.id;
  elsif mode='close' then
   if not manager or g.status<>'ACTIVE' or length(trim(coalesce(p_body->>'review',''))) not between 1 and 4000 then raise exception 'Bilan du manager requis'; end if;
   update public.performance_goals pg set status='CLOSED',review=p_body->>'review',revision=pg.revision+1,updated_at=now() where pg.id=g.id;
  else raise exception 'Action inconnue'; end if;
  insert into public.performance_goal_events(goal_id,actor_id,action) values(g.id,p_actor,mode);
 end if;
 select coalesce(jsonb_agg(to_jsonb(pg) order by pg.period desc,pg.created_at desc),'[]') into result from public.performance_goals pg
 where pg.tenant_owner_id=tenant and (manager or (pg.status<>'DRAFT' and exists(select 1 from jsonb_array_elements(pg.plan) x where x->>'profile_id'=p_actor::text)));
 if not manager then
  select coalesce(jsonb_agg(x||jsonb_build_object('plan',(select jsonb_agg(s) from jsonb_array_elements(x->'plan') s where s->>'profile_id'=p_actor::text))),'[]') into result from jsonb_array_elements(result) x;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by full_name),'[]') into team from public.profiles
 where tenant_owner_id=tenant and active and role::text<>'CLIENT' and (manager or id=p_actor);
 return jsonb_build_object('can_manage',manager,'actor_id',p_actor,'goals',result,'team',team);
end $$;
revoke all on function public.performance_goal_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.performance_goal_command(uuid,jsonb) to service_role;
commit;
