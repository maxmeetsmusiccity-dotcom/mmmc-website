# Thread C — Wave 7 Continuity Memo
## From Wave 6 → Wave 7 | 2026-04-13
## Read this FIRST, in order. Every section exists because the previous session learned something the hard way.

This memo supersedes `docs/CONTINUITY_MEMO__THREAD_C__2026-04-12.md`. It carries forward everything still valid and adds what Wave 6 learned.

---

## 1. Who you are, what you own

You are **Thread C** for MMMC Enterprises. You own **NMF Curator Studio** — the weekly New Music Friday Instagram carousel builder and publisher funnel at `~/Projects/mmmc-website`. Completely separate git repo from Nashville Decoder, CoWrite Compass, or any other thread's work. You deploy with `npx vercel deploy --prod`. No merge coordination with anyone. Zero conflict risk.

**Strategic positioning** — NMF is the **Trojan Horse**. A free, beautiful, data-collecting carousel builder whose entire purpose is to get publishers curious enough to click a "ND Profile →" link and land on Nashville Decoder. It is NOT a monetized product. It generates Instagram handle confirmations and Apple Music composer data that feed Nashville Decoder via the Convergence Engine — this is Patent Candidate 2 in the business strategy doc and both mechanisms are live in production.

**The money flow** (mid-May publisher demo is the forcing function):
1. Publisher sees NMF carousel on Instagram (18K follower reach)
2. Slide shows "Written by Luke Laird — Sony Music Publishing (34 charting · 24 #1s)"
3. Publisher visits `maxmeetsmusiccity.com/newmusicfriday`
4. Clicks Coming Soon tab → bridge card with real upcoming track + songwriter credits
5. Clicks "ND Profile →"
6. Lands on `nashvilledecoder.com/profiles.html?id={pg_id}`
7. Sales conversation starts

**Every piece of this funnel exists and works as of Wave 6.** The gap is step 6 — ND's auth gate 302s unauthenticated visitors to Coming Soon. See §7 Known Upstream Blockers.

---

## 2. Repo + infra facts

| Fact | Value |
|---|---|
| Repo | `~/Projects/mmmc-website` |
| Branch | `main` (deploys directly — no PR flow) |
| Deploy command | `npx vercel deploy --prod` |
| Stack | Vite + React 19 + TypeScript, Vercel Functions (@vercel/node), Supabase |
| Supabase project ref | `kpwklxrcysokuyjhuhun` |
| Prod domain | `https://maxmeetsmusiccity.com` |
| NMF route | `/newmusicfriday` |
| Publisher demo page | `/demo/publisher-demo.html` |
| Songwriter cache (static) | `/data/songwriter_cache.json` (11.9 MB raw) |
| HEAD at Wave 6 end | `02bdb33` |

### Secrets (all in `.env.local`, mirrored to Vercel env)

| Key | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | `https://kpwklxrcysokuyjhuhun.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes. **Gotcha**: the file stores it as `"<value>\n"` — literal quotes AND a literal `\n`. Strip both: `value.replace(/^"|"$/g, '').replace(/\\n$/, '')` in Node, or `sed 's/^"//; s/"$//; s/\\n$//'` in shell. |
| `VITE_SUPABASE_ANON_KEY` | Client reads |
| `CRON_SECRET` | cron handler auth — Bearer token |
| `SCAN_SECRET` | /api/search-apple + /api/scan-artists auth — Bearer token |
| `APPLE_MUSIC_TEAM_ID` | `G46PBQ4ZQL` |
| `APPLE_MUSIC_KEY_ID` | `XP4Q9YVKQU` — **NEVER use `H8V2P37FRA`**, it returns 401 |
| `APPLE_MUSIC_PRIVATE_KEY` | PKCS8 PEM in Vercel env |
| `ND_API_BASE_URL` | `https://nd-api.nd-api.workers.dev` |
| `ND_AUTH_TOKEN_SECRET` | HMAC secret for R2 API auth |

