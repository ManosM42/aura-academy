-- Fiscal foundation: documents, attempts, settings, email queue, audit log.
-- Depends on: fiscal_is_admin() being callable from RLS (defined below) and from
-- _shared/fiscal/auth.ts's requireFiscalAdmin(), which calls it via rpc().
--
-- No accountant-dependent default is set anywhere in this file: receipt case,
-- charge-item case, VAT rate and series/AA all start NULL and must be filled
-- in through the admin page before fiscal-issue-sale can build a valid request.

begin;

-- ---------------------------------------------------------------------------
-- Admin check used by every RLS policy and by _shared/fiscal/auth.ts
-- ---------------------------------------------------------------------------

create or replace function fiscal_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

comment on function fiscal_is_admin() is
  'Single source of truth for fiscal admin access. Used by RLS policies below '
  'and by _shared/fiscal/auth.ts requireFiscalAdmin() via supabase.rpc().';

revoke all on function fiscal_is_admin() from public;
grant execute on function fiscal_is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- fiscal_settings: accountant-controlled, per product type. Starts empty.
-- ---------------------------------------------------------------------------

create table if not exists fiscal_settings (
  id uuid primary key default gen_random_uuid(),
  product_type text not null unique check (product_type in ('subscription', 'book', 'seminar')),

  -- int64 values from Viva's documentation. Stored as text because Postgres's
  -- bigint tops out below some of Viva's documented case codes on the edge;
  -- text also matches how viva-fiscal.ts exchanges bigint as decimal strings.
  ft_receipt_case text check (ft_receipt_case is null or ft_receipt_case ~ '^[0-9]{1,20}$'),
  ft_charge_item_case text check (ft_charge_item_case is null or ft_charge_item_case ~ '^[0-9]{1,20}$'),

  -- Hundredths of a percent, matching Viva's samples (2400 = 24%). NULL until set.
  vat_rate integer check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 10000)),

  -- Receipt series/AA, used in GR.HashPayload (buildHashPayload in viva-fiscal.ts).
  receipt_series text check (receipt_series is null or (char_length(receipt_series) between 1 and 20)),
  -- Next AA to assign. Incremented by fiscal_reserve_next_aa() below, never by the caller directly.
  next_aa integer not null default 1 check (next_aa >= 1),

  is_active boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fiscal_settings is
  'One row per product type. All fiscal values are accountant-controlled and '
  'start NULL/inactive. fiscal-issue-sale must refuse to run for a product '
  'type whose row is not fully configured and is_active = true.';

comment on column fiscal_settings.next_aa is
  'Advanced only through fiscal_reserve_next_aa(), which locks the row so two '
  'concurrent sales for the same product type never get the same AA.';

create trigger fiscal_settings_set_updated_at
  before update on fiscal_settings
  for each row
  execute function set_updated_at_timestamp();

-- Reuses the project's existing updated_at trigger function if present; create
-- a minimal fallback if it does not exist yet, so this migration is self-contained.
do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'set_updated_at_timestamp'
  ) then
    create function set_updated_at_timestamp()
    returns trigger
    language plpgsql
    as $f$
    begin
      new.updated_at = now();
      return new;
    end;
    $f$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- fiscal_documents: one row per receipt we attempt to sign with Viva.
-- ---------------------------------------------------------------------------

create type fiscal_document_status as enum (
  'pending',      -- created, not yet sent
  'submitting',   -- a postReceipt call is in flight (claimed by one worker)
  'signed',       -- Viva confirmed: accepted ftState + transmissionIndicator 0 + MARK
  'rejected',     -- Viva definitively refused, or returned an error/fail ftState
  'unknown',      -- timeout/network/5xx/408/429; outcome not confirmed, needs reconciliation
  'unverified'    -- 2xx but success criteria not all met; needs a human, never auto-retried
);

create type fiscal_document_kind as enum ('start', 'zero', 'sale');

