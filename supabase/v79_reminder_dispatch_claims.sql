-- A worker must reserve an item before contacting a paid provider.
-- PROCESSING is deliberately not retried automatically after a crash:
-- verify provider delivery before manually resetting a stranded item.
begin;
alter table public.task_assignment_sms drop constraint if exists task_assignment_sms_status_check;
alter table public.task_assignment_sms add constraint task_assignment_sms_status_check check(status in ('PENDING','PROCESSING','SENT','FAILED','CANCELLED'));
alter table public.project_assignment_sms drop constraint if exists project_assignment_sms_status_check;
alter table public.project_assignment_sms add constraint project_assignment_sms_status_check check(status in ('PENDING','PROCESSING','SENT','FAILED','CANCELLED'));
alter table public.task_reminder_schedule drop constraint if exists task_reminder_schedule_status_check;
alter table public.task_reminder_schedule add constraint task_reminder_schedule_status_check check(status in ('PENDING','PROCESSING','SENT','FAILED','CANCELLED'));
commit;