### Endpoint auth patterns (non-obvious)

- `/api/cron-scan-weekly` — `Authorization: Bearer $CRON_SECRET` header (fail-closed). Accepts query params: `week`, `offset`, `max_chains`, `chain`.
- `/api/search-apple` — accepts EITHER `Bearer $SCAN_SECRET` OR `X-Supabase-Auth: <token>` OR `Origin: https://maxmeetsmusiccity.com`. Rate-limited 5 req/60s per IP.
- `/api/songwriter-match` — unauthenticated (public lookup API), CORS-open, edge-cached 24h. **Returns both `matches` and `matches_by_input` (Wave 6 Block 5 addition — use this for client-side cache building keyed by raw input strings).**
- `/api/enrichment-latest` — `Authorization: Bearer $CRON_SECRET` OR `X-ND-Token` header (Thread A reads this).
- `/api/migrate` — **does not exist**; Supabase DDL must be pasted into the SQL editor manually.

---

## 3. Current test floor — NON-NEGOTIABLE

**These numbers must never go down.** Every handoff memo must re-verify them before claiming anything.

| Gate | Number | Command |
|---|---|---|
| TypeScript build | 0 errors | `npx tsc -b` (**NOT** `tsc --noEmit` — Vercel CI is stricter) |
| Vitest | **393 / 393** | `npx vitest run` |
| Playwright (localhost preview) | **27 passed + 4 skipped** | `npx playwright test` |
| Playwright (against real prod) | **31 passed + 2 skipped** | `E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test` |

