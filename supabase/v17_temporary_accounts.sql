-- Comptes d'essai à durée limitée.
-- L'accès est coupé dynamiquement à l'échéance, sans tâche planifiée.

alter table public.profiles
  add column if not exists is_temporary boolean not null default false,
  add column if not exists access_expires_at timestamptz;

alter table public.profiles drop constraint if exists profiles_temporary_expiry_check;
alter table public.profiles add constraint profiles_temporary_expiry_check
  check ((not is_temporary and access_expires_at is null) or (is_temporary and access_expires_at is not null));

create index if not exists idx_profiles_access_expires_at
  on public.profiles(access_expires_at)
  where access_expires_at is not null;

create or replace function public.current_account_has_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select active and (access_expires_at is null or access_expires_at > now())
    from public.profiles
    where id = auth.uid()
  ), false)
$$;

revoke all on function public.current_account_has_access() from public, anon;
grant execute on function public.current_account_has_access() to authenticated;

do $$
declare
  table_row record;
begin
  for table_row in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and tablename <> 'profiles'
      and rowsecurity = true
  loop
    execute format('drop policy if exists valid_account_access on %I.%I', table_row.schemaname, table_row.tablename);
    execute format(
      'create policy valid_account_access on %I.%I as restrictive for all to authenticated using (public.current_account_has_access()) with check (public.current_account_has_access())',
      table_row.schemaname,
      table_row.tablename
    );
  end loop;
end
$$;

comment on column public.profiles.access_expires_at is 'Échéance du compte d’essai. NULL pour un compte permanent.';
