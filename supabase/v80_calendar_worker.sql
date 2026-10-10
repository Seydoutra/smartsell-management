begin;
-- Use the existing Vault-backed invocation; never place credentials in SQL.
do $$declare source text;begin
 select command into source from cron.job where jobname='smartsell-task-reminders' and active and command like '%vault%' limit 1;
 if source is null then raise exception 'Invocation sécurisée des rappels introuvable';end if;
 perform cron.schedule('smartsell-google-calendar-sync','*/5 * * * *',replace(source,'task-reminders','google-calendar-sync'));
end$$;
commit;
