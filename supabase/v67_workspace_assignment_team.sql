begin;
create or replace function public.list_assignment_team() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not (public.action_allowed('projects.view') or public.action_allowed('tasks.view') or public.action_allowed('planning.view') or public.action_allowed('team.view')) then raise exception 'Consultation de l’équipe non autorisée';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'tenant_owner_id',p.tenant_owner_id,'full_name',p.full_name,'role',p.role,'roles',p.roles,'active',p.active,'avatar_url',p.avatar_url) order by p.full_name) from public.profiles p
 where coalesce(p.tenant_owner_id,p.id)=public.current_tenant_owner_id() and p.active and not 'CLIENT'=any(coalesce(p.roles,array[p.role]))),'[]'::jsonb);
end $$;
revoke all on function public.list_assignment_team() from public,anon;
grant execute on function public.list_assignment_team() to authenticated;

create or replace function public.validate_workspace_assignee() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid; assignee uuid;begin
 if tg_table_name='tasks' then
  if tg_op='UPDATE' and new.assignee_id is not distinct from old.assignee_id and new.tenant_owner_id is not distinct from old.tenant_owner_id then return new;end if;
  tenant:=new.tenant_owner_id;assignee:=new.assignee_id;
 elsif tg_table_name='projects' then
  if tg_op='UPDATE' and new.manager_id is not distinct from old.manager_id and new.tenant_owner_id is not distinct from old.tenant_owner_id then return new;end if;
  tenant:=new.tenant_owner_id;assignee:=new.manager_id;
 elsif tg_table_name='task_assignees' then
  select tenant_owner_id into tenant from public.tasks where id=new.task_id;assignee:=new.profile_id;
 else
  select tenant_owner_id into tenant from public.projects where id=new.project_id;assignee:=new.profile_id;
 end if;
 if assignee is not null and not exists(select 1 from profiles p where p.id=assignee and coalesce(p.tenant_owner_id,p.id)=tenant and p.active and not 'CLIENT'=any(coalesce(p.roles,array[p.role]))) then
  raise exception 'Attribution refusée : choisissez un collaborateur actif de votre entreprise, pas un client ni un compte d’une autre entreprise.';
 end if;
 return new;
end $$;
revoke all on function public.validate_workspace_assignee() from public,anon,authenticated;
do $$declare table_name text;begin
 foreach table_name in array array['tasks','projects','task_assignees','project_members'] loop
  execute format('drop trigger if exists zz_validate_workspace_assignee on public.%I',table_name);
  execute format('create trigger zz_validate_workspace_assignee before insert or update on public.%I for each row execute function public.validate_workspace_assignee()',table_name);
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
