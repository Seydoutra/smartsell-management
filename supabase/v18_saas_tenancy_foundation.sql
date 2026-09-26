-- SmartSell V18 — socle SaaS multi-tenant.
--
-- Cette migration ne rattache pas encore les tables métier historiques à un tenant.
-- Elle installe les primitives d'organisation, d'espace de travail et de RLS qui
-- permettront une migration progressive et vérifiable des données existantes.

begin;

do $$ begin
  create type public.organization_role as enum ('OWNER', 'ADMIN', 'BILLING', 'MEMBER', 'VIEWER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.membership_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED');
exception when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null default 'MEMBER',
  status public.membership_status not null default 'ACTIVE',
  invited_by uuid references public.profiles(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, profile_id),
  check ((status = 'ACTIVE' and joined_at is not null) or status <> 'ACTIVE')
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ARCHIVED')),
  is_default boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create unique index if not exists workspaces_one_default_per_organization
  on public.workspaces (organization_id) where is_default;

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_role not null default 'MEMBER',
  created_at timestamptz not null default now(),
  primary key (workspace_id, profile_id)
);

create table if not exists public.user_tenant_contexts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index if not exists organization_memberships_profile_active
  on public.organization_memberships (profile_id, organization_id)
  where status = 'ACTIVE';
create index if not exists workspace_memberships_profile
  on public.workspace_memberships (profile_id, workspace_id);
create index if not exists workspaces_organization
  on public.workspaces (organization_id, status);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.status = 'ACTIVE'
  )
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.profile_id = auth.uid()
      and membership.status = 'ACTIVE'
      and membership.role = any(allowed_roles)
  )
$$;

create or replace function public.can_access_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces workspace
    join public.organization_memberships organization_membership
      on organization_membership.organization_id = workspace.organization_id
     and organization_membership.profile_id = auth.uid()
     and organization_membership.status = 'ACTIVE'
    where workspace.id = target_workspace_id
      and workspace.status = 'ACTIVE'
      and (
        organization_membership.role in ('OWNER', 'ADMIN', 'BILLING')
        or exists (
          select 1
          from public.workspace_memberships workspace_membership
          where workspace_membership.workspace_id = workspace.id
            and workspace_membership.profile_id = auth.uid()
        )
      )
  )
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select context.organization_id
  from public.user_tenant_contexts context
  where context.profile_id = auth.uid()
    and public.is_organization_member(context.organization_id)
$$;

create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select context.workspace_id
  from public.user_tenant_contexts context
  where context.profile_id = auth.uid()
    and public.can_access_workspace(context.workspace_id)
$$;

create or replace function public.create_organization_with_workspace(
  organization_name text,
  organization_slug text,
  workspace_name text default 'Principal'
)
returns table (organization_id uuid, workspace_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_slug text := lower(trim(organization_slug));
  new_organization_id uuid;
  new_workspace_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;
  if trim(coalesce(organization_name, '')) = '' then
    raise exception 'Organization name required';
  end if;
  if normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'Invalid organization slug';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(organization_name), normalized_slug, caller_id)
  returning id into new_organization_id;

  insert into public.organization_memberships (
    organization_id, profile_id, role, status, joined_at
  ) values (
    new_organization_id, caller_id, 'OWNER', 'ACTIVE', now()
  );

  insert into public.workspaces (
    organization_id, name, slug, is_default, created_by
  ) values (
    new_organization_id, trim(coalesce(nullif(workspace_name, ''), 'Principal')), 'principal', true, caller_id
  ) returning id into new_workspace_id;

  insert into public.workspace_memberships (workspace_id, profile_id, role)
  values (new_workspace_id, caller_id, 'OWNER');

  insert into public.user_tenant_contexts (profile_id, organization_id, workspace_id)
  values (caller_id, new_organization_id, new_workspace_id)
  on conflict (profile_id) do update
    set organization_id = excluded.organization_id,
        workspace_id = excluded.workspace_id,
        updated_at = now();

  return query select new_organization_id, new_workspace_id;
end
$$;

