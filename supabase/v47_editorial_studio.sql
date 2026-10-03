-- SmartSell editorial studio: preserve the fields of clients' editorial calendars.
alter table public.editorial_items add column if not exists theme text;
alter table public.editorial_items add column if not exists post_type text;
alter table public.editorial_items add column if not exists objective text;
alter table public.editorial_items add column if not exists visual_title text;
alter table public.editorial_items add column if not exists visual_subtitle text;
alter table public.editorial_items add column if not exists hashtags text;
alter table public.editorial_items add column if not exists production_notes text;
alter table public.editorial_items add column if not exists week_label text;

create index if not exists idx_editorial_tenant_publish_at
  on public.editorial_items (tenant_owner_id, publish_at);

-- A content draft can be reviewed before its visual asset is ready.
alter table public.creative_approvals alter column asset_url drop not null;

create or replace function public.respond_creative_approval(p_approval_id uuid,p_decision text,p_comment text)
returns public.creative_approvals
language plpgsql security definer set search_path=public as $$
declare result public.creative_approvals;
begin
  if p_decision not in ('APPROUVE','MODIFICATIONS_DEMANDEES') then raise exception 'Décision invalide'; end if;
  if not exists(
    select 1 from public.creative_approvals ca
    join public.client_portal_access a on a.client_id=ca.client_id
    where ca.id=p_approval_id and ca.status='A_VALIDER' and a.profile_id=auth.uid() and a.active and a.can_comment
  ) then raise exception 'Validation indisponible ou accès refusé'; end if;
  update public.creative_approvals set status=p_decision,responded_at=now() where id=p_approval_id returning * into result;
  insert into public.creative_feedback(approval_id,author_id,body,decision)
    values(p_approval_id,auth.uid(),coalesce(nullif(trim(p_comment),''),case when p_decision='APPROUVE' then 'Contenu approuvé' else 'Modifications demandées' end),p_decision);
  if result.editorial_item_id is not null then
    update public.editorial_items
      set status=case when p_decision='APPROUVE' then 'VALIDE_CLIENT' else 'EN_CREATION' end
      where id=result.editorial_item_id and status not in ('PUBLIE','ANNULE');
  end if;
  insert into public.notifications(profile_id,title,body,entity_type,entity_id)
    values(result.created_by,'Retour client sur une publication',case when p_decision='APPROUVE' then 'Le contenu a été approuvé.' else 'Le client demande des modifications.' end,'creative_approval',p_approval_id);
  return result;
end $$;

create or replace function public.guard_editorial_client_approval()
returns trigger language plpgsql security definer set search_path=public as $$
declare content_changed boolean;
begin
  content_changed := row(old.title,old.caption,old.objective,old.visual_title,old.visual_subtitle,old.hashtags,old.platforms,old.asset_urls)
    is distinct from row(new.title,new.caption,new.objective,new.visual_title,new.visual_subtitle,new.hashtags,new.platforms,new.asset_urls);
  if content_changed and exists(select 1 from public.creative_approvals where editorial_item_id=new.id and status in ('APPROUVE','A_VALIDER')) then
    if new.status in ('PLANIFIE','PUBLIE') then raise exception 'Le contenu modifié doit être revalidé par le client avant publication'; end if;
    update public.creative_approvals set status='ARCHIVE' where editorial_item_id=new.id and status in ('APPROUVE','A_VALIDER');
    new.status := 'EN_CREATION';
  end if;
  if new.client_id is not null and new.status in ('PLANIFIE','PUBLIE') and old.status is distinct from new.status
     and not exists(select 1 from public.creative_approvals where editorial_item_id=new.id and client_id=new.client_id and status='APPROUVE') then
    raise exception 'Validation client requise avant planification ou publication';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_editorial_client_approval on public.editorial_items;
create trigger trg_guard_editorial_client_approval before update on public.editorial_items
for each row execute function public.guard_editorial_client_approval();