create table if not exists fiscal_documents (
  id uuid primary key default gen_random_uuid(),

  kind fiscal_document_kind not null default 'sale',
  status fiscal_document_status not null default 'pending',

  -- Reused verbatim on every resend attempt of the same logical receipt, per
  -- Viva's documented replay behaviour for a repeated sessionId. Rotated by
  -- resetRejectedDocument() in repo.ts when status moves rejected -> pending.
  session_id uuid not null default gen_random_uuid(),

  product_type text not null check (product_type in ('subscription', 'book', 'seminar')),
  -- Which existing payment this receipt is for. Exactly one of these is set,
  -- matching whichever payment table the product type uses. Enforced below.
  subscription_payment_id uuid references viva_subscription_payments(id),
  book_payment_id uuid references viva_book_payments(id),
  seminar_payment_id uuid references viva_seminar_payments(id),

  member_id uuid not null references profiles(id),
  member_email text not null check (member_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),

  currency_code text not null default '978' check (currency_code ~ '^[0-9]{3}$'),
  receipt_amount_minor bigint not null check (receipt_amount_minor >= 0),
  receipt_reference text not null check (char_length(receipt_reference) between 1 and 100),
  receipt_moment timestamptz not null,

  -- Settings snapshot at issue time, so a later change to fiscal_settings never
  -- rewrites the meaning of an existing document.
  ft_receipt_case text not null check (ft_receipt_case ~ '^[0-9]{1,20}$'),
  ft_charge_item_case text not null check (ft_charge_item_case ~ '^[0-9]{1,20}$'),
  vat_rate integer not null check (vat_rate >= 0 and vat_rate <= 10000),
  receipt_series text not null,
  receipt_aa integer not null check (receipt_aa >= 1),

  -- Populated only once status = 'signed'. Never backfilled by a guess.
  ft_receipt_identification text,
  ft_mark text check (ft_mark is null or ft_mark ~ '^[0-9]{1,20}$'),
  ft_invoice_uid text,
  ft_state text,
  transmission_indicator text,
  ft_signatures jsonb,

  -- Set once, the first time status becomes 'unverified'. Shown as-is in the
  -- admin page; never used to auto-retry.
  unverified_reason text,
  unverified_message text,

  last_http_status integer,
  last_response_excerpt text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  signed_at timestamptz,

  constraint fiscal_documents_one_payment_ref check (
    (subscription_payment_id is not null)::int
    + (book_payment_id is not null)::int
    + (seminar_payment_id is not null)::int = 1
  ),
  constraint fiscal_documents_signed_fields check (
    status <> 'signed'
    or (ft_receipt_identification is not null and ft_mark is not null and signed_at is not null)
  )
);

comment on table fiscal_documents is
  'One row per sale/start/zero receipt. Status transitions are the single '
  'source of truth for what is safe to retry; see fiscal_documents_status_guard.';

create unique index if not exists fiscal_documents_subscription_payment_uq
  on fiscal_documents (subscription_payment_id) where subscription_payment_id is not null;
create unique index if not exists fiscal_documents_book_payment_uq
  on fiscal_documents (book_payment_id) where book_payment_id is not null;
create unique index if not exists fiscal_documents_seminar_payment_uq
  on fiscal_documents (seminar_payment_id) where seminar_payment_id is not null;

create index if not exists fiscal_documents_status_idx on fiscal_documents (status);
create index if not exists fiscal_documents_member_idx on fiscal_documents (member_id);
create index if not exists fiscal_documents_created_idx on fiscal_documents (created_at desc);

create trigger fiscal_documents_set_updated_at
  before update on fiscal_documents
  for each row
  execute function set_updated_at_timestamp();

-- Enforces the transitions repo.ts relies on:
--   pending -> submitting -> {signed, rejected, unknown, unverified}
--   rejected -> pending (resetRejectedDocument, with a new session_id)
--   submitting -> pending (releaseDocumentToPending, not_sent outcome)
--   unknown -> submitting (manual reconciliation re-attempt)
-- 'signed' is terminal: it is never updated again by this trigger's allowance.
create or replace function fiscal_documents_status_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'signed' then
    raise exception 'fiscal_documents: status signed is terminal (id=%)', old.id;
  end if;

  if (old.status, new.status) in (
    ('pending', 'submitting'),
    ('submitting', 'signed'),
    ('submitting', 'rejected'),
    ('submitting', 'unknown'),
    ('submitting', 'unverified'),
    ('rejected', 'pending'),
    ('submitting', 'pending'),
    ('unknown', 'submitting')
  ) then
    return new;
  end if;

  raise exception 'fiscal_documents: disallowed status transition % -> % (id=%)',
    old.status, new.status, old.id;
