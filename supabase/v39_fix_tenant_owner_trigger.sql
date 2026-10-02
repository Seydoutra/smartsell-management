-- The same trigger is attached to tables whose primary key can be UUID or BIGINT.
-- PostgreSQL resolves CASE/COALESCE operand types even when a branch is not taken.
-- Keep the profile fallback separate so inserts into activity_logs work again.
create or replace function public.assign_tenant_owner() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_id uuid;
begin
  if new.tenant_owner_id is null then
    select coalesce(p.tenant_owner_id,p.id) into owner_id
    from public.profiles p where p.id=auth.uid();
    new.tenant_owner_id := owner_id;
    if new.tenant_owner_id is null and tg_table_name='profiles' then
      new.tenant_owner_id := new.id;
    end if;
  end if;
  return new;
end $$;
