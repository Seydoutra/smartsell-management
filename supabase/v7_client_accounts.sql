-- SmartSell V7 — comptes dédiés au portail client et isolation des données.
alter type public.app_role add value if not exists 'CLIENT';

drop policy if exists authenticated_read on public.clients;
create policy authenticated_read on public.clients for select to authenticated using (
  public.current_role() <> 'CLIENT' or exists(select 1 from public.client_portal_access a where a.profile_id=auth.uid() and a.client_id=clients.id and a.active)
);
drop policy if exists authenticated_read on public.projects;
create policy authenticated_read on public.projects for select to authenticated using (
  public.current_role() <> 'CLIENT' or exists(select 1 from public.client_portal_access a where a.profile_id=auth.uid() and a.client_id=projects.client_id and a.active)
);
drop policy if exists authenticated_read on public.editorial_items;
create policy authenticated_read on public.editorial_items for select to authenticated using (
  public.current_role() <> 'CLIENT' or exists(select 1 from public.client_portal_access a where a.profile_id=auth.uid() and a.client_id=editorial_items.client_id and a.active)
);
drop policy if exists authenticated_read on public.invoices;
create policy authenticated_read on public.invoices for select to authenticated using (
  public.current_role() <> 'CLIENT' or exists(select 1 from public.client_portal_access a where a.profile_id=auth.uid() and a.client_id=invoices.client_id and a.active)
);
drop policy if exists authenticated_read on public.invoice_items;
create policy authenticated_read on public.invoice_items for select to authenticated using (
  public.current_role() <> 'CLIENT' or exists(select 1 from public.invoices i join public.client_portal_access a on a.client_id=i.client_id where i.id=invoice_items.invoice_id and a.profile_id=auth.uid() and a.active)
);
drop policy if exists authenticated_read on public.payments;
create policy authenticated_read on public.payments for select to authenticated using (
  public.current_role() <> 'CLIENT' or exists(select 1 from public.invoices i join public.client_portal_access a on a.client_id=i.client_id where i.id=payments.invoice_id and a.profile_id=auth.uid() and a.active)
);