create or replace function public.set_tenant_context(
  target_organization_id uuid,
  target_workspace_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_organization_member(target_organization_id) then
    raise exception 'Organization access denied';
  end if;
  if not exists (
    select 1 from public.workspaces workspace
    where workspace.id = target_workspace_id
      and workspace.organization_id = target_organization_id
      and public.can_access_workspace(workspace.id)
  ) then
    raise exception 'Workspace access denied';
  end if;

  insert into public.user_tenant_contexts (profile_id, organization_id, workspace_id)
  values (auth.uid(), target_organization_id, target_workspace_id)
  on conflict (profile_id) do update
    set organization_id = excluded.organization_id,
        workspace_id = excluded.workspace_id,
        updated_at = now();
end
$$;

create or replace function public.protect_last_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'OWNER' and old.status = 'ACTIVE'
     and (tg_op = 'DELETE' or new.role <> 'OWNER' or new.status <> 'ACTIVE')
     and not exists (
       select 1
       from public.organization_memberships other_owner
       where other_owner.organization_id = old.organization_id
         and other_owner.profile_id <> old.profile_id
         and other_owner.role = 'OWNER'
         and other_owner.status = 'ACTIVE'
     ) then
    raise exception 'An organization must keep at least one active owner';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

drop trigger if exists protect_last_organization_owner on public.organization_memberships;
create trigger protect_last_organization_owner
before update or delete on public.organization_memberships
for each row execute function public.protect_last_organization_owner();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.user_tenant_contexts enable row level security;

drop policy if exists organizations_read_member on public.organizations;
create policy organizations_read_member on public.organizations
for select to authenticated
using (public.is_organization_member(id));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
for update to authenticated
using (public.has_organization_role(id, array['OWNER', 'ADMIN']::public.organization_role[]))
with check (public.has_organization_role(id, array['OWNER', 'ADMIN']::public.organization_role[]));

drop policy if exists organization_memberships_read_member on public.organization_memberships;
create policy organization_memberships_read_member on public.organization_memberships
for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists organization_memberships_insert_admin on public.organization_memberships;
create policy organization_memberships_insert_admin on public.organization_memberships
for insert to authenticated
with check (
  public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[])
  and (role <> 'OWNER' or public.has_organization_role(organization_id, array['OWNER']::public.organization_role[]))
);

drop policy if exists organization_memberships_update_admin on public.organization_memberships;
create policy organization_memberships_update_admin on public.organization_memberships
for update to authenticated
using (
  public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[])
  and (role <> 'OWNER' or public.has_organization_role(organization_id, array['OWNER']::public.organization_role[]))
)
with check (
  public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[])
  and (role <> 'OWNER' or public.has_organization_role(organization_id, array['OWNER']::public.organization_role[]))
);

drop policy if exists organization_memberships_delete_admin on public.organization_memberships;
create policy organization_memberships_delete_admin on public.organization_memberships
for delete to authenticated
using (
  public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[])
  and (role <> 'OWNER' or public.has_organization_role(organization_id, array['OWNER']::public.organization_role[]))
);

drop policy if exists workspaces_read_member on public.workspaces;
create policy workspaces_read_member on public.workspaces
for select to authenticated
using (public.can_access_workspace(id));

drop policy if exists workspaces_insert_admin on public.workspaces;
create policy workspaces_insert_admin on public.workspaces
for insert to authenticated
with check (public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[]));

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin on public.workspaces
for update to authenticated
using (public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[]))
with check (public.has_organization_role(organization_id, array['OWNER', 'ADMIN']::public.organization_role[]));

drop policy if exists workspaces_delete_owner on public.workspaces;
create policy workspaces_delete_owner on public.workspaces
for delete to authenticated
using (public.has_organization_role(organization_id, array['OWNER']::public.organization_role[]));

drop policy if exists workspace_memberships_read_member on public.workspace_memberships;
create policy workspace_memberships_read_member on public.workspace_memberships
for select to authenticated
using (public.can_access_workspace(workspace_id));

drop policy if exists workspace_memberships_manage_admin on public.workspace_memberships;
create policy workspace_memberships_manage_admin on public.workspace_memberships
for all to authenticated
using (
  exists (
    select 1 from public.workspaces workspace
    where workspace.id = workspace_id
      and public.has_organization_role(workspace.organization_id, array['OWNER', 'ADMIN']::public.organization_role[])
  )
)
with check (
  exists (
    select 1 from public.workspaces workspace
    where workspace.id = workspace_id
      and public.has_organization_role(workspace.organization_id, array['OWNER', 'ADMIN']::public.organization_role[])
  )
);

drop policy if exists tenant_context_self on public.user_tenant_contexts;
create policy tenant_context_self on public.user_tenant_contexts
for all to authenticated
using (profile_id = auth.uid())
with check (
  profile_id = auth.uid()
  and public.is_organization_member(organization_id)
  and public.can_access_workspace(workspace_id)
  and exists (
    select 1 from public.workspaces workspace
    where workspace.id = workspace_id
      and workspace.organization_id = organization_id
  )
);

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.has_organization_role(uuid, public.organization_role[]) from public;
revoke all on function public.can_access_workspace(uuid) from public;
revoke all on function public.current_organization_id() from public;
revoke all on function public.current_workspace_id() from public;
revoke all on function public.create_organization_with_workspace(text, text, text) from public;
revoke all on function public.set_tenant_context(uuid, uuid) from public;
revoke all on function public.protect_last_organization_owner() from public;

revoke all on public.organizations from anon, authenticated;
revoke all on public.organization_memberships from anon, authenticated;
revoke all on public.workspaces from anon, authenticated;
revoke all on public.workspace_memberships from anon, authenticated;
revoke all on public.user_tenant_contexts from anon, authenticated;

grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_memberships to authenticated;
grant select, insert, update, delete on public.user_tenant_contexts to authenticated;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.organization_role[]) to authenticated;
grant execute on function public.can_access_workspace(uuid) to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.current_workspace_id() to authenticated;
grant execute on function public.create_organization_with_workspace(text, text, text) to authenticated;
grant execute on function public.set_tenant_context(uuid, uuid) to authenticated;

commit;