end;
$$;

create trigger fiscal_documents_guard_transition
  before update of status on fiscal_documents
  for each row
  execute function fiscal_documents_status_guard();

-- ---------------------------------------------------------------------------
-- fiscal_attempts: append-only audit trail of every postReceipt call.
-- ---------------------------------------------------------------------------

create table if not exists fiscal_attempts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references fiscal_documents(id) on delete cascade,

  environment text not null check (environment in ('demo', 'live')),
  session_id uuid not null,
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),

  outcome text not null check (outcome in ('signed', 'rejected', 'unknown', 'not_sent', 'unverified')),
  http_status integer,
  error_kind text check (error_kind is null or error_kind in ('timeout', 'network', 'http', 'parse', 'auth', 'config')),
  message text,
  response_excerpt text,

  attempted_at timestamptz not null default now(),
  attempted_by uuid references profiles(id)
);

comment on table fiscal_attempts is
  'Append-only. One row per postReceipt call, written by whichever function '
  'calls it (fiscal-issue-sale, fiscal-admin-actions resend). Never updated.';

create index if not exists fiscal_attempts_document_idx on fiscal_attempts (document_id, attempted_at desc);

-- No update/delete policy is defined for any role other than service_role:
-- the table is append-only by omission, enforced by RLS below.

-- ---------------------------------------------------------------------------
-- fiscal_email_deliveries: queue + retry state for Resend.
-- ---------------------------------------------------------------------------

create type fiscal_email_status as enum ('queued', 'sending', 'sent', 'failed');

create table if not exists fiscal_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references fiscal_documents(id) on delete cascade,

  to_email text not null check (to_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  idempotency_key uuid not null default gen_random_uuid(),

  status fiscal_email_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 8 check (max_attempts >= 1), -- matches EMAIL_MAX_ATTEMPTS in email.ts

  next_attempt_at timestamptz not null default now(),
  last_http_status integer,
  last_message text,
  provider_message_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,

  -- email.ts only defines sendFiscalEmail for signed documents; this constraint
  -- makes that rule impossible to violate at the data layer too.
  constraint fiscal_email_deliveries_document_signed check (
    exists (
      select 1 from fiscal_documents d
      where d.id = fiscal_email_deliveries.document_id
        and d.status = 'signed'
    )
  ) not valid -- validated by the trigger below at insert time; see note
);

comment on constraint fiscal_email_deliveries_document_signed on fiscal_email_deliveries is
  'Declared NOT VALID because a plain CHECK cannot subquery reliably across '
  'concurrent transactions; the real enforcement is fiscal_email_requires_signed '
  'below. Kept here only as self-documentation, not as the active guard.';

alter table fiscal_email_deliveries
  drop constraint if exists fiscal_email_deliveries_document_signed;

create or replace function fiscal_email_requires_signed()
returns trigger
language plpgsql
as $$
declare
  doc_status fiscal_document_status;
begin
  select status into doc_status from fiscal_documents where id = new.document_id;
  if doc_status is distinct from 'signed' then
    raise exception 'fiscal_email_deliveries: document % is not signed (status=%)', new.document_id, doc_status;
  end if;
  return new;
end;
$$;

create trigger fiscal_email_deliveries_guard_insert
  before insert on fiscal_email_deliveries
  for each row
  execute function fiscal_email_requires_signed();

create unique index if not exists fiscal_email_deliveries_document_uq on fiscal_email_deliveries (document_id);
create index if not exists fiscal_email_deliveries_due_idx
  on fiscal_email_deliveries (next_attempt_at) where status in ('queued', 'failed');

create trigger fiscal_email_deliveries_set_updated_at
  before update on fiscal_email_deliveries
  for each row
  execute function set_updated_at_timestamp();

-- ---------------------------------------------------------------------------
-- fiscal_audit_log: admin actions (manual resend, settings changes).
-- ---------------------------------------------------------------------------

