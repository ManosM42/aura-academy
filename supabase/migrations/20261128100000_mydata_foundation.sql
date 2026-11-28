-- Direct AADE myDATA integration: configuration, credentials, invoices, attempts, audit.
--
-- Independent of the Viva Fiscalisation tables (fiscal_documents etc.). Everything here is
-- prefixed mydata_. Viva payment environment (sandbox/production) and the myDATA environment
-- (demo/live) are separate settings and never derived from each other here.
--
-- Prerequisite: 20261128090000_fiscal_authz_corrective.sql (public.fiscal_is_admin, public.fiscal_admins).
-- Credentials are stored in Supabase Vault (extension supabase_vault, enabled by default on Supabase).
-- Safe to run more than once.

begin;

do $$
begin
  if to_regprocedure('public.fiscal_is_admin()') is null or to_regclass('public.fiscal_admins') is null then
    raise exception 'Apply 20261128090000_fiscal_authz_corrective.sql first';
  end if;
  if not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    raise notice 'supabase_vault is not installed: credential storage will fail until it is enabled (Database > Extensions)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.mydata_touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.mydata_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;

-- Authenticates the human behind a service-role RPC. The Edge Function verifies the JWT and
-- passes the user id; this re-checks it against the canonical allowlist.
create or replace function public.mydata_assert_actor(p_actor uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_actor is null or not exists (select 1 from public.fiscal_admins a where a.user_id = p_actor) then
    raise exception 'actor is not a fiscal admin' using errcode = '42501';
  end if;
end $$;

create or replace function public.mydata_assert_env(p_environment text)
returns void language plpgsql immutable set search_path = public, pg_temp as $$
begin
  if p_environment is null or p_environment not in ('demo', 'live') then
    raise exception 'environment must be demo or live' using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Global configuration (singleton). Non-secret.
-- ---------------------------------------------------------------------------
create table if not exists public.mydata_config (
  singleton boolean primary key default true check (singleton),
  -- Which myDATA environment issuance uses. Independent of the Viva payment environment.
  active_environment text not null default 'demo' check (active_environment in ('demo', 'live')),
  -- Second, explicit gate. active_environment can only be 'live' while this is true.
  live_enabled boolean not null default false,
  -- The ONE authoritative issuance channel. 'none' until an admin chooses, so a payment can
  -- never be fiscalised by two channels.
  issuance_channel text not null default 'none' check (issuance_channel in ('none', 'mydata', 'viva_fiscalisation')),
  live_enabled_by uuid,
  live_enabled_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  check (active_environment <> 'live' or live_enabled)
);
insert into public.mydata_config (singleton) values (true) on conflict do nothing;
drop trigger if exists mydata_config_touch on public.mydata_config;
create trigger mydata_config_touch before update on public.mydata_config
  for each row execute function public.mydata_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Per-environment settings. The base URL is locked by constraint to AADE's official hosts, so a
-- demo row can never point at production or the reverse.
-- ---------------------------------------------------------------------------
create table if not exists public.mydata_environment_settings (
  environment text primary key check (environment in ('demo', 'live')),
  base_url text not null,
  issuer_vat_number text check (issuer_vat_number ~ '^[0-9]{9}$'),
  issuer_branch integer not null default 0 check (issuer_branch >= 0),
  issuer_country text not null default 'GR' check (issuer_country ~ '^[A-Z]{2}$'),
  series text check (series is null or char_length(series) between 1 and 50),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint mydata_base_url_matches_environment check (
    (environment = 'demo' and base_url = 'https://mydataapidev.aade.gr')
    or (environment = 'live' and base_url = 'https://mydatapi.aade.gr/myDATA')
  )
);
insert into public.mydata_environment_settings (environment, base_url) values
  ('demo', 'https://mydataapidev.aade.gr'),
  ('live', 'https://mydatapi.aade.gr/myDATA')
on conflict (environment) do nothing;
drop trigger if exists mydata_env_settings_touch on public.mydata_environment_settings;
create trigger mydata_env_settings_touch before update on public.mydata_environment_settings
  for each row execute function public.mydata_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Fiscal rules per environment and product scenario. NO defaults: every value must be supplied by
-- the business and confirmed by its accountant. Editing a rule clears its confirmation.
-- ---------------------------------------------------------------------------
create table if not exists public.mydata_product_rules (
  environment text not null check (environment in ('demo', 'live')),
  scenario text not null check (scenario in ('SUBSCRIPTION', 'RENEWAL', 'UPGRADE', 'BOOK', 'SEMINAR')),
  invoice_type text check (invoice_type is null or invoice_type ~ '^[0-9]{1,2}\.[0-9]{1,2}$'),
  vat_category smallint check (vat_category is null or vat_category between 1 and 20),
  vat_exemption_category smallint check (vat_exemption_category is null or vat_exemption_category between 1 and 50),
  -- Hundredths of a percent used to split a VAT-inclusive price (2400 = 24%). Must match vat_category.
  vat_rate_bp integer check (vat_rate_bp is null or vat_rate_bp between 0 and 10000),
  income_classification_type text check (income_classification_type is null or income_classification_type ~ '^[A-Za-z0-9_]{1,40}$'),
  income_classification_category text check (income_classification_category is null or income_classification_category ~ '^[A-Za-z0-9_]{1,40}$'),
  payment_method_type smallint check (payment_method_type is null or payment_method_type between 1 and 99),
  notes text check (notes is null or char_length(notes) <= 1000),
  is_confirmed boolean not null default false,
  confirmed_by uuid,
  confirmed_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (environment, scenario),
  constraint mydata_rule_confirmed_complete check (
    not is_confirmed or (
      invoice_type is not null and vat_category is not null and vat_rate_bp is not null
      and income_classification_category is not null and payment_method_type is not null
      -- exemption category is required exactly when vat_category = 7 (zero-VAT exemption)
      and ((vat_category = 7) = (vat_exemption_category is not null))
    )
  )
);
drop trigger if exists mydata_rules_touch on public.mydata_product_rules;
create trigger mydata_rules_touch before update on public.mydata_product_rules
  for each row execute function public.mydata_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Credential metadata. The secrets themselves live in Vault, never in a table.
-- ---------------------------------------------------------------------------
create table if not exists public.mydata_credentials_meta (
  environment text primary key check (environment in ('demo', 'live')),
  configured boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text check (last_test_message is null or char_length(last_test_message) <= 300)
);
insert into public.mydata_credentials_meta (environment) values ('demo'), ('live') on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Invoices (the fiscal documents sent to myDATA)
-- ---------------------------------------------------------------------------
create table if not exists public.mydata_invoices (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('demo', 'live')),
  scenario text not null check (scenario in ('SUBSCRIPTION', 'RENEWAL', 'UPGRADE', 'BOOK', 'SEMINAR')),
  source_type text not null check (source_type in ('billing_order', 'book_order', 'online_seminar_booking')),
  source_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'submitting', 'transmitted', 'rejected', 'unknown', 'cancelled')),
  issuer_vat_number text not null check (issuer_vat_number ~ '^[0-9]{9}$'),
  series text not null check (char_length(series) between 1 and 50),
  aa bigint not null check (aa >= 1),
  issue_date date not null,
  invoice_type text not null check (invoice_type ~ '^[0-9]{1,2}\.[0-9]{1,2}$'),
  currency char(3) not null default 'EUR' check (currency = 'EUR'),
  net_cents bigint not null check (net_cents >= 0),
  vat_cents bigint not null check (vat_cents >= 0),
  gross_cents bigint not null check (gross_cents > 0 and gross_cents = net_cents + vat_cents),
  customer_email text,
  payment_transaction_id text,
  request_xml text,
  request_sha256 text,
  uid text,
  mark bigint,
  authentication_code text,
  qr_url text,
  cancellation_mark bigint,
  cancelled_at timestamptz,
  last_status_code text,
  last_http_status integer,
  last_response text,
  error_summary text,
  transmitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One fiscal document per payment source per environment: webhook retries cannot duplicate it.
  constraint mydata_invoices_one_per_source unique (environment, source_type, source_id),
  -- One number per series per issuer per environment.
  constraint mydata_invoices_unique_number unique (environment, issuer_vat_number, series, aa),
  -- A transmitted invoice must carry AADE's identifiers. Never "transmitted" without a MARK and UID.
  constraint mydata_invoices_transmitted_has_ids check (
    status not in ('transmitted', 'cancelled') or (mark is not null and uid is not null)
  )
);
create unique index if not exists mydata_invoices_mark_uq on public.mydata_invoices (environment, mark) where mark is not null;
create index if not exists mydata_invoices_status_idx on public.mydata_invoices (environment, status, created_at desc);
drop trigger if exists mydata_invoices_touch on public.mydata_invoices;
create trigger mydata_invoices_touch before update on public.mydata_invoices
  for each row execute function public.mydata_touch_updated_at();

