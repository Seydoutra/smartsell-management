begin;
alter table public.performance_goals add column if not exists progress_source text not null default 'MANUAL' check(progress_source in ('MANUAL','BILLED','COLLECTED','TASKS'));
alter table public.performance_goals add column if not exists closed_actual numeric;

-- Internal evaluator: explicit tenant filter on every source; never callable by users.
create or replace function public.performance_goal_actual(p_goal uuid) returns numeric
language plpgsql security definer set search_path=public,pg_temp as $$
declare g public.performance_goals; n numeric;
begin
 select * into g from public.performance_goals where id=p_goal;
 if not found then return null; end if;
 if g.status='CLOSED' and g.closed_actual is not null then return g.closed_actual; end if;
 if g.progress_source='BILLED' then
 select coalesce(sum(total),0) into n from public.invoices where tenant_owner_id=g.tenant_owner_id and currency='GNF' and status not in ('BROUILLON','ANNULEE','ANNULE') and issue_date>=g.period and issue_date<g.period+interval '1 month';
 elsif g.progress_source='COLLECTED' then
 select coalesce(sum(p.amount),0) into n from public.payments p join public.invoices i on i.id=p.invoice_id where i.tenant_owner_id=g.tenant_owner_id and p.tenant_owner_id=g.tenant_owner_id and p.currency='GNF' and i.currency='GNF' and p.paid_at>=g.period::timestamp at time zone 'Africa/Conakry' and p.paid_at<(g.period+interval '1 month') at time zone 'Africa/Conakry';
 elsif g.progress_source='TASKS' then
 select count(*) into n from public.tasks where tenant_owner_id=g.tenant_owner_id and status='TERMINE' and completed_at>=g.period::timestamp at time zone 'Africa/Conakry' and completed_at<(g.period+interval '1 month') at time zone 'Africa/Conakry';
 else select coalesce(sum((x->>'actual')::numeric),0) into n from jsonb_array_elements(g.plan) x;
 end if;return n;
end $$;
revoke all on function public.performance_goal_actual(uuid) from public,anon,authenticated;

create or replace function public.freeze_goal_actual() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='CLOSED' and old.status<>'CLOSED' then new.closed_actual:=public.performance_goal_actual(old.id); end if;
 return new;
end $$;
revoke all on function public.freeze_goal_actual() from public,anon,authenticated;
drop trigger if exists freeze_goal_actual on public.performance_goals;
create trigger freeze_goal_actual before update on public.performance_goals for each row execute function public.freeze_goal_actual();

create or replace function public.performance_goal_cockpit() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.profiles; tenant uuid; manager boolean; finance boolean; tasks_allowed boolean; crm boolean; goals jsonb; avg_invoice numeric; won integer; lost integer; sources jsonb:='["MANUAL"]';
begin
 select * into a from public.profiles where id=auth.uid();
 if not found or not a.active or public.has_client_role(a.id) then raise exception 'Accès refusé'; end if;
 tenant:=coalesce(a.tenant_owner_id,a.id);
 manager:=a.role::text in ('SUPER_ADMIN','ADMIN','MANAGER') or coalesce(a.roles::text[] && array['SUPER_ADMIN','ADMIN','MANAGER'],false);
 if not manager then return jsonb_build_object('can_manage',false,'generated_at',now(),'goals','{}'::jsonb,'history','{}'::jsonb,'sources','[]'::jsonb); end if;
 finance:=public.member_action_allowed(a.id,'invoices.view') and public.member_action_allowed(a.id,'accounting.view');
 tasks_allowed:=public.member_action_allowed(a.id,'tasks.view');crm:=public.member_action_allowed(a.id,'clients.view');
 if finance then sources:=sources||'["BILLED","COLLECTED"]'::jsonb; end if;
 if tasks_allowed then sources:=sources||'["TASKS"]'::jsonb; end if;
 select coalesce(jsonb_object_agg(g.id,jsonb_build_object('source',g.progress_source,'actual',case when g.progress_source='MANUAL' or (g.progress_source in ('BILLED','COLLECTED') and finance) or (g.progress_source='TASKS' and tasks_allowed) then public.performance_goal_actual(g.id) else null end,'frozen',g.status='CLOSED','accessible',g.progress_source='MANUAL' or (g.progress_source in ('BILLED','COLLECTED') and finance) or (g.progress_source='TASKS' and tasks_allowed))),'{}') into goals from public.performance_goals g where g.tenant_owner_id=tenant;
 if finance then select avg(total) into avg_invoice from public.invoices where tenant_owner_id=tenant and currency='GNF' and total>0 and status not in ('BROUILLON','ANNULEE','ANNULE') and issue_date>=date_trunc('month',now())-interval '3 months' and issue_date<date_trunc('month',now()); end if;
 if crm then select count(*) filter(where stage='GAGNE'),count(*) filter(where stage='PERDU') into won,lost from public.prospects where tenant_owner_id=tenant; end if;
 return jsonb_build_object('can_manage',true,'generated_at',now(),'goals',goals,'history',jsonb_build_object('average_invoice',avg_invoice,'won',won,'lost',lost),'sources',sources);
