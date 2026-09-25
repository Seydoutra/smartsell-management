-- À exécuter APRÈS setup.sql. Ajoute les opérations atomiques de facturation.
create sequence if not exists public.invoice_number_seq start 1;
create sequence if not exists public.quote_number_seq start 1;

create or replace function public.create_invoice_with_items(
  p_client_id uuid,
  p_project_id uuid,
  p_due_date date,
  p_currency text,
  p_discount numeric,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_invoice_id uuid;
  v_number text;
  v_total numeric(16,2);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_role() not in ('SUPER_ADMIN','ADMIN','MANAGER','COMPTABLE') then raise exception 'Permission denied'; end if;
  if not exists(select 1 from public.clients where id=p_client_id) then raise exception 'Client introuvable'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'La facture doit contenir au moins une ligne'; end if;
  select coalesce(sum((x->>'quantity')::numeric*(x->>'unit_price')::numeric*(1+coalesce((x->>'tax_rate')::numeric,0)/100)),0)-coalesce(p_discount,0)
    into v_total from jsonb_array_elements(p_items) x;
  if v_total < 0 then raise exception 'Total invalide'; end if;
  v_number := 'FAC-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('public.invoice_number_seq')::text,4,'0');
  insert into public.invoices(number,client_id,project_id,due_date,currency,discount,total,status)
  values(v_number,p_client_id,p_project_id,p_due_date,coalesce(p_currency,'GNF'),coalesce(p_discount,0),v_total,'BROUILLON') returning id into v_invoice_id;
  insert into public.invoice_items(invoice_id,description,quantity,unit_price,tax_rate,sort_order)
  select v_invoice_id,x->>'description',(x->>'quantity')::numeric,(x->>'unit_price')::numeric,coalesce((x->>'tax_rate')::numeric,0),ordinality-1
  from jsonb_array_elements(p_items) with ordinality as items(x,ordinality);
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'CREATE','invoice',v_invoice_id,jsonb_build_object('number',v_number,'total',v_total));
  return v_invoice_id;
end $$;

create or replace function public.record_invoice_payment(p_invoice_id uuid,p_amount numeric,p_method text,p_reference text default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_total numeric; v_paid numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_role() not in ('SUPER_ADMIN','ADMIN','MANAGER','COMPTABLE') then raise exception 'Permission denied'; end if;
  if p_amount<=0 then raise exception 'Montant invalide'; end if;
  select total into v_total from public.invoices where id=p_invoice_id for update;
  if v_total is null then raise exception 'Facture introuvable'; end if;
  insert into public.payments(invoice_id,amount,currency,method,reference,recorded_by)
  select id,p_amount,currency,p_method,p_reference,auth.uid() from public.invoices where id=p_invoice_id returning id into v_id;
  select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id=p_invoice_id;
  update public.invoices set status=case when v_paid>=v_total then 'PAYEE' else 'PARTIELLEMENT_PAYEE' end where id=p_invoice_id;
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'CREATE','payment',v_id,jsonb_build_object('invoice_id',p_invoice_id,'amount',p_amount));
  return v_id;
end $$;

grant execute on function public.create_invoice_with_items(uuid,uuid,date,text,numeric,jsonb) to authenticated;
grant execute on function public.record_invoice_payment(uuid,numeric,text,text) to authenticated;