-- Allowed status transitions and immutable fiscal fields.
create or replace function public.mydata_invoice_guard()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'mydata_invoices rows cannot be deleted' using errcode = '42501';
  end if;

  if new.environment is distinct from old.environment
     or new.source_type is distinct from old.source_type
     or new.source_id is distinct from old.source_id
     or new.issuer_vat_number is distinct from old.issuer_vat_number
     or new.series is distinct from old.series
     or new.aa is distinct from old.aa
     or new.issue_date is distinct from old.issue_date
     or new.invoice_type is distinct from old.invoice_type
     or new.net_cents is distinct from old.net_cents
     or new.vat_cents is distinct from old.vat_cents
     or new.gross_cents is distinct from old.gross_cents then
    raise exception 'fiscal fields of an invoice are immutable' using errcode = '23514';
  end if;

  if old.mark is not null and new.mark is distinct from old.mark then
    raise exception 'an assigned MARK cannot change' using errcode = '23514';
  end if;
  if old.uid is not null and new.uid is distinct from old.uid then
    raise exception 'an assigned UID cannot change' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending'     and new.status in ('submitting'))
      or (old.status = 'submitting' and new.status in ('transmitted', 'rejected', 'unknown', 'pending'))
      or (old.status = 'unknown'    and new.status in ('transmitted', 'pending', 'rejected'))
      or (old.status = 'rejected'   and new.status in ('pending'))
      or (old.status = 'transmitted' and new.status in ('cancelled'))
    ) then
      raise exception 'invalid invoice status transition % -> %', old.status, new.status using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mydata_invoices_guard on public.mydata_invoices;
