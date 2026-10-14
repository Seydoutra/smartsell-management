begin;
alter table commercial_documents add column if not exists invoice_id uuid references invoices(id) on delete set null;
alter table commercial_documents add column if not exists invoice_number text;
alter table commercial_documents add column if not exists operation_id uuid;
create unique index if not exists delivery_operation_unique on commercial_documents(tenant_owner_id,operation_id) where operation_id is not null;
alter table commercial_document_items add column if not exists invoice_item_id uuid references invoice_items(id) on delete set null;
create index if not exists delivery_invoice_index on commercial_documents(invoice_id);
create index if not exists delivery_source_line_index on commercial_document_items(invoice_item_id);

create or replace function guard_delivery_line() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare d commercial_documents;line invoice_items;used numeric;begin
 select * into d from commercial_documents where id=new.document_id;
 if new.invoice_item_id is null then
  if d.invoice_id is not null and not (tg_op='UPDATE' and old.invoice_item_id is not null and not exists(select 1 from invoice_items where id=old.invoice_item_id)) then raise exception 'Une ligne de livraison doit provenir de la facture';end if;
  return new;
 end if;
 select * into line from invoice_items where id=new.invoice_item_id;
 if d.kind<>'BON_LIVRAISON' or d.invoice_id is distinct from line.invoice_id or d.tenant_owner_id is distinct from line.tenant_owner_id or new.tenant_owner_id is distinct from d.tenant_owner_id then raise exception 'Ligne de facture non autorisée';end if;
 perform 1 from invoices where id=d.invoice_id for update;
 select coalesce(sum(quantity),0) into used from commercial_document_items where invoice_item_id=new.invoice_item_id and id<>new.id;
 if new.quantity is null or new.quantity<=0 or new.quantity+used>line.quantity then raise exception 'Quantité livrée supérieure au restant de la facture';end if;
 new.description:=line.description;new.unit_price:=0;
 return new;
end$$;
drop trigger if exists guard_delivery_line on commercial_document_items;
create trigger guard_delivery_line before insert or update on commercial_document_items for each row execute function guard_delivery_line();

create or replace function guard_delivery_invoice() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$declare i invoices;begin
 if tg_op='UPDATE' and old.invoice_id is not null and (new.invoice_id is distinct from old.invoice_id or new.client_id is distinct from old.client_id or new.kind is distinct from old.kind or new.tenant_owner_id is distinct from old.tenant_owner_id) then
  -- Allow only the FK's automatic detachment when the source invoice is deleted.
  if not (new.invoice_id is null and not exists(select 1 from invoices where id=old.invoice_id) and new.client_id=old.client_id and new.kind=old.kind and new.tenant_owner_id=old.tenant_owner_id) then raise exception 'Le rattachement à la facture ne peut pas être modifié';end if;
 end if;
 if new.invoice_id is not null then
  select * into i from invoices where id=new.invoice_id;
  if new.kind<>'BON_LIVRAISON' or new.tenant_owner_id is distinct from i.tenant_owner_id or new.client_id is distinct from i.client_id then raise exception 'Facture de livraison non autorisée';end if;
  new.invoice_number:=i.number;new.project_id:=i.project_id;new.currency:=i.currency;new.total:=0;
 end if;
 return new;
end$$;
drop trigger if exists guard_delivery_invoice on commercial_documents;
create trigger guard_delivery_invoice before insert or update on commercial_documents for each row execute function guard_delivery_invoice();

create or replace function invoice_delivery_balance(p_invoice uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare result jsonb;begin
 if not current_account_has_access() or not action_allowed('invoices.view') then raise exception 'Lecture facture non autorisée';end if;
 if not exists(select 1 from invoices where id=p_invoice and tenant_owner_id=current_tenant_owner_id()) then raise exception 'Facture introuvable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'description',l.description,'quantity',l.quantity,'delivered',coalesce(d.q,0),'remaining',greatest(0,l.quantity-coalesce(d.q,0))) order by l.sort_order,l.id),'[]') into result
 from invoice_items l left join lateral(select sum(quantity) q from commercial_document_items where invoice_item_id=l.id) d on true where l.invoice_id=p_invoice;
 return result;
end$$;

create or replace function create_delivery_from_invoice(p_invoice uuid,p_items jsonb,p_delivery_date date,p_notes text,p_operation uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare i invoices;doc uuid;entry jsonb;line invoice_items;q numeric;tenant uuid;begin
 if not current_account_has_access() or not action_allowed('documents.create') or not action_allowed('invoices.view') then raise exception 'Création de livraison non autorisée';end if;
 tenant:=current_tenant_owner_id();
 select * into i from invoices where id=p_invoice and tenant_owner_id=tenant for update;
 if not found then raise exception 'Facture introuvable';end if;
 if p_operation is null then raise exception 'Identifiant opération obligatoire';end if;
 select id into doc from commercial_documents where tenant_owner_id=tenant and operation_id=p_operation and invoice_id=p_invoice;
 if found then return doc;end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'Sélectionnez au moins un article livré';end if;
 if p_delivery_date is null then raise exception 'Date de livraison obligatoire';end if;
 if i.status in ('BROUILLON','ANNULE','ANNULEE') then raise exception 'Facture non livrable';end if;
 insert into commercial_documents(number,kind,client_id,project_id,status,expected_date,currency,total,notes,created_by,tenant_owner_id,invoice_id,invoice_number,operation_id)
 values('BL-'||to_char(current_date,'YYYY')||'-'||lpad(nextval('commercial_document_seq')::text,4,'0'),'BON_LIVRAISON',i.client_id,i.project_id,'VALIDE',p_delivery_date,i.currency,0,nullif(trim(p_notes),''),auth.uid(),tenant,i.id,i.number,p_operation) returning id into doc;
 for entry in select value from jsonb_array_elements(p_items) loop
  select * into line from invoice_items where id=(entry->>'invoice_item_id')::uuid and invoice_id=i.id and tenant_owner_id=tenant;
  if not found then raise exception 'Article étranger à la facture';end if;
  q:=(entry->>'quantity')::numeric;
  if q is null or q<=0 then raise exception 'Quantité livrée invalide';end if;
  if exists(select 1 from commercial_document_items where document_id=doc and invoice_item_id=line.id) then raise exception 'Article sélectionné deux fois';end if;
  insert into commercial_document_items(document_id,invoice_item_id,description,quantity,unit_price,sort_order,tenant_owner_id) values(doc,line.id,line.description,q,0,line.sort_order,tenant);
 end loop;
 insert into activity_logs(actor_id,tenant_owner_id,action,entity_type,entity_id,metadata) values(auth.uid(),tenant,'CREATE','commercial_document',doc,jsonb_build_object('invoice_id',i.id,'kind','BON_LIVRAISON'));
 return doc;
end$$;
revoke all on function guard_delivery_line(),guard_delivery_invoice(),invoice_delivery_balance(uuid),create_delivery_from_invoice(uuid,jsonb,date,text,uuid) from public,anon;
grant execute on function invoice_delivery_balance(uuid),create_delivery_from_invoice(uuid,jsonb,date,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
