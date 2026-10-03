-- Un nom et une URL de page ne constituent pas une connexion API.
-- Les références sans jeton restent visibles, mais ne sont plus présentées
-- comme des comptes réellement synchronisés.
begin;
update public.social_integrations
set status='NON_CONFIGURE',last_synced_at=null
where provider in ('FACEBOOK','INSTAGRAM','LINKEDIN')
  and status='CONNECTE' and access_token_ref is null;
commit;