create trigger mydata_invoices_guard before update or delete on public.mydata_invoices
  for each row execute function public.mydata_invoice_guard();

-- Transmission attempts (append-only)
create table if not exists public.mydata_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.mydata_invoices (id),
  attempt_no integer not null check (attempt_no >= 1),
  kind text not null check (kind in ('send', 'cancel', 'reconcile')),
  environment text not null check (environment in ('demo', 'live')),
  request_sha256 text,
  http_status integer,
  status_code text,
  outcome text not null check (outcome in
    ('transmitted', 'rejected', 'technical', 'unverified', 'auth_failed', 'unknown', 'not_sent')),
  error_kind text,
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  response_excerpt text check (response_excerpt is null or char_length(response_excerpt) <= 20000),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  unique (invoice_id, attempt_no)
);
drop trigger if exists mydata_attempts_append_only on public.mydata_attempts;
create trigger mydata_attempts_append_only before update or delete on public.mydata_attempts
  for each row execute function public.mydata_append_only();

-- Audit log (append-only). Never holds secrets.
create table if not exists public.mydata_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  environment text check (environment is null or environment in ('demo', 'live')),
  invoice_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
drop trigger if exists mydata_audit_append_only on public.mydata_audit_log;
create trigger mydata_audit_append_only before update or delete on public.mydata_audit_log
  for each row execute function public.mydata_append_only();

-- Series counters
create table if not exists public.mydata_series_counters (
  environment text not null check (environment in ('demo', 'live')),
  issuer_vat_number text not null check (issuer_vat_number ~ '^[0-9]{9}$'),
  series text not null,
  next_aa bigint not null default 1 check (next_aa >= 1),
  primary key (environment, issuer_vat_number, series)
);

-- ---------------------------------------------------------------------------
-- RPCs (service_role only; each authenticates p_actor and writes the audit row in the same transaction)
-- ---------------------------------------------------------------------------
create or replace function public.mydata_allocate_aa(p_environment text, p_vat text, p_series text)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_aa bigint;
begin
  perform public.mydata_assert_env(p_environment);
  insert into public.mydata_series_counters (environment, issuer_vat_number, series, next_aa)
  values (p_environment, p_vat, p_series, 2)
  on conflict (environment, issuer_vat_number, series)
  do update set next_aa = public.mydata_series_counters.next_aa + 1
  returning next_aa - 1 into v_aa;
  return v_aa;
