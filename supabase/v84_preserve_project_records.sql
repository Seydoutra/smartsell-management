begin;
-- Business and operational records outlive a deleted project. Memberships and
-- project-specific suggestions retain their existing cascade semantics.
do $$declare r record;begin
 for r in select conname,conrelid::regclass as relation from pg_constraint
 where contype='f' and confrelid='public.projects'::regclass
 and conrelid in ('public.tasks'::regclass,'public.editorial_items'::regclass,'public.shoots'::regclass,'public.invoices'::regclass,'public.quotes'::regclass,'public.expenses'::regclass,'public.equipment_bookings'::regclass,'public.contracts'::regclass,'public.documents'::regclass,'public.commercial_documents'::regclass)
 loop
 execute format('alter table %s drop constraint %I',r.relation,r.conname);
 execute format('alter table %s add constraint %I foreign key(project_id) references public.projects(id) on delete set null',r.relation,r.conname);
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
