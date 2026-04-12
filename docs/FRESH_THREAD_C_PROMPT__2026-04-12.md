# THREAD C — FRESH SESSION PROMPT
## Wave 6: Fix the Funnel + Pre-Demo Hardening
## April 12, 2026 (or whenever the next session starts)

---

## WHO YOU ARE

You are **Thread C** for MMMC Enterprises. You own **NMF Curator Studio** — the weekly New Music Friday Instagram carousel builder and publisher funnel — at `~/Projects/mmmc-website`. This is a **completely separate git repo** from Nashville Decoder, CoWrite Compass, or any other thread's work. You deploy with `npx vercel deploy --prod`. No merge coordination with anyone. Zero conflict risk.

**Read this first** (required):
- `docs/CONTINUITY_MEMO__THREAD_C__2026-04-12.md` — everything about the current state, secrets, bugs, operating rules
- `docs/NMF_SCOPE.md` — what NMF is and is NOT. Enforce scope.

After reading those, proceed below.

---

## WHAT NMF IS (THE TROJAN HORSE)

A free, beautiful, data-collecting carousel builder. Its ENTIRE job is to get publishers curious enough to click a "ND Profile →" link and land on Nashville Decoder. It is NOT a monetized product. It generates Instagram handle confirmations and Apple Music composer data that feed Nashville Decoder via the Convergence Engine — this is Patent Candidate 2 in the business strategy doc and both mechanisms are live in production.

**The money flow** (verify this exists and works before touching anything else):
1. Publisher sees NMF carousel on Instagram (18K follower reach)
2. Slide shows "Written by Luke Laird — Sony Music Publishing (34 charting · 24 #1s)"
3. Publisher visits `maxmeetsmusiccity.com/newmusicfriday`
4. Clicks Coming Soon tab → bridge card with real upcoming track + songwriter credits
5. Clicks "ND Profile →"
6. Lands on `nashvilledecoder.com/profiles.html?id={pg_id}`
7. Sales conversation starts

**The mid-May publisher demo is the forcing function.** Everything you do is measured against: does this make a publisher more likely to subscribe to Nashville Decoder?

---

## YOUR PREDECESSOR'S SESSIONS (Waves 1–5)

28 commits across 5 waves:
- **Wave 1**: Ward's feedback (showcase dropdown, Coming Soon separation, ZIP download), mobile polish, self-chaining cron (10K artists/day)
- **Wave 2**: Composer pipeline (songwriter cache from ND DB, Apple Music composerName extraction, Coming Soon bridge cards with gold-bordered ND Profile links)
- **Wave 3**: NMF scope doc, enrichment API for Thread A cascade, carousel songwriter slide rendering, fast-check property tests
- **Wave 4**: Performance audit with real numbers, handle sync end-to-end verification, publisher demo page with live Apple Music data
- **Wave 5**: Composer credit toggle, `/api/songwriter-match` server-side lookup, Playwright bridge card + mobile expansion, cron self-healing, cache staleness detector

Final Wave 5 test floor:
- **391/391 Vitest**
- **30/30 Playwright against live prod** (with `E2E_API_BASE=https://maxmeetsmusiccity.com`)
- **TypeScript `tsc -b` clean**

**DO NOT let these numbers decrease.**

---

## WAVE 6 EXECUTION ORDER

### BLOCK 0: Verify the funnel is still healthy (15 min)

```bash
cd ~/Projects/mmmc-website
git status --short              # should be near-clean (one modified data file is fine)
git log --oneline -5            # should show commit ab54d99 at HEAD
npx tsc -b                      # zero errors
npx vitest run                  # 391/391
npx playwright test             # 7 passing + 4 skipped

# Live surface verification:
curl -s -o /dev/null -w "%{http_code}\n" https://maxmeetsmusiccity.com/newmusicfriday
curl -s -o /dev/null -w "%{http_code}\n" https://maxmeetsmusiccity.com/demo/publisher-demo.html
curl -s -X POST https://maxmeetsmusiccity.com/api/songwriter-match \
  -H "Content-Type: application/json" \
  -d '{"composer_names":["Ashley Gorley"]}' | head -1
```

All three curls should return 200 / valid JSON. Gorley lookup should return `pg_df752e8c5e64`. If anything is broken, fix it before proceeding.

### BLOCK 1 (HIGHEST PRIORITY): Fix the fake pg_ids in the demo page

**The bug**: `public/demo/publisher-demo.html` has hardcoded placeholder pg_ids like `pg_luke_laird`, `pg_lainey_wilson`, `pg_ryan_hurd`. None of these exist in Nashville Decoder's database. Every "ND Profile →" link on the demo page — the entire publisher funnel's money click — is a 404. My predecessor never clicked one during verification. This is the single most important broken thing in the repo.

