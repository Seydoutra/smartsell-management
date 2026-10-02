-- Extend the existing tenant-isolated commercial documents with editable drafts.
begin;
alter table public.commercial_documents drop constraint if exists commercial_documents_kind_check;
alter table public.commercial_documents add constraint commercial_documents_kind_check
check(kind in ('BON_COMMANDE','BON_LIVRAISON','BON_VENTE','BON_SORTIE','BON_ENTREE',
               'CONTRAT_CLIENT','OFFRE_COMMUNICATION','ORDRE_MISSION','PROPOSITION_COMMERCIALE'));

create or replace function public.create_commercial_document(
  p_kind text,p_client_id uuid,p_project_id uuid,p_expected_date date,p_currency text,p_total numeric,p_notes text
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_number text; prefix text;
begin
  if not public.action_allowed('documents.create') then raise exception 'Permission denied'; end if;
  prefix := case p_kind
    when 'BON_COMMANDE' then 'BC' when 'BON_LIVRAISON' then 'BL'
    when 'BON_VENTE' then 'BV' when 'BON_ENTREE' then 'BE'
    when 'BON_SORTIE' then 'BS' when 'CONTRAT_CLIENT' then 'CC'
    when 'OFFRE_COMMUNICATION' then 'OC' when 'ORDRE_MISSION' then 'OM'
    when 'PROPOSITION_COMMERCIALE' then 'PC' else null end;
  if prefix is null then raise exception 'Type de document invalide'; end if;
  v_number := prefix||'-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.commercial_document_seq')::text,4,'0');
  insert into public.commercial_documents(number,kind,client_id,project_id,expected_date,currency,total,notes,created_by)
  values(v_number,p_kind,p_client_id,p_project_id,p_expected_date,coalesce(p_currency,'GNF'),coalesce(p_total,0),p_notes,auth.uid()) returning id into v_id;
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'CREATE','commercial_document',v_id,jsonb_build_object('number',v_number,'kind',p_kind));
  return v_id;
end $$;
commit;