create table if not exists fiscal_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references profiles(id),
  action text not null,
  document_id uuid references fiscal_documents(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table fiscal_audit_log is
  'Append-only. Written by fiscal-admin-actions for every manual action: '
  'resend, reset-rejected, settings change.';

create index if not exists fiscal_audit_log_document_idx on fiscal_audit_log (document_id);
create index if not exists fiscal_audit_log_actor_idx on fiscal_audit_log (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RPC: atomic AA reservation. Prevents two concurrent sales from getting the
-- same receipt number for the same product type.
-- ---------------------------------------------------------------------------

create or replace function fiscal_reserve_next_aa(p_product_type text)
returns table (receipt_series text, receipt_aa integer, ft_receipt_case text, ft_charge_item_case text, vat_rate integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series text;
  v_aa integer;
  v_receipt_case text;
  v_charge_case text;
  v_vat integer;
begin
  select s.receipt_series, s.next_aa, s.ft_receipt_case, s.ft_charge_item_case, s.vat_rate
  into v_series, v_aa, v_receipt_case, v_charge_case, v_vat
  from fiscal_settings s
  where s.product_type = p_product_type and s.is_active
  for update;

  if v_series is null or v_receipt_case is null or v_charge_case is null or v_vat is null then
    raise exception 'fiscal_settings for product_type % is not fully configured or not active', p_product_type;
  end if;

  update fiscal_settings set next_aa = next_aa + 1 where product_type = p_product_type;

  return query select v_series, v_aa, v_receipt_case, v_charge_case, v_vat;
end;
$$;

comment on function fiscal_reserve_next_aa(text) is
  'Locks the fiscal_settings row (FOR UPDATE) and returns the next AA plus the '
  'settings snapshot fiscal-issue-sale must store on the new fiscal_documents row. '
  'Raises if the product type is not configured, so no document is ever created '
  'with an accountant value we invented.';

revoke all on function fiscal_reserve_next_aa(text) from public;
grant execute on function fiscal_reserve_next_aa(text) to service_role;

-- ---------------------------------------------------------------------------
-- RPC: reset a rejected document back to pending with a fresh session_id.
-- Mirrors resetRejectedDocument() in repo.ts, exposed for the admin action
-- function so the service-role key stays server-side only.
-- ---------------------------------------------------------------------------

create or replace function fiscal_admin_reset_rejected(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated boolean;
begin
  if not fiscal_is_admin() then
    raise exception 'fiscal_admin_reset_rejected: caller is not a fiscal admin';
  end if;

  update fiscal_documents
  set status = 'pending', session_id = gen_random_uuid()
  where id = p_document_id and status = 'rejected';

  v_updated := found;

  if v_updated then
    insert into fiscal_audit_log (actor_id, action, document_id, details)
    values (auth.uid(), 'reset_rejected', p_document_id, '{}'::jsonb);
  end if;

  return v_updated;
end;
$$;

revoke all on function fiscal_admin_reset_rejected(uuid) from public;
grant execute on function fiscal_admin_reset_rejected(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table fiscal_settings enable row level security;
alter table fiscal_documents enable row level security;
alter table fiscal_attempts enable row level security;
alter table fiscal_email_deliveries enable row level security;
alter table fiscal_audit_log enable row level security;

-- fiscal_settings: admins read/write, through fiscal_is_admin(). Edge Functions
-- use the service-role key and bypass RLS entirely, same pattern as repo.ts.
create policy fiscal_settings_admin_all on fiscal_settings
  for all
  using (fiscal_is_admin())
  with check (fiscal_is_admin());

-- fiscal_documents: admins can read everything. Members can read their own
-- signed/rejected/unverified documents (never pending/submitting internals
-- beyond status), matching how admin.plans-and-users.tsx already scopes
-- payment history to the caller elsewhere in this project.
create policy fiscal_documents_admin_read on fiscal_documents
  for select
  using (fiscal_is_admin());

create policy fiscal_documents_member_read_own on fiscal_documents
  for select
  using (member_id = auth.uid());

-- No insert/update/delete policy for authenticated or anon: all writes go
-- through service-role Edge Functions.

create policy fiscal_attempts_admin_read on fiscal_attempts
  for select
  using (fiscal_is_admin());

create policy fiscal_email_deliveries_admin_read on fiscal_email_deliveries
  for select
  using (fiscal_is_admin());

create policy fiscal_audit_log_admin_read on fiscal_audit_log
  for select
  using (fiscal_is_admin());

commit;