**Fix**:
1. For each placeholder pg_id in `public/demo/publisher-demo.html`, look up the real pg_id via `/api/songwriter-match`:
   ```bash
   for name in "Luke Laird" "Lainey Wilson" "Emily Weisband" "Ryan Hurd" "Daniel Ross" "Jaxson Free" "Aaron Eshuis" "Ryan Beaver" "Zach Abend" "Mackenzie Carpenter" "Alex Kline"; do
     echo -n "$name: "
     curl -s -X POST https://maxmeetsmusiccity.com/api/songwriter-match \
       -H "Content-Type: application/json" \
       -d "{\"composer_names\":[\"$name\"]}" | python3 -c "import sys,json; print(json.load(sys.stdin)['matches'][0]['pg_id'])"
   done
   ```
2. Replace each placeholder in the HTML with the real pg_id.
3. **Before committing**: `curl -s -o /dev/null -w "%{http_code}\n" "https://nashvilledecoder.com/profiles.html?id=<pg_id>"` for at least 3 of them. All must return 200. If they don't, something is wrong with either the songwriter cache or ND's profile routing — escalate to Max.
4. Commit: `[BLOCK 1] Fix fake pg_ids in demo page — real ND Profile links`
5. Deploy: `npx vercel deploy --prod`
6. Verify on the actual surface: open `https://maxmeetsmusiccity.com/demo/publisher-demo.html` in a browser, click one of the "ND Profile →" links, verify you land on a real Nashville Decoder profile page.

### BLOCK 2 (HIGH PRIORITY): Fix the cron self-healing offset math

**The bug**: `api/cron-scan-weekly.ts` computes resume offset as `(chain_number * BATCH_SIZE + artists_scanned)`. This is correct ONLY when each chain starts at `chain_number * BATCH_SIZE`. Block 7 of Wave 5 (the self-healing feature itself) breaks that invariant — if chain 0 resumes from offset 500, the next cron invocation silently skips the range `[2000, 2500)` because it assumes chain 0 started at 0.

**Fix (Option A — preferred)**:
1. Run in Supabase SQL editor:
   ```sql
   ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS start_offset INTEGER DEFAULT 0;
   ```
2. Modify `api/cron-scan-weekly.ts`:
   - At chain start, insert `start_offset: startIdx` into the `scan_runs` row
   - At self-heal resume, compute `resumeOffset = lastPaused.start_offset + lastPaused.artists_scanned`
3. Rewrite the related unit tests in `tests/unit/wave2-features.test.ts` (describe block "cron self-healing resume offset") — they currently encode the broken formula.
4. Run the full vitest suite.
5. **Integration test live**: trigger a cron run without explicit offset, verify scan_runs has the new row with `start_offset` populated. Then trigger a SECOND run without offset — verify it correctly resumes from `start_offset + artists_scanned`, NOT from `chain_number * 2000`.
6. Commit: `[BLOCK 2] Fix cron self-healing: use start_offset column instead of derived math`
7. Deploy, verify cron endpoint returns 200.

### BLOCK 3 (MEDIUM PRIORITY): Fix the misleading composer credit attribution on grid slides

**The bug**: `src/components/CarouselPreviewPanel.tsx` → `creditsForSlideGroup(tracks)` picks the FIRST track with composer data and renders its writers as a single credit block beneath a 9-track grid. A publisher seeing "Written by Luke Laird" beneath 9 album covers reasonably assumes Luke Laird wrote all 9. He didn't. Ward will notice this the moment he reviews.

**Fix (Option A — conservative)**:
1. In `creditsForSlideGroup`, return `[]` unless `tracks.length === 1`.
2. Update the Block 2 toggle UI copy in `CarouselPreviewPanel.tsx`: "Show songwriter credits on single-track slides".
3. Run vitest.
4. Commit: `[BLOCK 3] Composer credits only render on single-track slides`
5. Deploy, generate a test carousel with a single-track slide, verify credits render. Generate one with a multi-track grid, verify credits don't render.

### BLOCK 4 (MEDIUM): Re-run full test suite against production

After Blocks 1–3 are deployed:
```bash
E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test --reporter=list
npx vitest run
```

All 30 Playwright + all Vitest tests must pass. Update `tests/e2e/bridge-card-funnel.spec.ts` if any of the Block 1 pg_id changes broke assertions (the ND Profile link tests may need updating to match the new real hrefs).

### BLOCK 5 (LOW, if time permits): Switch ComingSoon to /api/songwriter-match

`src/components/ComingSoon.tsx` still loads the full 11.9 MB `public/data/songwriter_cache.json` on mount. Block 3 of Wave 5 shipped `/api/songwriter-match` which does server-side lookups with edge caching. Switching ComingSoon to use the API drops mobile 4G initial load from ~1.6s to ~200ms.

**Approach**:
- In ComingSoon, collect all unique composer names from the current releases array
- POST them to `/api/songwriter-match` in a single request
- Store the response in local state
- Replace the existing `songwriterCache` Map lookup with the response map
- Remove the 12 MB JSON fetch from the useEffect

**Verify**: run `npx playwright test` + load the Coming Soon tab in the browser, confirm bridge cards still render with the same data.

---

## BLOCKS FOR LATER SESSIONS (not Wave 6 — flag for strategy thread if they need attention)

