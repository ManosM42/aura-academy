# AADE myDATA integration (direct) - phase 2: configuration, credentials, client

Status labels used below: **Written** (in this package), **Unit-tested** (automated, mocks only),
**Not deployed**, **Not DEMO-verified**, **Not LIVE-verified**.

## Architecture

| Concern | System | Where |
|---|---|---|
| Payment | Viva (sandbox / production) | existing `viva*.ts`, unchanged |
| Fiscal document transmission | AADE myDATA direct (demo / live) | `_shared/mydata/*`, tables `mydata_*` |
| Viva Fiscalisation | separate integration, untouched | `_shared/fiscal/*`, `fiscal_*` tables |
| Email | Resend | existing `fiscal-email-worker`, to be connected in a later phase |
| Admin | `mydata-admin` Edge Function (UI wiring is a later phase) | `supabase/functions/mydata-admin` |

The Viva payment environment and the myDATA environment are separate settings. They are never derived from each
other. A document is issued only when they correspond (sandbox payment <-> demo, production payment <-> live);
otherwise the payment stays un-issued (`assertPaymentMatchesEnvironment`).

**One authoritative issuance channel.** `mydata_config.issuance_channel` is `none | mydata | viva_fiscalisation`
(default `none`). Only the chosen channel may issue, so a payment can never receive two fiscal documents.
Leaving `mydata` closes the LIVE gate. NOTE: the existing `fiscal-issue-sale` function does not read this setting
yet. Until the integration phase adds that guard, do not enable both flows for the same payments.

## DEMO / LIVE isolation (how it is enforced)

1. `endpoints.ts` is the only place mapping an environment to a URL (DEMO `https://mydataapidev.aade.gr`,
   LIVE `https://mydatapi.aade.gr/myDATA`, both taken from AADE's official specification v2.0.2).
2. The database locks `mydata_environment_settings.base_url` to the matching official host per row (CHECK constraint).
3. Credentials are stored in Supabase Vault under per-environment names and fetched through
   `mydata_get_credentials(env)`, executable by `service_role` only. There is no environment-variable fallback.
4. A `MyDataCredentials` object carries its environment; `createMyDataClient` refuses a mismatch.
5. LIVE needs two separate steps: `enable_live` (every prerequisite must pass, typed confirmation) and
   `set_environment live` (second typed confirmation). Prerequisites: issuance channel is `mydata`, LIVE credentials
   configured, a successful LIVE connection test, issuer VAT number and series set, all five LIVE product rules
   confirmed. Replacing credentials clears the last test result.
6. Every state change is an RPC that re-checks the actor against `public.fiscal_admins` and writes
   `mydata_audit_log` in the same transaction (append-only).

## What was verified against AADE sources

Read from the official documents (`myDATA API Documentation v2.0.2`, ERP) and AADE's published sample XML:
endpoints for both environments; headers `aade-user-id` and `ocp-apim-subscription-key`; `SendInvoices`,
`CancelInvoice?mark=`, `RequestTransmittedDocs`; response `statusCode` values `Success`, `ValidationError`,
`TechnicalError`, `XMLSyntaxError`; business errors returned with HTTP 200; namespaces, element order and the
unprefixed `incomeClassification` wrapper in the XML.

**Not verified (do not rely on it until a DEMO submission succeeds):** that AADE accepts the XML this code builds;
the `dd/MM/yyyy` date format for reconciliation queries; that `RequestTransmittedDocs?mark=<huge>` is a harmless
probe for the connection test; HTTP 429 meaning "not processed".

## Accountant / legal confirmations required before LIVE (nothing here is defaulted)

1. Which invoice type per product: retail receipt (11.1 / 11.2), service invoice, or other. The code accepts only
   types in AADE's list and takes the choice from `mydata_product_rules`.
2. VAT category and rate per product (subscription, renewal, upgrade, book, seminar) and the exemption category
   if any item is VAT-exempt. Whether prices are VAT-inclusive (the code assumes inclusive and rounds the VAT half
   up; `net = gross - vat`).
3. Income classification type and category per product.
4. Payment-method type code for online card payments, and whether card payments require a provider signature or
   other fields. The code can pass a `providersSignature` but has no authority to invent one.
5. Whether AURA may transmit receipts straight to myDATA as an ERP, or whether the legal channel for online card
   sales must be a certified provider / certified invoicing software. This decides whether the direct channel is
   usable in LIVE at all.
6. Shipping on book orders (VAT treatment), numbering rules (gaps are possible when an allocated number is
   unused), series naming, and the cancellation/credit-note procedure.

## Apply (Supabase SQL editor, project kvnpixezrebxuvgbznqr)

1. Run `scripts/sql/fiscal-live-schema-diagnostic.sql` and keep the output.
2. Apply `supabase/migrations/20261128090000_fiscal_authz_corrective.sql`.
3. Run `scripts/sql/fiscal-provision-admin.sql`.
4. Apply `supabase/migrations/20261128100000_mydata_foundation.sql` (needs the `supabase_vault` extension).
5. Run `scripts/sql/tests/fiscal-authz-test.sql` and `scripts/sql/tests/mydata-foundation-test.sql`; every line
   must print `PASS`.
6. Deploy: `supabase functions deploy mydata-admin --project-ref kvnpixezrebxuvgbznqr`
   (JWT verification stays ON; this function is called by a logged-in admin).

Run the unit tests locally: `./scripts/mydata-test.sh`.

## Known repository inconsistency (found while reading `main`)

The Edge Functions on `main` call database objects that the committed migration
`20261127190000_fiscal_foundation.sql` does not define: columns such as `environment`, `merchant_id`,
`receipt_reference`, `series`, `aa`, and the functions `fiscal_allocate_aa`, `fiscal_record_attempt`,
`fiscal_claim_due_emails`, `fiscal_complete_email_delivery`, `fiscal_fail_email_delivery`,
`fiscal_abort_email_delivery`, `fiscal_request_email_resend`, `fiscal_request_reconciliation`, and a different
signature of `fiscal_admin_reset_rejected`. The live database was therefore probably changed outside the repo. The
diagnostic SQL will show the real state. The myDATA tables in this package do not depend on any of it.
