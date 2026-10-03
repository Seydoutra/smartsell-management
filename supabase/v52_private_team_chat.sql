-- Private staff messages: @recipient is enforced by RLS, not by UI filtering.
begin;

alter table public.team_chat_messages
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade;

create index if not exists team_chat_private_inbox_idx
  on public.team_chat_messages(recipient_id,created_at desc)
  where recipient_id is not null;

drop policy if exists team_chat_read on public.team_chat_messages;
create policy team_chat_read on public.team_chat_messages for select to authenticated
using (tenant_owner_id=public.current_tenant_owner_id()
  and public.current_role()::text <> 'CLIENT'
  and (recipient_id is null or sender_id=auth.uid() or recipient_id=auth.uid()));

drop policy if exists team_chat_insert on public.team_chat_messages;
create policy team_chat_insert on public.team_chat_messages for insert to authenticated
with check (tenant_owner_id=public.current_tenant_owner_id()
  and sender_id=auth.uid() and public.current_role()::text <> 'CLIENT'
  and (recipient_id is null or exists (
    select 1 from public.profiles recipient
    where recipient.id=recipient_id and recipient.tenant_owner_id=public.current_tenant_owner_id()
      and recipient.active and recipient.role::text <> 'CLIENT'
  )));

commit;
