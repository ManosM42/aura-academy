#!/usr/bin/env bash
# Runs the automated myDATA unit tests. Mocks only: no network access, no credentials, no AADE call.
set -euo pipefail
cd "$(dirname "$0")/.."
TEST=supabase/functions/_shared/mydata/mydata.test.ts
if command -v deno >/dev/null 2>&1; then
  echo "Running with Deno"; exec deno test --no-check "$TEST"
elif command -v node >/dev/null 2>&1; then
  echo "Running with Node $(node --version)"; exec node --experimental-strip-types --test "$TEST"
else
  echo "Install Deno (https://deno.com) or Node >= 22.6 to run the tests." >&2; exit 1
fi
