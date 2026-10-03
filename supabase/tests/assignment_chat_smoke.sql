-- À exécuter sur un espace ayant au moins deux collaborateurs actifs.
-- Toutes les écritures (y compris SMS en attente) sont annulées.
begin;
do $$
declare tenant uuid; first_user uuid; second_user uuid;
  test_project_id uuid; test_task_id uuid; test_message_id uuid; total integer;
begin
  select tenant_owner_id,(array_agg(id order by id))[1],(array_agg(id order by id))[2]
  into tenant,first_user,second_user
  from public.profiles
  where active and role::text<>'CLIENT' and tenant_owner_id is not null
  group by tenant_owner_id having count(*)>=2 limit 1;
  if tenant is null then raise notice 'SKIP: deux collaborateurs actifs requis'; return; end if;

  insert into public.projects(name,tenant_owner_id,manager_id)
  values('Test notification projet',tenant,first_user) returning id into test_project_id;
  insert into public.project_members(project_id,profile_id,tenant_owner_id,role)
  values(test_project_id,first_user,tenant,'RESPONSABLE');
  select count(*) into total from public.notifications
  where entity_type='project' and entity_id=test_project_id and profile_id=first_user;
  if total<>1 then raise exception 'Projet responsable: attendu 1 alerte, obtenu %',total; end if;
  insert into public.project_members(project_id,profile_id,tenant_owner_id,role)
  values(test_project_id,second_user,tenant,'MEMBRE');
  delete from public.project_members where project_id=test_project_id and profile_id=second_user;
  insert into public.project_members(project_id,profile_id,tenant_owner_id,role)
  values(test_project_id,second_user,tenant,'MEMBRE');
  select count(*) into total from public.notifications
  where entity_type='project' and entity_id=test_project_id and profile_id=second_user;
  if total<>2 then raise exception 'Projet réattribué: attendu 2 alertes, obtenu %',total; end if;

  insert into public.tasks(title,tenant_owner_id,assignee_id,notification_channels)
  values('Test notification tâche',tenant,first_user,array['IN_APP','SMS']) returning id into test_task_id;
  insert into public.task_assignees(task_id,profile_id,tenant_owner_id)
  values(test_task_id,first_user,tenant);
  select count(*) into total from public.notifications
  where entity_type='task' and entity_id=test_task_id and profile_id=first_user;
  if total<>1 then raise exception 'Tâche responsable: attendu 1 alerte, obtenu %',total; end if;
  insert into public.task_assignees(task_id,profile_id,tenant_owner_id)
  values(test_task_id,second_user,tenant);
  delete from public.task_assignees where task_id=test_task_id and profile_id=second_user;
  insert into public.task_assignees(task_id,profile_id,tenant_owner_id)
  values(test_task_id,second_user,tenant);
  select count(*) into total from public.notifications
  where entity_type='task' and entity_id=test_task_id and profile_id=second_user;
  if total<>2 then raise exception 'Tâche réattribuée: attendu 2 alertes, obtenu %',total; end if;

  insert into public.team_chat_messages(sender_id,recipient_id,tenant_owner_id,body)
  values(first_user,second_user,tenant,'Test privé annulé') returning id into test_message_id;
  select count(*) into total from public.notifications
  where entity_type='team_chat' and entity_id=test_message_id and profile_id=second_user;
  if total<>1 then raise exception 'Chat privé: attendu 1 alerte, obtenu %',total; end if;
  select count(*) into total from public.notifications
  where entity_type='team_chat' and entity_id=test_message_id and profile_id<>second_user;
  if total<>0 then raise exception 'Chat privé visible par un tiers'; end if;
  raise notice 'OK: affectations, réaffectations et chat privé';
end $$;
rollback;
