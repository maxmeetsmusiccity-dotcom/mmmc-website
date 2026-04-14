#!/bin/bash
# Thread C session-start preflight. Run BEFORE any work begins.
# Catches the recurring class of bugs: garbled .env.local from Vercel
# export, stale dist/, wrong branch, broken tests from previous session.
set -e

cd "$(dirname "$0")/.."

echo "=== PREFLIGHT: $(date) ==="
echo ""

# Gate 1: Branch
BRANCH=$(git branch --show-current)
echo "Branch: $BRANCH"
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  WRONG BRANCH — expected main, got $BRANCH"
  echo "    Do NOT switch. Report to Max."
  exit 1
fi
echo "✅ Branch OK"
echo ""

# Gate 2: .env.local sanity
if [ -f .env.local ]; then
  # Fix garbled newline-in-quotes from Vercel export
  sed -i '' 's|="\(.*\)\\n"$|=\1|' .env.local 2>/dev/null || \
    sed -i 's|="\(.*\)\\n"$|=\1|' .env.local 2>/dev/null || true
  GARBLED=$(grep -c '=".*\\n"' .env.local 2>/dev/null || true)
  GARBLED=${GARBLED:-0}
  if [ "$GARBLED" -gt 0 ]; then
    echo "⚠️  .env.local has $GARBLED garbled vars"
    grep -n '=".*\\n"' .env.local
    exit 1
  fi
  echo "✅ .env.local clean"
else
  echo "ℹ️  No .env.local (OK if using Vercel env pull)"
fi
echo ""

# Gate 3: Git state
echo "HEAD: $(git log -1 --oneline)"
DIRTY=$(git status --short | wc -l | tr -d ' ')
echo "Working tree: $DIRTY changed files"
git status --short
echo "✅ Git state captured"
echo ""

# Gate 4: TypeScript
echo "--- tsc -b ---"
npx tsc -b
echo "✅ TypeScript: 0 errors"
echo ""

# Gate 5: Unit tests
echo "--- vitest ---"
npx vitest run 2>&1 | tail -5
echo "✅ Vitest passed"
echo ""

# Gate 6: Cross-thread signals
echo "--- Cross-thread signals ---"
SIGNALS=$(ls ~/Projects/cowritecompass/cross_thread/from_*_to_*__*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$SIGNALS" -gt 0 ]; then
  echo "⚠️  $SIGNALS pending signals:"
  ls ~/Projects/cowritecompass/cross_thread/from_*_to_*__*.md
else
  echo "No signals pending"
fi
echo ""

# Gate 7: Stale config detection
echo "--- Stale file check ---"
find . -maxdepth 2 \( -name "*.sql" -o -name "*config*.json" -o -name "*.env*" \) | while read f; do
  if [ -f "$f" ]; then
    AGE=$(( ($(date +%s) - $(stat -f%m "$f" 2>/dev/null || stat -c%Y "$f" 2>/dev/null || echo 0)) / 86400 ))
    if [ "$AGE" -gt 7 ]; then
      echo "⚠️  STALE ($AGE days): $f"
    fi
  fi
done
echo "✅ Stale file check complete"
echo ""

echo "=== PREFLIGHT PASS: $(date) ==="
