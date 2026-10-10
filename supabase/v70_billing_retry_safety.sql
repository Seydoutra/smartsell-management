begin;
create or replace function public.record_invoice_payment_once(p_operation_id uuid,p_invoice_id uuid,p_amount numeric,p_method text,p_reference text default null,p_paid_at timestamptz default now(),p_cashbox text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare tenant uuid:=public.current_tenant_owner_id();receipt public.operation_receipts;payload jsonb;result uuid;
begin
 if auth.uid() is null or p_operation_id is null or not public.action_allowed('invoices.update') then raise exception 'Encaissement refusé';end if;
 if not exists(select 1 from invoices where id=p_invoice_id and tenant_owner_id=tenant) then raise exception 'Facture hors de votre espace';end if;
 payload:=jsonb_build_object('invoice_id',p_invoice_id,'amount',p_amount,'method',p_method,'reference',nullif(btrim(p_reference),''),'paid_at',p_paid_at,'cashbox',nullif(btrim(p_cashbox),''));
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||p_operation_id::text,0));
 select * into receipt from operation_receipts where tenant_owner_id=tenant and operation_id=p_operation_id;
 if found then
  if receipt.kind<>'PAIEMENT' or receipt.payload<>payload or receipt.author_id<>auth.uid() then raise exception 'Cette tentative correspond à un autre paiement. Consultez l’historique avant de modifier les champs.';end if;
  if not exists(select 1 from payments where id=receipt.result_id and tenant_owner_id=tenant) then raise exception 'Le paiement a été supprimé. Consultez l’historique avant de réessayer.';end if;
  return receipt.result_id;
 end if;
 result:=public.record_invoice_payment_details(p_invoice_id,p_amount,p_method,p_reference,p_paid_at,p_cashbox);
 insert into operation_receipts values(tenant,p_operation_id,auth.uid(),'PAIEMENT',payload,result,now());
 return result;
end $$;
revoke all on function public.record_invoice_payment_once(uuid,uuid,numeric,text,text,timestamptz,text) from public,anon;
grant execute on function public.record_invoice_payment_once(uuid,uuid,numeric,text,text,timestamptz,text) to authenticated;

create or replace function public.create_invoice_from_quote(p_quote_id uuid,p_due_date date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare source_quote public.quotes;items jsonb;result uuid;
begin
 if auth.uid() is null or not public.action_allowed('invoices.create') or not public.action_allowed('invoices.view') then raise exception 'Conversion refusée';end if;
 if p_due_date is null then raise exception 'Date d’échéance obligatoire';end if;
 select * into source_quote from quotes where id=p_quote_id and tenant_owner_id=public.current_tenant_owner_id() for update;
 if not found then raise exception 'Devis introuvable';end if;
 select id into result from invoices where quote_id=p_quote_id and tenant_owner_id=source_quote.tenant_owner_id order by issue_date,id limit 1;
 if found then return result;end if;
 select jsonb_agg(jsonb_build_object('description',description,'quantity',quantity,'unit_price',unit_price,'tax_rate',tax_rate) order by sort_order,id) into items from quote_items where quote_id=p_quote_id;
 if items is null then raise exception 'Ce devis ne contient aucune prestation';end if;
 result:=public.create_invoice_with_items(source_quote.client_id,source_quote.project_id,p_due_date,source_quote.currency,source_quote.discount,items);
 update invoices set quote_id=p_quote_id where id=result;
 update quotes set status='FACTURE' where id=p_quote_id;
 return result;
end $$;
revoke all on function public.create_invoice_from_quote(uuid,date) from public,anon;
grant execute on function public.create_invoice_from_quote(uuid,date) to authenticated;
create or replace function public.link_quote_delivery_invoices() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.source_quote_id is null then return new;end if;
 if new.tenant_owner_id is distinct from public.current_tenant_owner_id() then raise exception 'Projet hors de votre espace';end if;
 if not public.action_allowed('invoices.update') or not exists(select 1 from quotes where id=new.source_quote_id and tenant_owner_id=new.tenant_owner_id and client_id=new.client_id) then raise exception 'Rattachement du devis au projet refusé';end if;
 update invoices set project_id=new.id where quote_id=new.source_quote_id and tenant_owner_id=new.tenant_owner_id and client_id=new.client_id and project_id is null;
 return new;
end $$;
drop trigger if exists link_quote_delivery_invoices on public.projects;
create trigger link_quote_delivery_invoices after insert on public.projects for each row execute function public.link_quote_delivery_invoices();
notify pgrst,'reload schema';
commit;
