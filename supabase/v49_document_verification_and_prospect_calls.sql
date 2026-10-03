-- Public document verification uses an unguessable token, never public table access.
create table if not exists public.document_verifications (
  id uuid primary key default gen_random_uuid(),
  tenant_owner_id uuid not null references public.profiles(id),
  invoice_id uuid unique references public.invoices(id) on delete cascade,
  quote_id uuid unique references public.quotes(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  created_at timestamptz not null default now(),
  constraint one_document_only check ((invoice_id is null) <> (quote_id is null))
);
create index if not exists document_verifications_tenant_idx on public.document_verifications(tenant_owner_id);
alter table public.document_verifications enable row level security;
revoke all on public.document_verifications from anon, authenticated;

create or replace function public.register_document_verification() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='invoices' then
    insert into public.document_verifications(tenant_owner_id,invoice_id) values(new.tenant_owner_id,new.id) on conflict(invoice_id) do nothing;
  else
    insert into public.document_verifications(tenant_owner_id,quote_id) values(new.tenant_owner_id,new.id) on conflict(quote_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists register_invoice_verification on public.invoices;
create trigger register_invoice_verification after insert on public.invoices for each row execute function public.register_document_verification();
drop trigger if exists register_quote_verification on public.quotes;
create trigger register_quote_verification after insert on public.quotes for each row execute function public.register_document_verification();
insert into public.document_verifications(tenant_owner_id,invoice_id)
select tenant_owner_id,id from public.invoices where tenant_owner_id is not null on conflict(invoice_id) do nothing;
insert into public.document_verifications(tenant_owner_id,quote_id)
select tenant_owner_id,id from public.quotes where tenant_owner_id is not null on conflict(quote_id) do nothing;

create or replace function public.get_document_verification_token(p_kind text,p_document_id uuid) returns text
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_token text;
begin
  if auth.uid() is null or not public.action_allowed('invoices.view') then raise exception 'Accès refusé'; end if;
  select dv.token into v_token from public.document_verifications dv
  where dv.tenant_owner_id=public.current_tenant_owner_id()
    and ((p_kind='FACTURE' and dv.invoice_id=p_document_id and exists(select 1 from public.invoices i where i.id=dv.invoice_id and i.tenant_owner_id=dv.tenant_owner_id))
      or (p_kind='DEVIS' and dv.quote_id=p_document_id and exists(select 1 from public.quotes q where q.id=dv.quote_id and q.tenant_owner_id=dv.tenant_owner_id)));
  if v_token is null then raise exception 'Document introuvable'; end if;
  return v_token;
end $$;

create or replace function public.verify_commercial_document(p_token text) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if length(coalesce(p_token,''))<>48 or p_token !~ '^[0-9a-f]+$' then return jsonb_build_object('valid',false); end if;
  select jsonb_build_object('valid',true,'kind','FACTURE','number',i.number,'issue_date',i.issue_date,'issuer',
    case when p.is_platform_owner then 'Smartsell' else 'Entreprise utilisatrice de Smartsell Management' end)
  into result from public.document_verifications dv join public.invoices i on i.id=dv.invoice_id and i.tenant_owner_id=dv.tenant_owner_id
  join public.profiles p on p.id=dv.tenant_owner_id where dv.token=p_token;
  if result is not null then return result; end if;
  select jsonb_build_object('valid',true,'kind','DEVIS','number',q.number,'issue_date',q.issue_date,'issuer',
    case when p.is_platform_owner then 'Smartsell' else 'Entreprise utilisatrice de Smartsell Management' end)
  into result from public.document_verifications dv join public.quotes q on q.id=dv.quote_id and q.tenant_owner_id=dv.tenant_owner_id
  join public.profiles p on p.id=dv.tenant_owner_id where dv.token=p_token;
  return coalesce(result,jsonb_build_object('valid',false));
end $$;
revoke all on function public.get_document_verification_token(text,uuid) from public;
grant execute on function public.get_document_verification_token(text,uuid) to authenticated;
revoke all on function public.verify_commercial_document(text) from public;
grant execute on function public.verify_commercial_document(text) to anon, authenticated;

create or replace function public.is_platform_tenant() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((select p.is_platform_owner from public.profiles p where p.id=public.current_tenant_owner_id()),false)
$$;
revoke all on function public.is_platform_tenant() from public;
grant execute on function public.is_platform_tenant() to authenticated;

-- A prospect with a phone is automatically placed in the tenant's call queue.
alter table public.call_list_contacts add column if not exists source_prospect_id uuid references public.prospects(id) on delete set null;
create unique index if not exists call_lists_auto_prospects_tenant_idx on public.call_lists(tenant_owner_id) where source_filename='AUTO_PROSPECTS';
create unique index if not exists call_list_contacts_source_prospect_idx on public.call_list_contacts(source_prospect_id) where source_prospect_id is not null;
create or replace function public.sync_prospect_call_contact() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare list_id uuid; prospect_phone text;
begin
  prospect_phone:=coalesce(nullif(trim(new.phone),''),nullif(trim(new.whatsapp),''));
  if prospect_phone is null then return new; end if;
  insert into public.call_lists(name,source_filename,created_by,tenant_owner_id)
  values('Prospects à appeler','AUTO_PROSPECTS',new.owner_id,new.tenant_owner_id)
  on conflict(tenant_owner_id) where source_filename='AUTO_PROSPECTS' do nothing;
  select id into list_id from public.call_lists where tenant_owner_id=new.tenant_owner_id and source_filename='AUTO_PROSPECTS';
  insert into public.call_list_contacts(call_list_id,tenant_owner_id,source_prospect_id,name,phone,email,company)
  values(list_id,new.tenant_owner_id,new.id,coalesce(nullif(trim(new.contact_name),''),new.company),prospect_phone,new.email,new.company)
  on conflict(source_prospect_id) where source_prospect_id is not null do update
  set name=excluded.name,phone=excluded.phone,email=excluded.email,company=excluded.company;
  return new;
end $$;
drop trigger if exists sync_prospect_call_contact on public.prospects;
create trigger sync_prospect_call_contact after insert or update of phone,whatsapp,contact_name,email,company on public.prospects
for each row execute function public.sync_prospect_call_contact();
insert into public.call_lists(name,source_filename,tenant_owner_id)
select 'Prospects à appeler','AUTO_PROSPECTS',tenant_owner_id from public.prospects
where coalesce(nullif(trim(phone),''),nullif(trim(whatsapp),'')) is not null and tenant_owner_id is not null
group by tenant_owner_id on conflict(tenant_owner_id) where source_filename='AUTO_PROSPECTS' do nothing;
insert into public.call_list_contacts(call_list_id,tenant_owner_id,source_prospect_id,name,phone,email,company)
select l.id,p.tenant_owner_id,p.id,coalesce(nullif(trim(p.contact_name),''),p.company),
  coalesce(nullif(trim(p.phone),''),nullif(trim(p.whatsapp),'')),p.email,p.company
from public.prospects p join public.call_lists l on l.tenant_owner_id=p.tenant_owner_id and l.source_filename='AUTO_PROSPECTS'
where coalesce(nullif(trim(p.phone),''),nullif(trim(p.whatsapp),'')) is not null
on conflict(source_prospect_id) where source_prospect_id is not null do nothing;
