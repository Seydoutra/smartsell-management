-- SmartSell V21 — encouragements SMS quotidiens et hebdomadaires.
create table if not exists public.team_digest_deliveries(
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('EVENING','WEEKLY')), digest_date date not null, status text not null, error text, created_at timestamptz not null default now(), unique(profile_id,kind,digest_date)
);
alter table public.team_digest_deliveries enable row level security;
revoke all on public.team_digest_deliveries from anon, authenticated;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$ declare job_id bigint; begin
  select jobid into job_id from cron.job where jobname='smartsell-team-evening-digest'; if job_id is not null then perform cron.unschedule(job_id); end if;
  select jobid into job_id from cron.job where jobname='smartsell-team-weekly-digest'; if job_id is not null then perform cron.unschedule(job_id); end if;
end $$;
select cron.schedule('smartsell-team-evening-digest','30 17 * * *',$cron$select net.http_post(url:='https://insqsizvcbvgfysqlxte.supabase.co/functions/v1/team-digest',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.settings.anon_key',true)),body:='{"kind":"EVENING"}'::jsonb);$cron$);
select cron.schedule('smartsell-team-weekly-digest','00 16 * * 5',$cron$select net.http_post(url:='https://insqsizvcbvgfysqlxte.supabase.co/functions/v1/team-digest',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||current_setting('app.settings.anon_key',true)),body:='{"kind":"WEEKLY"}'::jsonb);$cron$);
