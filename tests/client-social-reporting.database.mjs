// Ephemeral PostgreSQL validation. Uses synthetic accounts only; never production.
// Usage: node tests/client-social-reporting.database.mjs /path/to/pglite/dist/index.js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { PGlite }=await import(pathToFileURL(process.argv[2]).href)
const pg=new PGlite()
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const CA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',CB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PA='33333333-3333-4333-8333-333333333333',PB='44444444-4444-4444-8444-444444444444',UNLINKED='55555555-5555-4555-8555-555555555555',READER='66666666-6666-4666-8666-666666666666'
await pg.exec(`
create role authenticated;create role anon;create role service_role;
create schema auth;grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.profiles(id uuid primary key,tenant_owner_id uuid,role text,active boolean default true);
create table public.clients(id uuid primary key,tenant_owner_id uuid,name text);
create table public.client_portal_access(profile_id uuid,client_id uuid,tenant_owner_id uuid,active boolean default true);
create table public.editorial_items(id uuid primary key default gen_random_uuid(),tenant_owner_id uuid,client_id uuid,status text,publish_at timestamptz,content_type text,post_type text);
create table public.notifications(id uuid primary key default gen_random_uuid(),tenant_owner_id uuid,profile_id uuid,channel text,title text,body text,entity_type text,entity_id uuid);
create function public.current_tenant_owner_id() returns uuid language sql stable security definer as $$select tenant_owner_id from public.profiles where id=auth.uid()$$;
create function public.has_role(required text) returns boolean language sql stable security definer as $$select coalesce((select role=required from public.profiles where id=auth.uid()),false)$$;
create function public.action_allowed(action text) returns boolean language sql stable security definer as $$select coalesce((select role='ADMIN' or (role='READER' and action='clients.view') from public.profiles where id=auth.uid()),false)$$;
create function public.portal_client_allowed(target uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.client_portal_access where profile_id=auth.uid() and client_id=target and active and tenant_owner_id=public.current_tenant_owner_id())$$;
create function public.enforce_trial_write_access() returns trigger language plpgsql as $$begin return coalesce(new,old);end$$;
create schema cron;create table cron.jobs(name text primary key,schedule text,command text);
create function cron.schedule(job_name text,schedule text,command text) returns bigint language plpgsql as $$begin insert into cron.jobs values(job_name,schedule,command) on conflict(name) do update set schedule=excluded.schedule,command=excluded.command;return 1;end$$;
insert into public.profiles(id,tenant_owner_id,role) values('${A}','${A}','ADMIN'),('${B}','${B}','ADMIN'),('${PA}','${A}','CLIENT'),('${PB}','${B}','CLIENT'),('${UNLINKED}','${A}','CLIENT'),('${READER}','${A}','READER');
insert into public.clients values('${CA}','${A}','Client QA A'),('${CB}','${B}','Client QA B');
insert into public.client_portal_access(profile_id,client_id,tenant_owner_id) values('${PA}','${CA}','${A}'),('${PB}','${CB}','${B}');
`)
const migration=await readFile(new URL('../supabase/v62_client_social_reporting.sql',import.meta.url),'utf8')
await pg.exec(migration)
await pg.exec(migration) // Idempotent reapplication must not duplicate the scheduled job.
assert.equal((await pg.query('select count(*)::int as n from cron.jobs')).rows[0].n,1)
await pg.exec(`
insert into client_service_commitments(tenant_owner_id,client_id,effective_month,publications,videos,reels) values('${A}','${CA}','2020-01-01',12,2,4),('${A}','${CA}','2020-03-01',16,4,6),('${B}','${CB}','2020-01-01',6,1,2);
insert into client_social_measurements(tenant_owner_id,client_id,network,account_key,kind,measured_on,followers) values('${A}','${CA}','FACEBOOK','page-a','BASELINE','2020-01-01',100),('${A}','${CA}','FACEBOOK','page-a','SNAPSHOT','2020-02-28',120),('${B}','${CB}','FACEBOOK','page-b','BASELINE','2020-01-01',500);
insert into editorial_items(tenant_owner_id,client_id,status,publish_at,content_type) values('${A}','${CA}','PUBLIE','2020-02-10','IMAGE'),('${A}','${CA}','PUBLIE','2020-02-11','VIDÉO'),('${A}','${CA}','PUBLIE','2020-02-12','REEL'),('${A}','${CA}','PLANIFIE','2020-02-13','IMAGE'),('${A}','${CA}','PUBLIE','2020-03-01','IMAGE'),('${B}','${CB}','PUBLIE','2020-02-10','IMAGE');
`)
async function login(id){await pg.exec(`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`)}
async function refused(sql,pattern){await assert.rejects(pg.exec(sql),pattern)}
await login(A)
assert.equal((await pg.query('select count(*)::int as n from client_social_measurements')).rows[0].n,2)
await refused(`insert into client_service_commitments(tenant_owner_id,client_id,effective_month,publications,videos,reels) values('${B}','${CB}','2020-04-01',1,1,1)`,/row-level security/i)
await refused(`insert into client_service_commitments(tenant_owner_id,client_id,effective_month,publications,videos,reels) values('${A}','${CB}','2020-04-01',1,1,1)`,/incompatible/i)
await refused(`select public.generate_client_monthly_report('${CB}','2020-02-01')`,/introuvable/i)
await refused(`select public.build_client_monthly_report('${B}','${CB}','2020-02-01')`,/permission denied/i)
await refused(`select public.generate_client_monthly_report('${CA}',date_trunc('month',now())::date)`,/mois terminé/i)
const generated=(await pg.query(`select public.generate_client_monthly_report('${CA}','2020-02-01') as id`)).rows[0].id
const report=(await pg.query('select payload from client_monthly_reports')).rows[0].payload
assert.deepEqual(report.delivered,{publications:1,videos:1,reels:1})
assert.equal(report.commitments.publications,12)
assert.equal(report.social[0].latest.followers,120)
assert.equal(report.social[0].latest.likes,null)
assert.equal((await pg.query(`select public.generate_client_monthly_report('${CA}','2020-02-01') as id`)).rows[0].id,generated)
await login(PA)
assert.equal((await pg.query('select count(*)::int as n from client_monthly_reports')).rows[0].n,1)
assert.equal((await pg.query('select count(*)::int as n from client_social_measurements')).rows[0].n,2)
await refused(`insert into client_service_commitments(tenant_owner_id,client_id,effective_month,publications,videos,reels) values('${A}','${CA}','2020-04-01',1,1,1)`,/row-level security/i)
await refused(`select public.generate_client_monthly_report('${CA}','2020-02-01')`,/droits/i)
await refused('select public.generate_due_client_monthly_reports()',/permission denied/i)
await login(PB)
assert.equal((await pg.query('select count(*)::int as n from client_monthly_reports')).rows[0].n,0)
assert.equal((await pg.query('select count(*)::int as n from client_social_measurements')).rows[0].n,1)
await login(UNLINKED)
assert.equal((await pg.query('select count(*)::int as n from client_social_measurements')).rows[0].n,0)
await login(READER)
await refused(`select public.generate_client_monthly_report('${CA}','2020-02-01')`,/droits/i)
await pg.exec("reset role;set request.jwt.claim.sub='';")
assert.equal((await pg.query('select count(*)::int as n from notifications')).rows[0].n,1)
assert.equal((await pg.query('select profile_id from notifications')).rows[0].profile_id,PA)
await pg.exec('select public.generate_due_client_monthly_reports();select public.generate_due_client_monthly_reports();')
assert.equal((await pg.query('select count(*)::int as n from client_monthly_reports')).rows[0].n,3)
assert.equal((await pg.query('select count(*)::int as n from notifications')).rows[0].n,3)
await pg.close()
console.log('PostgreSQL local : migration réapplicable, tenant/client RLS, droits RPC, engagements récurrents, comptage, rapports figés et notifications idempotentes validés. Aucun accès production.')
