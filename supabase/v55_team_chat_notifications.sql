-- Notifications individuelles pour la messagerie d'équipe.
-- Un message privé n'est signalé qu'à son destinataire.
begin;

create or replace function public.notify_team_chat_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare sender_name text;
begin
  select full_name into sender_name from public.profiles where id=new.sender_id;
  insert into public.notifications(profile_id,tenant_owner_id,channel,title,body,entity_type,entity_id)
  select recipient.id,new.tenant_owner_id,'IN_APP',
    case when new.recipient_id is null then 'Nouveau message de l’équipe' else 'Nouveau message privé' end,
    coalesce(sender_name,'Un collaborateur') || ' : ' || left(new.body,200),
    'team_chat',new.id
  from public.profiles recipient
  where recipient.tenant_owner_id=new.tenant_owner_id
    and recipient.active and recipient.role::text<>'CLIENT'
    and recipient.id<>new.sender_id
    and (new.recipient_id is null or recipient.id=new.recipient_id);
  return new;
end $$;

drop trigger if exists trg_notify_team_chat_message on public.team_chat_messages;
create trigger trg_notify_team_chat_message after insert on public.team_chat_messages
for each row execute function public.notify_team_chat_message();

commit;
