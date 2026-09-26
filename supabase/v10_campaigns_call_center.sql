-- SmartSell V10 — campagnes marketing planifiées et journal d'appels enrichi.
alter table public.call_logs add column if not exists outcome text;
alter table public.call_logs add column if not exists notes text;

create index if not exists idx_campaigns_due on public.campaigns(status, scheduled_at);
create index if not exists idx_campaign_recipients_campaign on public.campaign_recipients(campaign_id, status);
create index if not exists idx_call_logs_contact on public.call_logs(contact_type, contact_id, created_at desc);

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'smartsell-campaign-dispatch';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end $$;
select cron.schedule(
  'smartsell-campaign-dispatch',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://insqsizvcbvgfysqlxte.supabase.co/functions/v1/campaign-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := '{}'::jsonb
  );
  $cron$
);
