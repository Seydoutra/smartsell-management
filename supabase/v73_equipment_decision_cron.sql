-- Run after deploying equipment-decision-notify. Reuse the existing protected cron invocation.
-- Secrets remain inside Vault; no credential is copied into the repository or browser.
do $$begin
 if not exists(select 1 from cron.job where jobname='smartsell-task-reminders' and active and command like '%task-reminders%') then
  raise exception 'Planificateur SMS existant manquant : configuration accompagnée requise';
 end if;
 perform cron.schedule('smartsell-equipment-decisions','* * * * *',replace(command,'task-reminders','equipment-decision-notify'))
 from cron.job where jobname='smartsell-task-reminders' and active;
end $$;
