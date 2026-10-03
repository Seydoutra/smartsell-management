-- Vérifie qu'un destinataire authentifié peut lire ses messages privés.
begin;
do $$
declare recipient uuid;
begin
  select recipient_id into recipient from public.team_chat_messages
  where recipient_id is not null order by created_at desc limit 1;
  if recipient is not null then
    perform set_config('request.jwt.claim.sub',recipient::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
  end if;
end $$;
set local role authenticated;
select count(*) as visible_private_messages
from public.team_chat_messages
where recipient_id=auth.uid();
rollback;
