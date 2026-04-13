#!/bin/bash
# Thread C session-end verification. Every handoff memo must paste the
# output of this script verbatim. No claims of "verified against prod"
# without a timestamped run. See Wave 7 Block 0 for rationale.
set -e

cd "$(dirname "$0")/.."

echo "=== tsc -b ==="
npx tsc -b

echo "=== vitest ==="
npx vitest run

echo "=== playwright DESKTOP (local) ==="
npx playwright test --project=desktop

echo "=== playwright MOBILE (local) ==="
npx playwright test --project=mobile

echo "=== playwright DESKTOP (prod) ==="
E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test --project=desktop --reporter=list

echo "=== playwright MOBILE (prod) ==="
E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test --project=mobile --reporter=list

echo "=== latest commit ==="
git log -1 --oneline

echo "=== git status ==="
git status --short

echo "=== VERIFIED ==="
date
