begin;
alter table public.payments add column if not exists cashbox text;
create or replace function public.record_invoice_payment_details(p_invoice_id uuid,p_amount numeric,p_method text,p_reference text default null,p_paid_at timestamptz default now(),p_cashbox text default null)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare payment_id uuid;
begin
  if p_paid_at is null or p_paid_at > now() + interval '5 minutes' then
    raise exception 'La date du paiement est obligatoire et ne peut pas être future';
  end if;
  if length(coalesce(p_cashbox,'')) > 160 then raise exception 'Nom de caisse trop long'; end if;
  payment_id := public.record_invoice_payment(p_invoice_id,p_amount,p_method,p_reference);
  update public.payments set paid_at=p_paid_at,cashbox=nullif(btrim(p_cashbox),'') where id=payment_id;
  if not found then raise exception 'Mise à jour du paiement refusée'; end if;
  return payment_id;
end $$;
revoke all on function public.record_invoice_payment_details(uuid,numeric,text,text,timestamptz,text) from public,anon;
grant execute on function public.record_invoice_payment_details(uuid,numeric,text,text,timestamptz,text) to authenticated;
notify pgrst,'reload schema';
commit;
