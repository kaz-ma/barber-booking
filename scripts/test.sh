#!/usr/bin/env bash
# npm test: unit + DOM + DB tests. Uses TEST_DATABASE_URL when set (CI); otherwise starts the
# local cluster from scripts/db-local.sh and uses its barber_test database.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  bash scripts/db-local.sh start >/dev/null
  TEST_DATABASE_URL="$(bash scripts/db-local.sh url test)"
  export TEST_DATABASE_URL
fi

exec npx vitest run "$@"
