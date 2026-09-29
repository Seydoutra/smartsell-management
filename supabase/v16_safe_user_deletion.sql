-- Suppression sûre d'un collaborateur.
-- Les données personnelles sont supprimées, les références métier facultatives
-- sont anonymisées et les références obligatoires sont réattribuées à l'admin.

create or replace function public.prepare_user_deletion(
  target_profile_id uuid,
  acting_profile_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_is_super_admin boolean := false;
  reference_row record;
  affected_rows bigint := 0;
  total_affected bigint := 0;
  personal_tables constant text[] := array[
    'shoot_members',
    'leave_requests'
  ];
begin
  if target_profile_id is null or acting_profile_id is null then
    raise exception 'Utilisateur ou administrateur manquant.';
  end if;
  if target_profile_id = acting_profile_id then
    raise exception 'Vous ne pouvez pas supprimer votre propre compte.';
  end if;

  select coalesce(p.role::text = 'SUPER_ADMIN', false)
      or coalesce('SUPER_ADMIN' = any(p.roles::text[]), false)
    into actor_is_super_admin
  from public.profiles p
  where p.id = acting_profile_id;

  if not coalesce(actor_is_super_admin, false) then
    raise exception 'Seul le super administrateur peut supprimer un utilisateur.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = target_profile_id) then
    raise exception 'Utilisateur introuvable.';
  end if;

  -- Les contraintes ON DELETE CASCADE se chargeront d'elles-mêmes au moment
  -- de la suppression Auth. Nous préparons uniquement les autres références.
  for reference_row in
    select
      source_namespace.nspname as schema_name,
      source_table.relname as table_name,
      source_column.attname as column_name,
      source_column.attnotnull as is_required
    from pg_constraint constraint_row
    join pg_class source_table on source_table.oid = constraint_row.conrelid
    join pg_namespace source_namespace on source_namespace.oid = source_table.relnamespace
    join pg_attribute source_column
      on source_column.attrelid = constraint_row.conrelid
     and source_column.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.profiles'::regclass
      and array_length(constraint_row.conkey, 1) = 1
      and constraint_row.confdeltype <> 'c'
      and source_namespace.nspname = 'public'
  loop
    if reference_row.table_name = any(personal_tables) then
      execute format(
        'delete from %I.%I where %I = $1',
        reference_row.schema_name,
        reference_row.table_name,
        reference_row.column_name
      ) using target_profile_id;
    elsif reference_row.is_required then
      execute format(
        'update %I.%I set %I = $1 where %I = $2',
        reference_row.schema_name,
        reference_row.table_name,
        reference_row.column_name,
        reference_row.column_name
      ) using acting_profile_id, target_profile_id;
    else
      execute format(
        'update %I.%I set %I = null where %I = $1',
        reference_row.schema_name,
        reference_row.table_name,
        reference_row.column_name,
        reference_row.column_name
      ) using target_profile_id;
    end if;

    get diagnostics affected_rows = row_count;
    total_affected := total_affected + affected_rows;
  end loop;

  return jsonb_build_object('prepared', true, 'references_updated', total_affected);
end;
$$;

revoke all on function public.prepare_user_deletion(uuid, uuid) from public;
revoke all on function public.prepare_user_deletion(uuid, uuid) from anon;
revoke all on function public.prepare_user_deletion(uuid, uuid) from authenticated;
grant execute on function public.prepare_user_deletion(uuid, uuid) to service_role;
