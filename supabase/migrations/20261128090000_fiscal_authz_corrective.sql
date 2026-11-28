-- Corrective migration: canonical Fiscal Admin authorization.
--
-- Canonical model: public.fiscal_admins(user_id) is the ONLY source of truth.
-- fiscal_is_admin() authenticates the actual caller through auth.uid() (the JWT subject).
-- It never uses current_user / session_user, which inside SECURITY DEFINER code is the
-- function owner and would authorise everyone.
--
-- Why not profiles.role = 'admin' (what 20261127190000_fiscal_foundation.sql defines)?
-- The repo's profiles RLS lets every member UPDATE their own row with no column restriction.
-- If profiles.role is writable by the owner of the row, any member could self-promote.
-- So profiles.role is NOT trusted for fiscal access. This migration also blocks
-- non-service writes to profiles.role (guard trigger below), as defence in depth.
--
-- Safe to run more than once. Does not edit any historical migration.
-- It converges the repository onto what the live database already does
-- (fiscal_is_admin() checks public.fiscal_admins.user_id).

begin;

-- 1. fiscal_admins ----------------------------------------------------------
create table if not exists public.fiscal_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.fiscal_admins add column if not exists created_at timestamptz not null default now();
alter table public.fiscal_admins add column if not exists granted_by uuid;
alter table public.fiscal_admins add column if not exists note text;

comment on table public.fiscal_admins is
  'Canonical Fiscal Admin allowlist. Writable only by service_role / the SQL editor (postgres). '
  'No RLS policy exists for anon or authenticated, so they can neither read nor write it.';

alter table public.fiscal_admins enable row level security;
revoke all on public.fiscal_admins from public, anon, authenticated;
grant select, insert, update, delete on public.fiscal_admins to service_role;

-- 2. fiscal_is_admin() ------------------------------------------------------
create or replace function public.fiscal_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    auth.uid() is not null
    and exists (select 1 from public.fiscal_admins a where a.user_id = auth.uid()),
    false
  );
$$;

comment on function public.fiscal_is_admin() is
  'True only when the authenticated caller (auth.uid()) is listed in public.fiscal_admins. '
  'Does not look at current_user and does not trust profiles.role.';

revoke all on function public.fiscal_is_admin() from public;
-- anon may execute so RLS policies evaluate to false instead of raising; it returns false for anon.
grant execute on function public.fiscal_is_admin() to anon, authenticated, service_role;

-- 3. Fiscal tables: writes only via service-role Edge Functions / SECURITY DEFINER RPCs
do $$
declare
  t text;
begin
  foreach t in array array[
    'fiscal_settings', 'fiscal_documents', 'fiscal_attempts',
    'fiscal_email_deliveries', 'fiscal_audit_log', 'fiscal_queue_state'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('revoke all on public.%I from anon', t);
      execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- 4. Guard profiles.role against self-promotion (only if the live column exists)
create or replace function public.profiles_role_guard()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  caller_role text := coalesce(claims ->> 'role', nullif(current_setting('request.jwt.claim.role', true), ''));
  new_role text := to_jsonb(new) ->> 'role';
  old_role text;
begin
  -- Only requests arriving through the public API as anon/authenticated are restricted.
  if caller_role is null or caller_role not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new_role is not null and lower(new_role) = 'admin' then
      raise exception 'profiles.role cannot be set to admin through the public API' using errcode = '42501';
    end if;
    return new;
  end if;

  old_role := to_jsonb(old) ->> 'role';
  if new_role is distinct from old_role then
    raise exception 'profiles.role can only be changed by a service-role operation' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    drop trigger if exists profiles_role_guard on public.profiles;
    create trigger profiles_role_guard
      before insert or update on public.profiles
      for each row execute function public.profiles_role_guard();
  else
    raise notice 'public.profiles has no role column; role guard trigger not installed';
  end if;
end $$;

-- 5. Self-check: fail loudly if the invariants did not hold
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'fiscal_admins' and c.relrowsecurity) then
    raise exception 'fiscal_admins must have RLS enabled';
  end if;
  if has_table_privilege('authenticated', 'public.fiscal_admins', 'select')
     or has_table_privilege('anon', 'public.fiscal_admins', 'select') then
    raise exception 'anon/authenticated must not have privileges on fiscal_admins';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.fiscal_is_admin()'::regprocedure) is not true then
    raise exception 'fiscal_is_admin() must be SECURITY DEFINER';
  end if;
end $$;

commit;