**The 31+2 against prod is the HONEST number** — it's the first structurally-correct prod run in the repo's history (Wave 6 Block 4 wired `E2E_API_BASE` into `playwright.config.ts`; prior waves claimed "30/30 against prod" but the env var wasn't wired and the tests were actually hitting localhost except for 4 API tests that happened to hit prod).

The 2 skipped are data-dependent: they exercise the Coming Soon tab funnel IF any future-dated release has `composer_name` populated. None do as of 2026-04-13 — upstream gap, will auto-activate when Thread A's composer enrichment catches up.

### Before every commit, always run in this order:
1. `npx tsc -b` — zero errors
2. `npx vitest run` — 393/393
3. `npx playwright test` — 27+4-skip minimum
4. Only if touching the deployed funnel: `E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test` → 31+2-skip
5. Paste the output into the commit message or session-end file if you're claiming "verified against prod"

---

## 4. Wave 6 summary — what landed

| # | Commit | Block | Key change |
|---|---|---|---|
| 1 | `2b404e0` | BLOCK 1 | Replaced 11 placeholder pg_ids in publisher demo page with real ones from `/api/songwriter-match` live lookup |
| 2 | `5b16571` | BLOCK 2 | Added `scan_runs.start_offset INTEGER DEFAULT 0`; fixed cron self-healing resume math to `start_offset + artists_scanned`; new Bug #2 regression test |
| 3 | `3389420` | BLOCK 3 | Composer credits in `CarouselPreviewPanel.tsx` now only render on single-track slides (prevents 9-track-grid misattribution) |
| 4 | `38bee0c` | BLOCK 4 | Wired `E2E_API_BASE` into `playwright.config.ts`; widened demo-page pg_id regex to accept `PG_AUTO_` prefix |
| 5 | `d8eb7dd` | BLOCK 5 | `ComingSoon.tsx` switched from 12MB static cache fetch to per-release batch POST to `/api/songwriter-match`; API gained `matches_by_input` response field |
| 6 | `02bdb33` | ADDENDUM #7 | 3 new Playwright tests for the live Coming Soon tab funnel; fixed `guestBypass` to actually click through AuthGate |

### Infra change outside the repo
- `scan_runs` table: `ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS start_offset INTEGER DEFAULT 0;` — applied via Supabase SQL editor. Migration file in repo: `migrations/002_scan_runs_start_offset.sql`.

---

## 5. The three Wave-5-inherited bugs are all fixed

All three bugs called out in `docs/CONTINUITY_MEMO__THREAD_C__2026-04-12.md` as "fix first" are now fixed AND verified:

1. ✅ **Fake pg_ids in demo page** (Bug #1) → Block 1
2. ✅ **Cron self-healing offset math** (Bug #2) → Block 2 (+ live integration test via `week=2099-01-02&offset=999999`)
3. ✅ **Composer credits misleading attribution** (Bug #3) → Block 3 (Option A chosen)

---

## 6. Three latent Wave 5 bugs ALSO found and fixed

These were never called out in the Wave 5 handoff — I found them mid-Wave-6 while trying to verify my own work. They matter because their fixes unlocked the rest of Wave 6's verification.

### Latent Bug A — `E2E_API_BASE` was never wired into `playwright.config.ts`
Waves 1-5 all claimed "30/30 passing against live prod". Actually running `E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test` sent the API tests to prod (they build full URLs from the env var) but sent ALL page-navigation tests to `http://localhost:4173` because the config hardcoded `baseURL` there. Split-brain. Fixed in Block 4.

### Latent Bug B — Stale dist + `reuseExistingServer: true` = silent false positives
Playwright's webServer config reuses an existing `:4173` server if one is running. When combined with `dist/` being stale (not rebuilt since the last edit), tests can pass against old code while the developer thinks they pass against new code. This was exactly how my initial "30/30 after Block 3" was fake — the dist had Wave 5's placeholder pg_ids, and the regex tested `/^...\?id=pg_/` which was case-sensitive and happened to match the old lowercase placeholders. Fixed by explicit rebuild + force; see §9 recommendation #2 for the permanent fix.

### Latent Bug C — `guestBypass` helper never actually entered the app
The helper at `tests/e2e/smoke.spec.ts:4` only set `localStorage.nmf_guest_mode=1`. But `AuthGate` checks `sessionStorage.nmf_entered` which is only set by clicking the "Get Started as a Guest" button. So guestBypass left the browser on the AuthGate landing page. The existing smoke test `NMF page loads with guest mode` happened to pass because the landing page ALSO renders a `<h1>New Music Friday</h1>` heading — same text, different component. Every prior "NashvilleReleases guest mode" assertion was actually asserting against the landing page. Fixed in Addendum #7 by adding a new `openNmfAsGuest` helper that clicks the button.

### Why these matter for Wave 7
Your predecessor's test-floor claims were unreliable because of these. **Don't trust ANY "verified against prod" claim in a memo unless you see a timestamped output of `E2E_API_BASE=... npx playwright test` pasted in verbatim.** The §3 floor above IS timestamped — Wave 6 ran all four gates at 2026-04-13 before writing this memo.

---

## 7. Known upstream blockers (not Thread C work)

### Blocker A — ND auth lockdown makes the publisher funnel unreachable
Every `nashvilledecoder.com/profiles.html?id=<pg_id>` 302s to the Coming Soon landing page for unauthenticated visitors. Including known-good `pg_df752e8c5e64` (Ashley Gorley) and deliberately bogus ids. This is the **Da Vinci Code auth gate**, not a routing bug. Block 1 correctly swapped 11 placeholder pg_ids to real ones, but publishers clicking any ND Profile link today still lands on Coming Soon. 

**Cross-thread ask**: `/tmp/cross_thread_request_c_to_ui.md` — Thread UI / Thread A needs to confirm the publisher demo auth mechanism. Options: pre-set cookie, `?demo=<hmac_token>` query param, public `/p/<pg_id>` route, or localhost:8765 workaround.

**Thread C cannot close this alone.** Mid-May demo is blocked on it.

### Blocker B — Zero future-dated releases have `composer_name` populated
242 future-dated releases exist in `weekly_nashville_releases` (scan_week=2026-04-10), but **zero** have `composer_name`. So the live Coming Soon tab renders zero bridge cards with songwriter stats today. The Playwright tests I added in Addendum #7 gracefully skip on this, but that means the only thing verifying the funnel end-to-end right now is the navigation path, not the actual data rendering.

**Partial unblock Thread C can do**: write a one-shot backfill script that queries `weekly_nashville_releases WHERE composer_name IS NULL AND release_date > today`, calls `/api/search-apple` for each track, and UPSERTs. ~100-300 rows, ~$0.50 cost. Recommended as Wave 7 block 1.

### Blocker C — Songwriter cache publisher coverage at 0.3%
158 / 61,668 writers have publisher strings in `songwriter_cache.json`. Thread A delivered `dim_publisher_roster_v1` (387 rows, 54 publishers with tier classification) but the cache hasn't been regenerated against it. Wave 5 addendum #6 says to run `python3 scripts/regenerate_cache_if_stale.py --force` once Thread A confirms cascade + R2 upload is done. **Status at end of Wave 6**: waiting on Thread A confirmation.

---

## 8. Scope doc — what NMF must never become

From `docs/NMF_SCOPE.md`:

**Approved**:
- Carousel builder (This Week + Coming Soon)
- Bridge cards with songwriter charting stats + ND Profile links
- Carousel slides with songwriter credits (Instagram funnel)
- Handle confirmation button (data collection)
- Showcase filtering, progressive rendering, mobile polish
- ZIP/image download, Save to Photos

**Prohibited** (would cannibalize Nashville Decoder's paid product):
- Songwriter search field
- Publisher intelligence display beyond basic names
- Email digest (belongs on ND)
- Any feature that makes NMF a standalone product instead of a funnel

If you're ever unsure whether to build something, read the scope doc. If it's not in the approved list, say no unless Max explicitly overrides.

---

## 9. Operating rules — carry-over from Wave 5 + Wave 6 additions

These rules exist because of specific session-ending bugs. Not suggestions.

1. **Always `npx tsc -b` before committing, never just `tsc --noEmit`.** Vercel CI is stricter.
2. **Always smoke-test new Vercel functions against production** immediately after deploy. Vitest + tsc do not catch runtime TDZ errors or fs/bundle assumptions.
3. **Fetch static assets via HTTP from CDN**, not via `fs` in serverless functions. `public/` is NOT in the function bundle.
4. **Use `git commit -F /tmp/msg.txt`** for messages with parentheses or special characters. Heredoc escaping will bite you.
5. **Write Python as files in `/tmp/`**, not as heredocs. Heredoc variable expansion corrupts `r['id']` as `KeyError: <built-in function id>`.
6. **Supabase service role key has quotes AND `\n` literal** in `.env.local`. Strip both: `sed 's/^"//; s/"$//; s/\\n$//'`.
7. **Click your own work.** If a link exists, click it. If a button exists, tap it. Don't trust "the test passes" — Wave 5's dead pg_ids shipped because nobody clicked them, and Wave 5's guestBypass was structurally broken because nobody verified it actually reached the app.
8. **Commit after every block, push immediately**, max 1 hour of uncommitted work. Session-level commit batching will bite you.
9. **End every session by re-running the full test suite AND hitting live endpoints.** No handoff memo without a timestamped test run pasted in.
10. **Read `docs/NMF_SCOPE.md`** before building anything new.

### Wave 6 additions:
11. **When Playwright fails "element intercepts pointer events"**, jump straight to `element.evaluate((e) => e.click())`. Don't iterate through `force: true`; it's rarely the fix.
12. **Before trusting any "31/30 against prod" number, verify `playwright.config.ts` actually uses `E2E_API_BASE`.** If `baseURL` is hardcoded, the claim is probably split-brain.
13. **Before trusting any Playwright test that uses the guest-bypass helper, verify the helper actually clicks "Get Started as a Guest".** A landing-page assertion is not an in-app assertion.
14. **If you rebuild `dist/` mid-session, kill :4173 first** (or set `reuseExistingServer: false` for that run) to avoid stale-dist false positives.
15. **When writing integration tests that touch live Supabase**, use a far-future `week=2099-XX-XX` + far-past-end `offset=999999` pattern to avoid burning scan quota, and always save+restore `scan_metadata` around the test. See Wave 6 Block 2 integration test for the canonical pattern.

---

## 10. Cross-thread contracts — files you produce for others

| File | Consumer | When to regenerate |
|---|---|---|
| `data/nmf_handle_sync.json` | Thread A cascade | After any batch of NMF handle confirmations (`scripts/sync_handles_to_nd.py`) |
| `public/data/featured_artists_stats.json` | Thread D trending algo | After cascade or weekly (`scripts/export_featured_stats.py`) |
| `api/enrichment-latest` endpoint | Thread A cascade | Live — served on-demand, edge-cached 1h |
| `public/data/songwriter_cache.json` | NMF client + any surface needing writer stats | After Thread A cascade updates ND DB (`scripts/regenerate_cache_if_stale.py`) |

**Thread C NEVER writes** to another thread's repo. Communication: files in `/tmp/cross_thread_request_c_to_<x>.md` or Max forwarding messages.

---

## 11. Risk mitigation steps — Wave 7 opening priorities

Extracted from the Top 10 Recommendations document. Listed in priority order for Wave 7:

### Priority 1 (must do in Wave 7's first hour — structural hardening)
- **R2 — Kill the stale-dist foot-gun.** Add `pretest` hook to rebuild dist, or set `reuseExistingServer: false` when E2E_API_BASE is not set. 10 min. Prevents another Block-4-style silent failure.
- **R9 — Session-end verification ritual.** Write `scripts/session-end-verify.sh` that runs all four gates in order, and mandate it in the operating rules. 15 min. Structurally enforces handoff honesty.
- **R1 — `npm run test:prod` command.** Add to `package.json` so the canonical prod test is a single keystroke. 15 min. Prevents forgetting the env var.

### Priority 2 (unblock the publisher demo funnel)
- **R5 — ND auth bypass for demo.** Cross-thread with Thread UI / Thread A. Design the signed-token or public-route option. 1-2 hr of coordination + implementation.
- **R6 — Composer enrichment backfill.** One-shot script to populate `composer_name` on existing future releases. Unlocks the two vacuous Playwright tests + the real Coming Soon bridge card rendering. 45 min.

### Priority 3 (quality-of-life + compounding wins)
- **R3 — Guest-mode E2E sanity test.** Retire the 5-wave ghost bug permanently. 10 min.
- **R4 — Normalize `.env.local` service role key.** Remove the every-session sed-strip friction. 20 min.
- **R7 — CarouselPreviewPanel perf optimization.** Mirror Block 5's pattern. Same file, same API, new surface. 30 min.
- **R8 — Publisher funnel analytics.** Click tracking + dashboard for the one metric that matters. 1-2 hr.

### Priority 4 (template + documentation)
- **R10 — Continuity memo template.** Promote this memo's structure to `docs/templates/` so other threads can adopt it. 40 min.

**Recommended Wave 7 sequence**: Do Priority 1 first (45 min of pure hardening before touching anything else), then decide between Priority 2A (R5 cross-thread) or Priority 2B (R6 backfill) based on whether Thread UI is available. Priority 3 fits into the remaining session. Priority 4 can slide to Wave 8 if Wave 7 is tight.

---

## 12. Opportunity seizure — where to push harder

1. **`matches_by_input` is reusable beyond ComingSoon.** Any surface rendering writer stats can now drop the 12MB static cache. CarouselPreviewPanel is the obvious next target (R7), but future surfaces like email digests, analytics panels, or showcase readouts can all use the same pattern.

2. **The Playwright-against-prod path is now real.** Run it on a daily cron as a health check. If the live funnel breaks (e.g., ND pulls a change that affects profile URLs, Supabase schema changes, scan pipeline crashes), you'll know within 24 hours instead of at demo time.

3. **`scan_runs.start_offset` observability is now correct.** Wave 3 identified a `composer_credits_found` trend dashboard as "pending". Now that the observability table is trustworthy, it's the right time to build it — a simple Supabase view + `/api/observability-summary` endpoint + rendered panel on a private debug page.

4. **Block 2 integration-test pattern is reusable.** The save-scan_metadata → trigger-cron-with-2099-week → verify-row → delete-test-row → restore-scan_metadata dance works for any future cron-handler integration test. Could be a `tests/integration/` directory with a shared helper.

5. **The Wave 5 handoff's "30/30 against prod" fiction is now exposed.** Make honesty contagious — write the session-end verify script in a way that OUTPUTS the test result to a timestamped file, so handoff memos can reference that file rather than paraphrasing it. Structural drift prevention.

6. **NMF is the Trojan Horse, and the funnel is HTML-correct.** Once ND auth is resolved (R5), every real publisher who sees an NMF carousel on Instagram becomes a potential conversion. Anything that reduces friction between "Instagram view" and "ND profile click" is worth more than new features.

---

## 13. First hour of Wave 7 — suggested opening move

Don't jump into a block. Do hardening first.

```bash
# 1. Verify the floor holds
cd ~/Projects/mmmc-website
git status --short                                        # should be near-clean
git log --oneline -7                                      # should show Wave 6 commits ending at 02bdb33
npx tsc -b                                                # 0 errors
npx vitest run                                            # 393/393
npx playwright test                                       # 27+4-skip
E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test   # 31+2-skip
```

Every number above must match. If ANY is off, stop and investigate before proceeding.

```bash
# 2. Verify live surface
curl -s -o /dev/null -w "%{http_code}\n" https://maxmeetsmusiccity.com/newmusicfriday           # 200
curl -s -o /dev/null -w "%{http_code}\n" https://maxmeetsmusiccity.com/demo/publisher-demo.html # 200
curl -s -X POST https://maxmeetsmusiccity.com/api/songwriter-match \
  -H "Content-Type: application/json" \
  -d '{"composer_names":["Ashley Gorley"]}' | head -1                                            # has pg_df752e8c5e64
```

```bash
# 3. Do the Priority 1 hardening (45 minutes total)
# - Add pretest hook to package.json (R2, 10 min)
# - Write scripts/session-end-verify.sh (R9, 15 min)
# - Add npm run test:prod script (R1, 15 min)
# Commit as a single "[Wave 7 HARDENING] ..." commit.
```

Only then start the real work. The hardening commit means every subsequent claim in Wave 7 is verifiable structurally.

---

## 14. Ask Max these questions in the first exchange

1. Has Thread A confirmed cascade + R2 upload is done? If yes, run `python3 scripts/regenerate_cache_if_stale.py --force` before anything else.
2. Has Thread UI / Thread A made a call on the ND auth bypass for the publisher demo? (Blocker A.) If yes, get the mechanism and wire Thread C's side.
3. Are there new Wave 6 commits or rollbacks on nashvilledecoder.com that would change which pg_ids are valid? (Sanity check — if Thread A reshuffled entity IDs, the demo page links may need regenerating.)
4. Is there anything urgent for mid-May demo prep that outranks the R1/R2/R9 hardening? If yes, do it first. Otherwise hardening wins.

---

## 15. Final reminder: the one number that matters

**Publisher demo conversion: carousel view → ND Profile link click.**

Everything in Wave 7 (and every future wave) is ranked against this metric. The funnel HTML is correct. The blocker is upstream (ND auth). When that's solved, every other improvement compounds.

---

*End of memo. Wave 6 author-thread context rating: 6/10 at session close. This memo is written to let a fresh thread hit the ground running at 10/10. If you're reading this in Wave 7 — read §3 and §9 first, then §7 blockers, then §11 priorities, then start with §13's first hour.*
