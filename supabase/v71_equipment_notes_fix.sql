-- Correct both departure and return: production equipment also has a notes column.
begin;
do $migration$
declare v_name text; v_definition text;
begin
 foreach v_name in array array['checkout_equipment_request','return_equipment_request'] loop
  select pg_get_functiondef(p.oid) into strict v_definition from pg_proc p
  where p.pronamespace='public'::regnamespace and p.proname=v_name;
  v_definition:=regexp_replace(v_definition,'\mnotes\M','v_condition_notes','g');
  -- Preserve the incoming JSON contract while qualifying the PL/pgSQL variable.
  v_definition:=replace(v_definition,'''v_condition_notes''','''notes''');
  execute v_definition;
 end loop;
end $migration$;
notify pgrst,'reload schema';
commit;
