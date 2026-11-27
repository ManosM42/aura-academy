#!/usr/bin/env bash
# =====================================================================
# AURA ACADEMY: deploy the Viva.com payment system
#
# Run from the PROJECT ROOT (the folder that contains supabase/config.toml), after
#   * installing the Supabase CLI and running `supabase login`
#   * running supabase/migrations/20261120000000_viva_complete.sql in the SQL editor
#
# It prints NO secret. It can:
#   1. (optional) fetch your webhook key from Viva and save all Viva secrets in Supabase
#   2. deploy every Viva function (and the updated cancel / plan-change functions)
#   3. check that the deployment answers correctly
#   4. (only when secrets were set now) write viva-renew-cron.sql for the monthly renewals
# =====================================================================
set -euo pipefail

for tool in curl supabase sed; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing tool: $tool"; exit 1; }
done
[ -f supabase/config.toml ] || { echo "Run this from the project root (supabase/config.toml not found)."; exit 1; }

PROJECT_REF="$(sed -n 's/^project_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' supabase/config.toml | head -1)"
[ -n "$PROJECT_REF" ] || { echo "Could not read project_id from supabase/config.toml"; exit 1; }
BASE_URL="https://${PROJECT_REF}.supabase.co/functions/v1"
echo "Supabase project: ${PROJECT_REF}"
read -rp "Is this the right project? (y/N): " OKREF
[ "$OKREF" = "y" ] || { echo "Cancelled."; exit 1; }

echo
read -rp "Set or update the Viva secrets now? (y/N): " SETSECRETS
CRON_FILE_WRITTEN=""
if [ "$SETSECRETS" = "y" ]; then
  echo "Which Viva account are these credentials from?"
  read -rp "Type DEMO (test payments) or LIVE (REAL MONEY): " MODE
  case "$MODE" in
    DEMO) VIVA_ENV="sandbox";    PREFIX="VIVA_SANDBOX_";    VIVA_HOST="https://demo.vivapayments.com" ;;
    LIVE) VIVA_ENV="production"; PREFIX="VIVA_PRODUCTION_"; VIVA_HOST="https://www.vivapayments.com"
          read -rp "LIVE means real customers are charged. Type LIVE again to confirm: " AGAIN
          [ "$AGAIN" = "LIVE" ] || { echo "Cancelled."; exit 1; } ;;
    *) echo "Cancelled."; exit 1 ;;
  esac

  read -rp  "Merchant ID: " MERCHANT_ID
  read -rsp "API key (typing is hidden): " VIVA_API_KEY; echo
  read -rp  "Smart Checkout Client ID: " CLIENT_ID
  read -rsp "Smart Checkout Client Secret (hidden): " CLIENT_SECRET; echo
  read -rp  "Payment source code: " SOURCE_CODE

  for v in "$MERCHANT_ID" "$VIVA_API_KEY" "$CLIENT_ID" "$CLIENT_SECRET" "$SOURCE_CODE"; do
    case "$v" in
      ""|*"'"*|*$'\n'*) echo "A value is empty or contains a quote / line break. Stopping."; exit 1 ;;
    esac
  done

  echo "1/4 Asking Viva for the webhook key..."
  KEY_JSON="$(curl -sS -f -u "${MERCHANT_ID}:${VIVA_API_KEY}" "${VIVA_HOST}/api/messages/config/token")" \
    || { echo "Viva refused the request. Check the Merchant ID / API key belong to the ${MODE} account."; exit 1; }
  WEBHOOK_KEY="$(printf '%s' "$KEY_JSON" | sed -n 's/.*"Key"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  [ -n "$WEBHOOK_KEY" ] || { echo "Unexpected answer from Viva (no Key found)."; exit 1; }
  echo "    got the webhook key (not shown)."

  if command -v openssl >/dev/null 2>&1; then CRON_SECRET="$(openssl rand -hex 32)"
  else CRON_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"; fi

  ENV_FILE="$(mktemp)"; chmod 600 "$ENV_FILE"
  trap 'rm -f "$ENV_FILE"' EXIT
  {
    printf "VIVA_ENV='%s'\n" "$VIVA_ENV"
    printf "%sCLIENT_ID='%s'\n" "$PREFIX" "$CLIENT_ID"
    printf "%sCLIENT_SECRET='%s'\n" "$PREFIX" "$CLIENT_SECRET"
    printf "%sSOURCE_CODE='%s'\n" "$PREFIX" "$SOURCE_CODE"
    printf "%sWEBHOOK_KEY='%s'\n" "$PREFIX" "$WEBHOOK_KEY"
    printf "%sMERCHANT_ID='%s'\n" "$PREFIX" "$MERCHANT_ID"
    printf "%sAPI_KEY='%s'\n" "$PREFIX" "$VIVA_API_KEY"
    printf "CRON_SECRET='%s'\n" "$CRON_SECRET"
    printf "VIVA_WEBHOOK_IP_MODE='log'\n"
  } > "$ENV_FILE"
  echo "    saving secrets in Supabase..."
  supabase secrets set --env-file "$ENV_FILE" --project-ref "$PROJECT_REF"
  rm -f "$ENV_FILE"
