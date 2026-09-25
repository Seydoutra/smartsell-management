-- DANGER : ce script efface les données métier, mais conserve les comptes utilisateurs.
-- Ne l'exécutez qu'après confirmation et sauvegarde.
begin;
truncate table
  public.publication_notifications, public.communication_logs, public.campaign_recipients,
  public.communication_jobs, public.campaigns, public.communication_templates,
  public.call_logs, public.notifications, public.activity_logs, public.user_sessions,
  public.documents, public.contracts, public.purchase_requests, public.equipment_movements,
  public.equipment_bookings, public.equipment, public.expenses, public.payments,
  public.invoice_items, public.invoices, public.quote_items, public.quotes,
  public.editorial_comments, public.editorial_items, public.shoot_members, public.shoots,
  public.task_comments, public.tasks, public.project_members, public.projects,
  public.prospect_activities, public.prospects, public.client_contacts, public.clients
restart identity cascade;
commit;
