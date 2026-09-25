-- SmartSell V5 — index ciblés pour accélérer les listes et les fiches liées.
create index if not exists idx_projects_client_created on public.projects(client_id, created_at desc);
create index if not exists idx_projects_manager on public.projects(manager_id) where manager_id is not null;
create index if not exists idx_tasks_project_created on public.tasks(project_id, created_at desc);
create index if not exists idx_tasks_assignee_due on public.tasks(assignee_id, due_at) where assignee_id is not null;
create index if not exists idx_tasks_status_due on public.tasks(status, due_at) where due_at is not null;
create index if not exists idx_invoices_client_created on public.invoices(client_id, created_at desc);
create index if not exists idx_invoices_project on public.invoices(project_id) where project_id is not null;
create index if not exists idx_activity_actor_created on public.activity_logs(actor_id, created_at desc);
create index if not exists idx_sessions_profile_seen on public.user_sessions(profile_id, last_seen_at desc);
create index if not exists idx_communication_sender_date on public.communication_logs(sent_by, sent_at desc);