- Wire `scripts/regenerate_cache_if_stale.py` to a Vercel cron or GitHub Action so it runs weekly or after-Thread-A-cascade. Currently it exists and works but nothing invokes it.
- Build Playwright tests that walk the actual NashvilleReleases → Coming Soon → bridge card flow in the live NMF app. Currently only the static demo page has coverage.
- Real-device mobile testing (iPhone Safari WebKit, not Chromium emulation).
- Per-slide override for composer credit toggle (stretch goal from Wave 5 Block 2).
- `composer_credits_found` trend dashboard (from Wave 3's scan_runs observability — useful for tracking Apple Music metadata coverage over time).
- When Thread B's publisher enrichment SQL lands: run `python3 scripts/regenerate_cache_if_stale.py` to pick up publisher coverage boost from 0.3% to ~30%+.

---

## STANDING RULES (WAVE 5 LESSONS — DO NOT VIOLATE)

1. **Always `npx tsc -b`** before committing, never just `tsc --noEmit`. Vercel CI is stricter.
2. **Always smoke-test new Vercel functions against production** immediately after deploy. Vitest + tsc do not catch runtime TDZ errors or fs/bundle assumptions.
3. **Fetch static assets via HTTP from CDN**, not via `fs` in serverless functions. `public/` is NOT in the function bundle.
4. **Use `git commit -F /tmp/msg.txt`** for messages with parentheses or special characters. Heredoc escaping will bite you.
5. **Write Python as files in `/tmp/`**, not as heredocs. Heredoc variable expansion corrupts `r['id']` as `KeyError: <built-in function id>`.
6. **Supabase service role key has `\n` literal** in .env.local — strip it: `.strip().replace("\\n", "")`.
7. **Click your own work.** If a link exists, click it. If a button exists, tap it. Don't trust "the test passes" — the Wave 5 dead pg_ids shipped because nobody clicked them.
8. **Commit after every block, push immediately**, max 1 hour of uncommitted work. Session-level batching loses data.
9. **End every session by rerunning the full test suite AND hitting the live endpoints**. Do not report numbers you haven't re-verified.
10. **Read `docs/NMF_SCOPE.md`** before building anything new. If it's not in the approved list, say no.

---

## INFRASTRUCTURE QUICK REFERENCE

| Thing | Value |
|-------|-------|
| Repo | `~/Projects/mmmc-website` |
| Deploy | `npx vercel deploy --prod` |
| Production domain | `maxmeetsmusiccity.com` |
| Supabase ref | `kpwklxrcysokuyjhuhun` |
| CRON_SECRET | `bf75697474e091bfc0b3d7a81feb10e9add70ae88a003ecf10c7800e11c5425c` |
| SCAN_SECRET | `810d7bec32898dc3bf349ba129783bd9f4887627e22d756a19f61fa9a452a5ec` |
| Apple Music Team | `G46PBQ4ZQL` |
| Apple Music Key | `XP4Q9YVKQU` (NEVER `H8V2P37FRA`) |

### Test commands

```bash
# Vitest (fast, no network)
npx vitest run                      # 391/391 must pass

# TypeScript build-mode (stricter than --noEmit)
npx tsc -b                          # zero errors

# Playwright against local vite preview (7 passing + 4 skipped)
npx playwright test

# Playwright against live prod API (30/30 must pass)
E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test
```

### Useful one-liners

```bash
# Look up a real pg_id from the live API
curl -s -X POST https://maxmeetsmusiccity.com/api/songwriter-match \
  -H "Content-Type: application/json" \
  -d '{"composer_names":["Luke Laird"]}' | python3 -m json.tool

# Trigger cron with explicit offset (safe test)
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://maxmeetsmusiccity.com/api/cron-scan-weekly?max_chains=1&offset=0" | python3 -m json.tool

# Trigger cron with self-healing (no offset — exercises Block 7 path)
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://maxmeetsmusiccity.com/api/cron-scan-weekly?max_chains=1" | python3 -m json.tool

# Apple Music search with origin auth (for adding demo tracks)
curl -s -X POST https://maxmeetsmusiccity.com/api/search-apple \
  -H "Origin: https://maxmeetsmusiccity.com" \
  -H "Content-Type: application/json" \
  -d '{"artistNames":["Lainey Wilson"],"daysBack":30,"targetFriday":"2026-04-10"}'

# Verify a ND profile URL resolves (click-test alternative)
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://nashvilledecoder.com/profiles.html?id=pg_df752e8c5e64"
```

---

## END-OF-SESSION PROTOCOL

Before closing the session:
1. Commit all work (staged specifically — NEVER `git add -A`)
2. Push to remote
3. Run `npx vitest run` — must be ≥391/391
4. Run `npx tsc -b` — zero errors
5. Run `E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test` — must be 30/30
6. Hit each modified endpoint on production and verify response
7. Write `/tmp/thread_c_session_end_status.md` with commit hashes, test state, known gaps, cross-thread requests

---

## THE ONE NUMBER THAT MATTERS

**Publisher demo conversion: carousel view → ND Profile link click.**

Everything in Wave 6 (and every future wave) is ranked against this metric. Bug #1 makes it literally zero on the demo page. Bug #2 silently corrupts the cron. Bug #3 makes the slide credits semantically wrong. All three degrade the one number that matters. Fix them first, then everything else.

---

END OF PROMPT
