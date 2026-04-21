---
name: preflight
description: "Mandatory environment verification at the start of every Claude Code session. Use this skill IMMEDIATELY when a session begins — before reading any mission prompt, before touching any code, before making any plan. Triggers on: session start, 'let's get started', 'pick up where we left off', opening a new terminal, or any indication that work is about to begin. This skill prevents the recurring class of bugs where threads start working on a broken foundation: .env files with garbled quotes, stale git state, unreachable services, wrong branch checked out, or stale reference files treated as truth. Every MMMC thread has lost 15-30 minutes to a preflight bug that could have been caught in 10 seconds."
---

# Session Preflight

## Run this ENTIRE checklist before any other work. Abort and report to Max if any gate fails.

### Gate 1: Git State
```bash
git branch --show-current  # Must match your assigned branch
git fetch origin
git status -s  # Should be clean or have only expected untracked files
git log --oneline origin/$(git branch --show-current)..HEAD  # Verify sync state
```
If wrong branch: STOP. Do NOT switch branches. Report to Max.

### Gate 2: Environment Files
```bash
if [ -f .env.local ]; then
  sed -i '' 's|="\(.*\)\\n"$|=\1|' .env.local 2>/dev/null || sed -i 's|="\(.*\)\\n"$|=\1|' .env.local
  grep -c '="\(.*\)\\n"' .env.local 2>/dev/null && echo "⚠️ GARBLED ENV VARS REMAIN" || echo "✅ .env.local clean"
fi
```

### Gate 3: Test Suite Green
Run the appropriate test suite for your repo:
- ND: `python3 scripts/run_tests.py`
- NMF: `npx tsc -b && npx vitest run`
- Smart Archive: `npm run build && npx vitest run`
- CWC: `npm run build`
If tests fail at session start, the previous session left broken state. Fix before starting new work.

### Gate 4: External Services Reachable
```bash
curl -s -o /dev/null -w "Production: HTTP %{http_code}\n" "https://nashvilledecoder.com" 2>/dev/null
curl -s -o /dev/null -w "CWC: HTTP %{http_code}\n" "https://cowritecompass.com" 2>/dev/null
```

### Gate 5: Cross-Thread Signals
```bash
ls ~/Projects/cowritecompass/cross_thread/from_*_to_*__*.md 2>/dev/null || echo "No cross-thread signals"
```

### Gate 6: Stale File Detection
```bash
find . -name "*.sql" -o -name "*schema*" -o -name "*config*.json" | while read f; do
  AGE=$(( ($(date +%s) - $(stat -f%m "$f" 2>/dev/null || stat -c%Y "$f" 2>/dev/null || echo 0)) / 86400 ))
  [ "$AGE" -gt 7 ] && echo "⚠️ STALE FILE ($AGE days): $f"
done 2>/dev/null
```

### Preflight Report
After all gates, summarize: Branch, Git state, Env files, Tests, Services, Signals, Stale files, PASS/FAIL.
**No code is written until the preflight passes.**
