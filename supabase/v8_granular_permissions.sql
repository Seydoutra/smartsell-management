-- Autorisations fines par action. Les politiques RESTRICTIVE complètent les
-- politiques de rôles existantes : les deux niveaux doivent autoriser l'action.
create or replace function public.action_allowed(required_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.has_role('SUPER_ADMIN')
    or not exists (
      select 1
      from public.user_access_controls access
      where access.profile_id = auth.uid()
        and required_action = any(coalesce(access.denied_permissions, '{}'::text[]))
    ),
    false
  )
$$;

do $$
declare
  item record;
  policy_prefix text;
begin
  for item in
    select * from (values
      ('clients','clients'),
      ('projects','projects'),
      ('tasks','tasks'),
      ('editorial_items','editorial'),
      ('services','services'),
      ('suppliers','suppliers'),
      ('invoices','invoices'),
      ('invoice_items','invoices'),
      ('quotes','invoices'),
      ('quote_items','invoices'),
      ('commercial_documents','documents'),
      ('expenses','accounting'),
      ('payments','accounting'),
      ('equipment','equipment')
    ) as permissions(table_name, scope)
  loop
    if to_regclass('public.' || item.table_name) is null then
      continue;
    end if;
    policy_prefix := 'granular_' || item.table_name;
    execute format('drop policy if exists %I_select on public.%I', policy_prefix, item.table_name);
    execute format('create policy %I_select on public.%I as restrictive for select to authenticated using (public.action_allowed(%L))', policy_prefix, item.table_name, item.scope || '.view');
    execute format('drop policy if exists %I_insert on public.%I', policy_prefix, item.table_name);
    execute format('create policy %I_insert on public.%I as restrictive for insert to authenticated with check (public.action_allowed(%L))', policy_prefix, item.table_name, item.scope || '.create');
    execute format('drop policy if exists %I_update on public.%I', policy_prefix, item.table_name);
    execute format('create policy %I_update on public.%I as restrictive for update to authenticated using (public.action_allowed(%L)) with check (public.action_allowed(%L))', policy_prefix, item.table_name, item.scope || '.update', item.scope || '.update');
    execute format('drop policy if exists %I_delete on public.%I', policy_prefix, item.table_name);
    execute format('create policy %I_delete on public.%I as restrictive for delete to authenticated using (public.action_allowed(%L))', policy_prefix, item.table_name, item.scope || '.delete');
  end loop;
end $$;

grant execute on function public.action_allowed(text) to authenticated;