end $$;

create or replace function public.mydata_set_credentials(
  p_environment text, p_user_id text, p_subscription_key text, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_uname text;
  v_kname text;
begin
  perform public.mydata_assert_actor(p_actor);
  perform public.mydata_assert_env(p_environment);
  if p_user_id is null or btrim(p_user_id) = '' or char_length(p_user_id) > 200
     or p_subscription_key is null or btrim(p_subscription_key) = '' or char_length(p_subscription_key) > 200 then
    raise exception 'user id and subscription key must be 1-200 characters' using errcode = '22023';
  end if;

  v_uname := 'mydata_' || p_environment || '_user_id';
  v_kname := 'mydata_' || p_environment || '_subscription_key';

  select id into v_id from vault.secrets where name = v_uname;
  if v_id is null then
    perform vault.create_secret(p_user_id, v_uname, 'AADE myDATA ' || p_environment || ' user id');
  else
    perform vault.update_secret(v_id, p_user_id);
  end if;

  select id into v_id from vault.secrets where name = v_kname;
  if v_id is null then
    perform vault.create_secret(p_subscription_key, v_kname, 'AADE myDATA ' || p_environment || ' subscription key');
  else
    perform vault.update_secret(v_id, p_subscription_key);
  end if;

  insert into public.mydata_credentials_meta (environment, configured, updated_by, updated_at)
  values (p_environment, true, p_actor, now())
  on conflict (environment) do update
    set configured = true, updated_by = p_actor, updated_at = now(),
        last_test_at = null, last_test_ok = null, last_test_message = null;

  insert into public.mydata_audit_log (actor_id, action, environment, details)
  values (p_actor, 'credentials_replaced', p_environment, '{}'::jsonb);
end $$;

create or replace function public.mydata_clear_credentials(p_environment text, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mydata_assert_actor(p_actor);
  perform public.mydata_assert_env(p_environment);
  delete from vault.secrets
   where name in ('mydata_' || p_environment || '_user_id', 'mydata_' || p_environment || '_subscription_key');
  update public.mydata_credentials_meta
     set configured = false, updated_by = p_actor, updated_at = now(),
         last_test_at = null, last_test_ok = null, last_test_message = null
   where environment = p_environment;
  insert into public.mydata_audit_log (actor_id, action, environment) values (p_actor, 'credentials_cleared', p_environment);
end $$;

-- Returns the decrypted credentials of exactly ONE environment. Server-side only.
create or replace function public.mydata_get_credentials(p_environment text)
returns table (user_id text, subscription_key text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mydata_assert_env(p_environment);
  return query
    select
      (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'mydata_' || p_environment || '_user_id'),
      (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'mydata_' || p_environment || '_subscription_key');
end $$;

create or replace function public.mydata_record_connection_test(
  p_environment text, p_ok boolean, p_message text, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mydata_assert_actor(p_actor);
  perform public.mydata_assert_env(p_environment);
  update public.mydata_credentials_meta
     set last_test_at = now(), last_test_ok = p_ok, last_test_message = left(p_message, 300)
   where environment = p_environment;
  insert into public.mydata_audit_log (actor_id, action, environment, details)
  values (p_actor, 'connection_test', p_environment, jsonb_build_object('ok', p_ok));
end $$;

create or replace function public.mydata_save_environment_settings(
  p_environment text, p_vat text, p_branch integer, p_series text, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mydata_assert_actor(p_actor);
  perform public.mydata_assert_env(p_environment);
  if p_vat !~ '^[0-9]{9}$' then raise exception 'issuer VAT number must be 9 digits' using errcode = '22023'; end if;
  if p_branch is null or p_branch < 0 then raise exception 'branch must be >= 0' using errcode = '22023'; end if;
  if p_series is null or char_length(p_series) not between 1 and 50 then
    raise exception 'series must be 1-50 characters' using errcode = '22023';
  end if;
  update public.mydata_environment_settings
     set issuer_vat_number = p_vat, issuer_branch = p_branch, series = p_series, updated_by = p_actor
   where environment = p_environment;
  insert into public.mydata_audit_log (actor_id, action, environment, details)
  values (p_actor, 'settings_saved', p_environment,
          jsonb_build_object('issuer_vat_number', p_vat, 'issuer_branch', p_branch, 'series', p_series));
end $$;

create or replace function public.mydata_save_product_rule(
  p_environment text, p_scenario text, p_invoice_type text, p_vat_category smallint,
  p_vat_exemption_category smallint, p_vat_rate_bp integer, p_income_type text,
  p_income_category text, p_payment_method_type smallint, p_notes text, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mydata_assert_actor(p_actor);
  perform public.mydata_assert_env(p_environment);
  insert into public.mydata_product_rules as r
    (environment, scenario, invoice_type, vat_category, vat_exemption_category, vat_rate_bp,
     income_classification_type, income_classification_category, payment_method_type, notes,
     is_confirmed, confirmed_by, confirmed_at, updated_by)
  values (p_environment, p_scenario, p_invoice_type, p_vat_category, p_vat_exemption_category, p_vat_rate_bp,
          p_income_type, p_income_category, p_payment_method_type, p_notes, false, null, null, p_actor)
  on conflict (environment, scenario) do update set
    invoice_type = excluded.invoice_type, vat_category = excluded.vat_category,
    vat_exemption_category = excluded.vat_exemption_category, vat_rate_bp = excluded.vat_rate_bp,
    income_classification_type = excluded.income_classification_type,
    income_classification_category = excluded.income_classification_category,
    payment_method_type = excluded.payment_method_type, notes = excluded.notes,
    -- any edit invalidates the accountant's confirmation
    is_confirmed = false, confirmed_by = null, confirmed_at = null, updated_by = p_actor;
  insert into public.mydata_audit_log (actor_id, action, environment, details)
  values (p_actor, 'rule_saved', p_environment, jsonb_build_object('scenario', p_scenario));
end $$;

create or replace function public.mydata_confirm_product_rule(p_environment text, p_scenario text, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mydata_assert_actor(p_actor);
  perform public.mydata_assert_env(p_environment);
  -- the table constraint rejects confirmation of an incomplete rule
  update public.mydata_product_rules
     set is_confirmed = true, confirmed_by = p_actor, confirmed_at = now()
   where environment = p_environment and scenario = p_scenario;
  if not found then raise exception 'rule not found' using errcode = 'P0002'; end if;
  insert into public.mydata_audit_log (actor_id, action, environment, details)
  values (p_actor, 'rule_confirmed', p_environment, jsonb_build_object('scenario', p_scenario));
end $$;

create or replace function public.mydata_set_issuance_channel(p_channel text, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  perform public.mydata_assert_actor(p_actor);
  if p_channel not in ('none', 'mydata', 'viva_fiscalisation') then
    raise exception 'invalid channel' using errcode = '22023';
  end if;
  select issuance_channel into v_old from public.mydata_config where singleton;
  update public.mydata_config set issuance_channel = p_channel, updated_by = p_actor where singleton;
  -- leaving the myDATA channel also closes the LIVE gate
  if p_channel <> 'mydata' then
    update public.mydata_config
       set live_enabled = false, active_environment = 'demo' where singleton;
  end if;
  insert into public.mydata_audit_log (actor_id, action, details)
  values (p_actor, 'issuance_channel_changed', jsonb_build_object('from', v_old, 'to', p_channel));
end $$;

create or replace function public.mydata_enable_live(p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_problems text[] := '{}';
  v_cfg public.mydata_config;
  v_set public.mydata_environment_settings;
  v_meta public.mydata_credentials_meta;
  v_missing int;
begin
  perform public.mydata_assert_actor(p_actor);
  select * into v_cfg from public.mydata_config where singleton;
  select * into v_set from public.mydata_environment_settings where environment = 'live';
  select * into v_meta from public.mydata_credentials_meta where environment = 'live';

  if v_cfg.issuance_channel <> 'mydata' then v_problems := array_append(v_problems, 'issuance channel is not mydata'); end if;
  if v_meta.configured is not true then v_problems := array_append(v_problems, 'LIVE credentials are not configured'); end if;
  if v_meta.last_test_ok is not true then v_problems := array_append(v_problems, 'LIVE connection test has not succeeded'); end if;
  if v_set.issuer_vat_number is null or v_set.series is null then
    v_problems := array_append(v_problems, 'LIVE issuer VAT number / series not set');
  end if;
  select 5 - count(*) into v_missing from public.mydata_product_rules
   where environment = 'live' and is_confirmed;
  if v_missing > 0 then v_problems := array_append(v_problems, v_missing::text || ' LIVE product rule(s) not confirmed by the accountant'); end if;

  if array_length(v_problems, 1) is not null then
    raise exception 'LIVE cannot be enabled: %', array_to_string(v_problems, '; ') using errcode = '23514';
  end if;

  update public.mydata_config
     set live_enabled = true, live_enabled_by = p_actor, live_enabled_at = now(), updated_by = p_actor
   where singleton;
  insert into public.mydata_audit_log (actor_id, action, environment) values (p_actor, 'live_enabled', 'live');
end $$;

create or replace function public.mydata_disable_live(p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.mydata_assert_actor(p_actor);
  update public.mydata_config set live_enabled = false, active_environment = 'demo', updated_by = p_actor where singleton;
  insert into public.mydata_audit_log (actor_id, action, environment) values (p_actor, 'live_disabled', 'live');
end $$;

create or replace function public.mydata_set_active_environment(p_environment text, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old text;
begin
  perform public.mydata_assert_actor(p_actor);
  perform public.mydata_assert_env(p_environment);
  select active_environment into v_old from public.mydata_config where singleton;
  if p_environment = 'live' and not (select live_enabled from public.mydata_config where singleton) then
    raise exception 'LIVE is not enabled. Enable it first (all LIVE prerequisites must pass).' using errcode = '23514';
  end if;
  update public.mydata_config set active_environment = p_environment, updated_by = p_actor where singleton;
  insert into public.mydata_audit_log (actor_id, action, environment, details)
  values (p_actor, 'active_environment_changed', p_environment, jsonb_build_object('from', v_old, 'to', p_environment));
end $$;

-- ---------------------------------------------------------------------------
-- Grants and RLS: admins may READ; nobody writes through the API. No secrets exist in these tables.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  f text;
begin
  foreach t in array array[
    'mydata_config', 'mydata_environment_settings', 'mydata_product_rules', 'mydata_credentials_meta',
    'mydata_invoices', 'mydata_attempts', 'mydata_audit_log', 'mydata_series_counters'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_select', t);
    if t <> 'mydata_series_counters' then
      execute format('grant select on public.%I to authenticated', t);
      execute format('create policy %I on public.%I for select to authenticated using (public.fiscal_is_admin())',
                     t || '_admin_select', t);
    end if;
  end loop;

  -- The raw XML/response columns can contain customer data; they stay readable by admins only via the policy above.
  foreach f in array array[
    'mydata_allocate_aa(text,text,text)',
    'mydata_set_credentials(text,text,text,uuid)',
    'mydata_clear_credentials(text,uuid)',
    'mydata_get_credentials(text)',
    'mydata_record_connection_test(text,boolean,text,uuid)',
    'mydata_save_environment_settings(text,text,integer,text,uuid)',
    'mydata_save_product_rule(text,text,text,smallint,smallint,integer,text,text,smallint,text,uuid)',
    'mydata_confirm_product_rule(text,text,uuid)',
    'mydata_set_issuance_channel(text,uuid)',
    'mydata_enable_live(uuid)',
    'mydata_disable_live(uuid)',
    'mydata_set_active_environment(text,uuid)',
    'mydata_assert_actor(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Self-check
do $$
begin
  if has_function_privilege('authenticated', 'public.mydata_get_credentials(text)', 'execute')
     or has_function_privilege('anon', 'public.mydata_get_credentials(text)', 'execute') then
    raise exception 'mydata_get_credentials must be service_role only';
  end if;
  if has_table_privilege('authenticated', 'public.mydata_invoices', 'insert')
     or has_table_privilege('authenticated', 'public.mydata_config', 'update') then
    raise exception 'authenticated must be read-only on mydata tables';
  end if;
end $$;

commit;