end $$;
revoke all on function public.performance_goal_cockpit() from public,anon;
grant execute on function public.performance_goal_cockpit() to authenticated;

create or replace function public.set_performance_goal_source(p_id uuid,p_revision integer,p_source text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.profiles; g public.performance_goals;
begin
 select * into a from public.profiles where id=auth.uid();
 if not found or not a.active or public.has_client_role(a.id) or (a.access_expires_at is not null and a.access_expires_at<=now()) or not (a.role::text in ('SUPER_ADMIN','ADMIN','MANAGER') or coalesce(a.roles::text[] && array['SUPER_ADMIN','ADMIN','MANAGER'],false)) then raise exception 'Réservé au manager actif'; end if;
 select * into g from public.performance_goals where id=p_id and tenant_owner_id=coalesce(a.tenant_owner_id,a.id) for update;
 if not found or g.status='CLOSED' then raise exception 'Objectif introuvable ou clôturé'; end if;
 if g.revision is distinct from p_revision then raise exception 'Objectif modifié. Actualisez.'; end if;
 if p_source not in ('MANUAL','BILLED','COLLECTED','TASKS') or p_source is null then raise exception 'Source invalide'; end if;
 if p_source in ('BILLED','COLLECTED') and (not public.member_action_allowed(a.id,'invoices.view') or not public.member_action_allowed(a.id,'accounting.view') or g.metric not ilike '%GNF%') then raise exception 'Droits financiers et objectif GNF requis'; end if;
 if p_source='TASKS' and (not public.member_action_allowed(a.id,'tasks.view') or g.metric not ilike '%tâches%') then raise exception 'Droits tâches et objectif de tâches requis'; end if;
 update public.performance_goals set progress_source=p_source,revision=revision+1,updated_at=now() where id=g.id;
 insert into public.performance_goal_events(goal_id,actor_id,action) values(g.id,a.id,'source:'||p_source);
end $$;
revoke all on function public.set_performance_goal_source(uuid,integer,text) from public,anon;
grant execute on function public.set_performance_goal_source(uuid,integer,text) to authenticated;
-- The legacy service-role endpoint serializes full rows. Never expose the new
-- financial closure snapshot through that endpoint (including to assignees).
do $$
declare definition text;
begin
 select pg_get_functiondef('public.performance_goal_command(uuid,jsonb)'::regprocedure) into definition;
 if position('to_jsonb(pg)-''closed_actual''' in definition)=0 then
  if position('to_jsonb(pg)' in definition)=0 then raise exception 'Unrecognized goal command; migration aborted'; end if;
  definition:=replace(definition,'to_jsonb(pg)','(to_jsonb(pg)-''closed_actual'')');
  execute definition;
 end if;
end $$;
revoke all on function public.performance_goal_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.performance_goal_command(uuid,jsonb) to service_role;
commit;
