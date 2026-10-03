-- Payment state is derived from recorded payments, never chosen manually.
begin;

create or replace function public.invoice_payment_status()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare paid numeric;
begin
  select coalesce(sum(amount),0) into paid from public.payments where invoice_id=new.id;
  new.status := case
    when paid >= new.total and new.total > 0 then 'PAYEE'
    when paid > 0 then 'PARTIELLEMENT_PAYEE'
    else 'IMPAYEE'
  end;
  return new;
end $$;

drop trigger if exists invoice_payment_status on public.invoices;
create trigger invoice_payment_status before insert or update on public.invoices
for each row execute function public.invoice_payment_status();

create or replace function public.refresh_invoice_payment_status()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    update public.invoices set status=status where id=old.invoice_id;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    update public.invoices set status=status where id=new.invoice_id;
  end if;
  return null;
end $$;

drop trigger if exists refresh_invoice_payment_status on public.payments;
create trigger refresh_invoice_payment_status after insert or update or delete on public.payments
for each row execute function public.refresh_invoice_payment_status();

create or replace function public.record_invoice_payment(p_invoice_id uuid,p_amount numeric,p_method text,p_reference text default null)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare payment_id uuid; invoice_total numeric; already_paid numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_role() not in ('SUPER_ADMIN','ADMIN','MANAGER','COMPTABLE') then raise exception 'Permission denied'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;
  if btrim(coalesce(p_method,'')) = '' then raise exception 'Mode de paiement obligatoire'; end if;
  select total into invoice_total from public.invoices
    where id=p_invoice_id and tenant_owner_id=public.current_tenant_owner_id() for update;
  if invoice_total is null then raise exception 'Facture introuvable'; end if;
  select coalesce(sum(amount),0) into already_paid from public.payments where invoice_id=p_invoice_id;
  if already_paid+p_amount > invoice_total then raise exception 'Le paiement dépasse le solde restant'; end if;
  insert into public.payments(invoice_id,amount,currency,method,reference,recorded_by)
    select id,p_amount,currency,p_method,nullif(btrim(p_reference),''),auth.uid()
    from public.invoices where id=p_invoice_id returning id into payment_id;
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata)
    values(auth.uid(),'CREATE','payment',payment_id,jsonb_build_object('invoice_id',p_invoice_id,'amount',p_amount));
  return payment_id;
end $$;

create or replace function public.create_invoice_from_quote(p_quote_id uuid,p_due_date date)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare source_quote public.quotes%rowtype; items jsonb; invoice_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_role() not in ('SUPER_ADMIN','ADMIN','MANAGER','COMPTABLE') then raise exception 'Permission denied'; end if;
  if p_due_date is null then raise exception 'Date d’échéance obligatoire'; end if;
  select * into source_quote from public.quotes
    where id=p_quote_id and tenant_owner_id=public.current_tenant_owner_id() for update;
  if not found then raise exception 'Devis introuvable'; end if;
  if exists(select 1 from public.invoices where quote_id=p_quote_id) then raise exception 'Ce devis a déjà été converti en facture'; end if;
  select jsonb_agg(jsonb_build_object('description',description,'quantity',quantity,'unit_price',unit_price,'tax_rate',tax_rate) order by sort_order,id)
    into items from public.quote_items where quote_id=p_quote_id;
  if items is null then raise exception 'Ce devis ne contient aucune prestation'; end if;
  invoice_id := public.create_invoice_with_items(source_quote.client_id,source_quote.project_id,p_due_date,source_quote.currency,source_quote.discount,items);
  update public.invoices set quote_id=p_quote_id where id=invoice_id;
  update public.quotes set status='FACTURE' where id=p_quote_id;
  return invoice_id;
end $$;

grant execute on function public.create_invoice_from_quote(uuid,date) to authenticated;

update public.invoices set status=status;
commit;
