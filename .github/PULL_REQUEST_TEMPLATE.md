## What changed

<!-- 1-3 sentences. What did this PR ship? -->

## Why

<!-- The reason the change exists. Link a strategy signal or cross_thread memo when relevant. -->

## Testing

- [ ] Unit tests added/updated in the same commit as the code change
- [ ] Regression test added if this PR fixes a known bug class
- [ ] `npm run build` / `pytest` / `run_tests.py` green locally
- [ ] Playwright dual-viewport green (UI PRs)
- [ ] Contract tests updated if an external API surface changed (UI / scan / Workers)

## Data / destructive operations

- [ ] No >10-row prod UPDATE/DELETE in this PR, OR
- [ ] Pre-destructive signal filed (`cross_thread/from_<thread>_to_strategy__pre_destructive__*.md`) + APPROVED reply received
- [ ] Migration file committed BEFORE execution (R45)
- [ ] Rollback path documented (SQL rollback file, `wrangler rollback` command, or `git revert <sha>`)

## Canary

- [ ] Gorley canary `(805, 116, 84)` verified exact before + after any DB write (ND work)
- [ ] Bat Cave canary 6/6 verified (TSA work)
- [ ] Scan-health / Workers health verified (NMF / Workers work)

## Related

<!-- Signals consumed / issues closed / cross-thread dependencies -->

---
*Auto-checks enforced by `.github/workflows/ci.yml`. See `docs/ui_critique_round1/roadmap.md` for design discipline and `feedback_no_deferrals` for no-deferral rule.*