else
  echo "1/4 Keeping the secrets that are already in Supabase."
fi

echo "2/4 Deploying the functions..."
for fn in create-viva-checkout viva-webhook viva-renew verify-viva-payment viva-health create-book-checkout create-online-checkout; do
  supabase functions deploy "$fn" --no-verify-jwt --project-ref "$PROJECT_REF"
done
for fn in change-plan cancel-subscription; do
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo "3/4 Checking the deployment..."
FAIL=0
WH="$(curl -sS "${BASE_URL}/viva-webhook" || true)"
case "$WH" in
  *'"Key":"'?*) echo "    OK: the webhook answers Viva's verification request." ;;
  *) echo "    NOT OK: the webhook did not return a key (answer: ${WH:0:80}). The webhook key secret may be missing."; FAIL=1 ;;
esac
LOCKED="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}/viva-renew" || true)"
if [ "$LOCKED" = "401" ]; then echo "    OK: the renewal function is locked to the scheduler."
else echo "    NOT OK: the renewal function answered ${LOCKED} (expected 401)."; FAIL=1; fi
VERIFY="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' "${BASE_URL}/verify-viva-payment" || true)"
if [ "$VERIFY" = "400" ]; then echo "    OK: the payment verification function is reachable."
else echo "    NOT OK: verify-viva-payment answered ${VERIFY} (expected 400). Check the Viva secrets."; FAIL=1; fi

if [ "$SETSECRETS" = "y" ]; then
  echo "4/4 Writing viva-renew-cron.sql (contains a secret)..."
  ( umask 077; cat > ./viva-renew-cron.sql <<SQL
-- Run this ONCE in the Supabase SQL editor, then DELETE this file.
-- Needs the pg_cron and pg_net extensions (Dashboard > Database > Extensions).
select cron.schedule(
  'viva-renew-hourly',
  '7 * * * *',
  \$\$
  select net.http_post(
    url := '${BASE_URL}/viva-renew',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '${CRON_SECRET}'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  \$\$
);
-- To stop ALL Viva renewals at any time:  select cron.unschedule('viva-renew-hourly');
SQL
  )
  CRON_FILE_WRITTEN="yes"
  unset VIVA_API_KEY CLIENT_SECRET WEBHOOK_KEY KEY_JSON CRON_SECRET
else
  echo "4/4 Skipped (the monthly-renewal schedule is created when you set the secrets)."
fi

echo
if [ "$FAIL" = "1" ]; then echo "Some checks failed: see the messages above, then run this script again."; exit 1; fi
cat <<DONE
Done. What is left (see VIVA_SETUP.md):
  - In the Viva dashboard: success/failure URL, webhook, "Allow recurring payments via API".
$( [ -n "$CRON_FILE_WRITTEN" ] && echo "  - Run ./viva-renew-cron.sql in the Supabase SQL editor, then delete it." )
  - Open the admin panel > Viva > "Έλεγχος" to see that everything is green.
DONE
