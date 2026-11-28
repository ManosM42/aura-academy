-- Manual authorization test. Run in the Supabase SQL editor AFTER the corrective migration
-- and AFTER fiscal-provision-admin.sql. Runs in a transaction that is rolled back.
-- Each failed check raises an exception; each success prints NOTICE 'PASS ...'.
-- Tests the database layer only, not Edge Functions.

begin;

do $$
declare
  v_admin  uuid := 'a9908a0c-f054-4b2f-b49e-f53d0d8b827f';
  v_random uuid := gen_random_uuid();
  v_ok boolean;
begin
  -- 1. anon is not admin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select public.fiscal_is_admin() into v_ok;
  if v_ok is not false then raise exception 'FAIL anon must not be a fiscal admin'; end if;
  raise notice 'PASS anon is not admin';
  reset role;

  -- 2. random authenticated user is not admin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_random, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.fiscal_is_admin() into v_ok;
  if v_ok is not false then raise exception 'FAIL random user must not be a fiscal admin'; end if;
  raise notice 'PASS random authenticated user is not admin';

  -- 3. authenticated cannot read or write fiscal_admins
  begin
    perform 1 from public.fiscal_admins limit 1;
    raise exception 'FAIL authenticated could read fiscal_admins';
  exception when insufficient_privilege then
    raise notice 'PASS authenticated cannot read fiscal_admins';
  end;
  begin
    insert into public.fiscal_admins (user_id) values (v_random);
    raise exception 'FAIL authenticated could insert into fiscal_admins';
  exception when insufficient_privilege then
    raise notice 'PASS authenticated cannot insert into fiscal_admins';
  end;
  reset role;

  -- 4. provisioned admin is recognised, and cannot self-demote/promote profiles.role via the API
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.fiscal_is_admin() into v_ok;
  if v_ok is not true then
    raise exception 'FAIL % not recognised (run fiscal-provision-admin.sql first)', v_admin;
  end if;
  raise notice 'PASS provisioned admin is recognised';

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'role') then
    begin
      -- Changing the value must be blocked by profiles_role_guard (a BEFORE trigger).
      update public.profiles set role = null where id = v_admin;
      raise exception 'FAIL profiles.role change was not blocked';
    exception when insufficient_privilege then
      raise notice 'PASS profiles.role change blocked for authenticated';
    end;
  end if;
  reset role;
end $$;

rollback;
