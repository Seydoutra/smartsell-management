begin;
do $$declare c uuid;i uuid;line uuid;d uuid;operation uuid:=gen_random_uuid();other_owner uuid;begin
 perform set_config('request.jwt.claims','{"sub":"82695991-e968-4765-917a-c4d83c846aaf","role":"authenticated"}',true);
 insert into clients(name,tenant_owner_id) values('TEST rollback livraison','82695991-e968-4765-917a-c4d83c846aaf') returning id into c;
 insert into invoices(number,client_id,tenant_owner_id,issue_date,due_date,total) values('TEST-ROLLBACK-DELIVERY',c,'82695991-e968-4765-917a-c4d83c846aaf',current_date,current_date+20,1000) returning id into i;
 insert into invoice_items(invoice_id,description,quantity,unit_price,tenant_owner_id) values(i,'Article test',10,100,'82695991-e968-4765-917a-c4d83c846aaf') returning id into line;
 d:=create_delivery_from_invoice(i,jsonb_build_array(jsonb_build_object('invoice_item_id',line,'quantity',4)),current_date,'Livraison partielle',operation);
 if (select invoice_id from commercial_documents where id=d)<>i then raise exception 'Facture non liée';end if;
 if create_delivery_from_invoice(i,jsonb_build_array(jsonb_build_object('invoice_item_id',line,'quantity',4)),current_date,'Livraison partielle',operation)<>d then raise exception 'Idempotence échouée';end if;
 if (invoice_delivery_balance(i)->0->>'remaining')::numeric<>6 then raise exception 'Restant incorrect';end if;
 begin
  perform create_delivery_from_invoice(i,jsonb_build_array(jsonb_build_object('invoice_item_id',line,'quantity',7)),current_date,'',gen_random_uuid());
  raise exception 'Sur-livraison acceptée';
 exception when others then if sqlerrm<>'Quantité livrée supérieure au restant de la facture' then raise;end if;end;
 perform create_delivery_from_invoice(i,jsonb_build_array(jsonb_build_object('invoice_item_id',line,'quantity',6)),current_date,'',gen_random_uuid());
 if (invoice_delivery_balance(i)->0->>'remaining')::numeric<>0 then raise exception 'Solde livraison incorrect';end if;
 if exists(select 1 from payments where invoice_id=i) or (select status from invoices where id=i)<>'IMPAYEE' then raise exception 'La livraison a modifié le paiement';end if;
 perform set_config('request.jwt.claims','{"sub":"7d990c48-2c8c-4a00-840c-2f6bb02bbde6","role":"authenticated"}',true);
 begin
  perform create_delivery_from_invoice(i,jsonb_build_array(jsonb_build_object('invoice_item_id',line,'quantity',1)),current_date,'',gen_random_uuid());
  raise exception 'Collaborateur restreint autorisé';
 exception when others then if sqlerrm<>'Création de livraison non autorisée' then raise;end if;end;
end$$;
select 'Partial delivery, idempotence, over-delivery denial, permissions and payment independence PASSED (rollback)' as result;
rollback;
