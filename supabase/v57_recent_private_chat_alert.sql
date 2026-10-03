-- Rattrape uniquement les messages privés très récents envoyés avant
-- l'activation de la notification, sans renvoyer de vieux échanges d'équipe.
begin;
insert into public.notifications(profile_id,tenant_owner_id,channel,title,body,entity_type,entity_id)
select m.recipient_id,m.tenant_owner_id,'IN_APP','Nouveau message privé',
  coalesce(p.full_name,'Un collaborateur') || ' : ' || left(m.body,200),
  'team_chat',m.id
from public.team_chat_messages m
left join public.profiles p on p.id=m.sender_id
where m.recipient_id is not null
  and m.created_at > now() - interval '48 hours'
  and exists(select 1 from public.profiles recipient
    where recipient.id=m.recipient_id and recipient.tenant_owner_id=m.tenant_owner_id and recipient.active)
  and not exists(select 1 from public.notifications n
    where n.profile_id=m.recipient_id and n.entity_type='team_chat' and n.entity_id=m.id);
commit;
