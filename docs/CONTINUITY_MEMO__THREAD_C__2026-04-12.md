# Thread C — Continuity Memo
## NMF Curator Studio | April 12, 2026 | End of Wave 5

This is the dense knowledge-transfer doc for the next Thread C session. Read it in order. Every section exists because the previous session learned something the hard way.

---

## 1. WHO YOU ARE AND WHAT YOU OWN

You are **Thread C** for MMMC Enterprises. You own **NMF Curator Studio** — the weekly New Music Friday Instagram carousel builder at `~/Projects/mmmc-website`. This is a **completely separate git repo** from Nashville Decoder, CoWrite Compass, or Smart Archive. You deploy with `npx vercel deploy --prod`. No merge coordination with anyone. Zero conflict risk.

**Strategic positioning**: NMF is the **Trojan Horse**. A free, beautiful tool that Max uses to build weekly carousels for @maxmeetsmusiccity (18K+ Instagram followers). Its entire purpose is to get publishers to ask "how do you know that?" when they see songwriter credits on pre-release tracks, then click the "ND Profile →" link to Nashville Decoder. It is NOT a monetized product. See `docs/NMF_SCOPE.md` for what's approved vs prohibited.

**Patent Candidate 2** — "Convergence Data Collection Architecture" — names two mechanisms you already built:
1. Free tool generates data consumed by paid tool → `artist_handle_confirmations` + `sync_handles_to_nd.py`
2. Self-chaining cron harvesting 10K entities/day → `api/cron-scan-weekly.ts`

Both are running in production. Don Clarkin should know these are production infrastructure, not architecture diagrams.

---

## 2. THE BUSINESS CONTEXT (WHY THIS MATTERS)

Max Blachman is the solo founder. Target: first paying publisher customers mid-May 2026. Pricing: $5K/mo × 5 publishers + $100 × 50 seats = $360K Year 1. Break-even is 1 publisher + 10 seats = $6K/mo. Monthly burn is $351–$656 (pre-revenue). The business docs are at `~/Downloads/Business Planning Documents/MMMC_INTERNAL_STRATEGY__v4.docx` and `MMMC_ENGINEERING_FIELD_MANUAL__v1.docx` — read them if you have time.

**The funnel:**
1. Publisher sees NMF carousel on Instagram (18K follower reach)
2. Slide shows "Written by Luke Laird — Sony Music Publishing (34 charting · 24 #1s)"
3. Publisher visits `maxmeetsmusiccity.com/newmusicfriday`
4. Clicks Coming Soon tab → sees bridge card with real upcoming track + songwriter credits
5. Clicks "ND Profile →" link
6. Lands on `nashvilledecoder.com/profiles.html?id={pg_id}`
7. Sales conversation begins

**Every single piece of this funnel exists and works right now.** The mid-May demo doesn't require more building — it requires hardening, curation, and making sure nothing regresses.

---

## 3. REPO AND INFRASTRUCTURE FACTS

| Fact | Value |
|------|-------|
| Repo | `~/Projects/mmmc-website` |
| Branch | `main` (deploys directly — no PR flow) |
| Deploy command | `npx vercel deploy --prod` |
| Stack | Vite + React 19 + TypeScript, Vercel Functions (@vercel/node), Supabase |
| Supabase project ref | `kpwklxrcysokuyjhuhun` |
| Prod domain | `https://maxmeetsmusiccity.com` |
| NMF route | `/newmusicfriday` |
| Demo page | `/demo/publisher-demo.html` |
| Songwriter cache (static) | `/data/songwriter_cache.json` (11.9 MB raw, 1.83 MB brotli) |

### Secrets (all in `.env.local`, mirrored to Vercel env)

| Key | Purpose |
|-----|---------|
| `VITE_SUPABASE_URL` | `https://kpwklxrcysokuyjhuhun.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes. **Note**: the file has a literal `\n` at end — strip it: `.strip().replace("\\n", "")` |
| `VITE_SUPABASE_ANON_KEY` | Client reads |
| `CRON_SECRET` | `bf75697474e091bfc0b3d7a81feb10e9add70ae88a003ecf10c7800e11c5425c` (cron handler auth) |
| `SCAN_SECRET` | `810d7bec32898dc3bf349ba129783bd9f4887627e22d756a19f61fa9a452a5ec` (search-apple / scan-artists auth) |
| `APPLE_MUSIC_TEAM_ID` | `G46PBQ4ZQL` |
| `APPLE_MUSIC_KEY_ID` | `XP4Q9YVKQU` — **NEVER use `H8V2P37FRA`**, it returns 401 |
| `APPLE_MUSIC_PRIVATE_KEY` | PKCS8 PEM in Vercel env |
| `ND_API_BASE_URL` | `https://nd-api.nd-api.workers.dev` (R2 browse_artists.json source) |
| `ND_AUTH_TOKEN_SECRET` | HMAC secret for R2 API auth |

### Endpoint auth patterns (non-obvious)

- `/api/cron-scan-weekly` — requires `Authorization: Bearer $CRON_SECRET` header (fail-closed)
- `/api/search-apple` — accepts EITHER `Bearer $SCAN_SECRET` OR `X-Supabase-Auth: <token>` (>20 chars) OR `Origin: https://maxmeetsmusiccity.com` (for client calls). Rate-limited 5 req/60s per IP.
- `/api/songwriter-match` — unauthenticated (public lookup API), CORS-open, edge-cached 24h
- `/api/enrichment-latest` — requires `Authorization: Bearer $CRON_SECRET` OR `X-ND-Token` header (Thread A reads this)
- `/api/migrate` — does not exist; Supabase DDL must be pasted into the SQL editor manually

### Supabase tables Thread C owns

| Table | Purpose | Who writes |
|-------|---------|------------|
| `weekly_nashville_releases` | Scan results, Coming Soon tracks | Cron + manual ingest scripts |
| `scan_metadata` | Per-week scan status + counters | Cron |
| `scan_runs` | Per-chain observability (status, duration, stats) | Cron (Block 7 also reads this for self-healing) |
| `artist_handle_confirmations` | Handle confirmations from NMF UI | Client (via NashvilleReleases) |
| `instagram_handles` | Handle resolution results | Thread A's cascade (Thread C reads) |

Migration SQL is at `migrations/001_composer_pipeline.sql` (already applied).

---

## 4. THE CURRENT TEST FLOOR

**NEVER let these numbers go down**:
- Vitest: **391/391** passing (run: `npx vitest run`)
- Playwright (local, no API): **7 passing + 4 skipped** (run: `npx playwright test`)
- Playwright (with live API): **30/30 passing** (run: `E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test`)
- TypeScript: `npx tsc -b` must exit with zero errors (stricter than `tsc --noEmit` — Vercel's CI uses `tsc -b`)

Before every commit:
1. `npx tsc -b` — zero errors
2. `npx vitest run` — 391/391
3. `npx playwright test` — 7 passing + 4 skipped (minimum)
4. For code touching the deployed funnel: `E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test` after deploy

If any of the above fails, **do not commit**. Fix the test or fix the code.

---

## 5. KNOWN BUGS FROM WAVE 5 — FIX FIRST

### BUG #1 (HIGH PRIORITY): Demo page has FAKE pg_ids

`public/demo/publisher-demo.html` contains hardcoded `pg_id` values like `pg_luke_laird`, `pg_lainey_wilson`, `pg_ryan_hurd`, etc. **These are placeholders I invented — none of them exist in Nashville Decoder's database.** Every "ND Profile →" link on the demo page is dead. This is the single most important call-to-action in the entire publisher funnel demo.

**Fix**: replace the placeholder pg_ids with the real ones below (extracted live from the songwriter cache on April 12, 2026):

| Name | Real pg_id |
|------|-----------|
| Luke Laird | `pg_496d30db2758` |
| Lainey Wilson | `pg_9e0743e7f020` |
| Emily Weisband | `pg_9328110d2c8a` |
| Ryan Hurd | `pg_1902e44c211a` |
| Daniel Ross | `pg_4d64466e379f` |
| Jaxson Free | `pg_e7fb7875e8bb` |
| Aaron Eshuis | `PG_AUTO_1e6a08d674967344` (note: legacy `PG_AUTO_` prefix) |
| Ryan Beaver | `pg_3a41f7641858` |
| Zach Abend | `pg_ee5bd60d9463` |
| Mackenzie Carpenter | `pg_0e0ded673c72` |
| Alex Kline | `pg_ef8244ea3179` |
| Ashley Gorley | `pg_df752e8c5e64` (known from Wave 2) |
| Brandon Lake | `pg_*` (look up via `/api/songwriter-match`) |

**To verify real-time**: hit `https://maxmeetsmusiccity.com/api/songwriter-match` with `{"composer_names":["Luke Laird"]}` and copy the `pg_id` from the response. Do this before pasting — cache regeneration could change pg_ids.

**Before committing the fix**: click each link manually. Open `nashvilledecoder.com/profiles.html?id={pg_id}` for at least 3 of them and verify they return profiles, not 404s. I did NOT do this in Wave 5 — that's how the bug shipped.

### BUG #2 (HIGH PRIORITY): Block 7 cron self-healing offset math is wrong on reentry

`api/cron-scan-weekly.ts` line ~140 resumes from a failed chain via:
```typescript
const resumeOffset = (lastPaused.chain_number || 0) * 2000 + (lastPaused.artists_scanned || 0);
```

This is correct ONLY when each chain starts at `chain_number * BATCH_SIZE`. **Block 7 itself breaks that invariant**: if chain 0 resumed from offset 500 (because self-healing itself fired from a previous failure), the next cron run sees `scan_runs` with `chain_number=0, artists_scanned=2000` and computes resume at `(0 * 2000 + 2000) = 2000`. The actual next offset should be `500 + 2000 = 2500`. The range `[2000, 2500)` is silently skipped.

**Fix options (pick one)**:
- **Option A (preferred)**: add a `start_offset` column to the `scan_runs` table via Supabase SQL editor:
  ```sql
  ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS start_offset INTEGER DEFAULT 0;
  ```
  Then in the cron handler: at chain start, insert `start_offset: startIdx`. At resume, compute `resumeOffset = lastPaused.start_offset + lastPaused.artists_scanned`. This makes the math always correct regardless of how chains are triggered.

- **Option B**: document the invariant "chains always start at `chain_number * BATCH_SIZE`" and REMOVE the self-healing feature entirely — it's a hazard.

**The related unit tests** in `tests/unit/wave2-features.test.ts` (describe block "cron self-healing resume offset") test the BROKEN math. They pass because they encode the broken formula. Rewrite them after the fix.

### BUG #3 (MEDIUM PRIORITY): Composer credit slide attribution is semantically misleading

`CarouselPreviewPanel.tsx` → `creditsForSlideGroup(tracks)` picks the FIRST track with composer data and renders its writers beneath a 9-track grid. A publisher viewing the carousel sees "Written by Luke Laird" beneath 9 tracks and assumes Luke Laird wrote all 9.

**Fix options**:
- **Option A (conservative)**: only render credits when `slideGroup.tracks.length === 1` (single-track slides). Grids skip credits entirely.
- **Option B (ambitious)**: redesign the slide to show a PER-TRACK credit overlay near each album cover. Much bigger change.
- **Option C (status quo + label)**: prepend "Featured writer:" above the credit block and show only the cover-feature track's name. At least the semantic claim is accurate.

Ward will notice this mismatch the moment he sees a real grid slide with credits. Option A is the safest pre-demo fix.

---

## 6. WHAT'S IN FLIGHT / NOT DONE

From the Wave 5 session, these items exist but are incomplete:

- **Block 8's staleness detector is not scheduled**. `scripts/regenerate_cache_if_stale.py` works and is idempotent. It needs a cron trigger (Vercel cron or git-hooked action). Pick a cadence (weekly or after-each-Thread-A-cascade) and wire it.
- **Coming Soon tab still fetches the full 12 MB `songwriter_cache.json`** client-side. Now that `/api/songwriter-match` exists (Block 3), `src/components/ComingSoon.tsx` can do per-composer lookups instead. Estimated: 30 min to switch, ~80% improvement on mobile 4G initial Coming Soon load.
- **Per-slide override for the credit toggle** — marked as "stretch" in the Wave 5 Block 2 prompt. Not built.
- **Real-device mobile testing on actual iPhone Safari WebKit** — automated Chromium mobile tests pass, but no one has opened Safari on a real iPhone.
- **Block 4's Playwright tests do NOT walk the live Coming Soon tab**. They test the static demo page. The real funnel surface has no automated E2E coverage because the NashvilleReleases flow requires Supabase timing that's flaky in CI.
- **Thread B publisher enrichment SQL has NOT landed**. Current songwriter cache has 158/61,668 (0.3%) publisher coverage. After Thread A applies the enrichment SQL, run `python3 scripts/regenerate_cache_if_stale.py` (Block 8). Publisher coverage should jump to ~30%+. Bridge cards will upgrade.

---

## 7. SCOPE DOC — WHAT NMF MUST NEVER BECOME

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

## 8. OPERATING RULES (LEARNED THE HARD WAY)

These are not suggestions — they're fixes for specific bugs I hit in Wave 5:

1. **ALWAYS run `tsc -b` locally, never just `tsc --noEmit`**. Vercel's build uses `tsc -b` (stricter). I shipped an unused-variable error on Wave 1 that broke the deploy.

2. **Test cron / API endpoints against PRODUCTION immediately after deploy**. Don't trust vitest + tsc. My Block 7 cron had a `ReferenceError` that vitest and tsc never caught because it was a runtime TDZ issue. My Block 3 endpoint had two FUNCTION_INVOCATION_FAILED states in production because I assumed fs paths worked in the Vercel Node bundle.

3. **Fetch static assets from CDN, not from `public/` via `fs`** in Vercel serverless functions. The `public/` directory is NOT included in the function bundle. Use `process.env.VERCEL_URL` or `maxmeetsmusiccity.com` directly with `fetch`.

4. **Use `git commit -F /tmp/msg.txt` for commit messages with parentheses or special characters**. Bash heredocs break on nested quotes. I lost time to this three times in Wave 5.

5. **Write Python scripts to `/tmp/*.py` files and execute them rather than shell heredocs**. Heredoc variable expansion corrupts Python `r['id']` references as `KeyError: <built-in function id>`. File-based scripts always work.

6. **Supabase service role key has a literal `\n` in the .env file**. Strip it before use: `.strip().replace("\\n", "")`.

7. **Don't click your own work**. Every time I skipped verifying something on the actual surface ("the test passes"), it was wrong. The fake pg_ids in Bug #1 are literally because I never clicked an "ND Profile →" link.

8. **Block 2 composer credit UI shows ONE track's writers beneath a grid of N**. Semantically misleading — see Bug #3. Either limit to single-track slides or relabel.

9. **Commit after every block, push immediately, max 1 hour of uncommitted work**. Session-level commit batching will bite you.

10. **End every session with the full test suite AND actual-surface verification**. I claimed "30/30 passing" at Wave 5 session end without re-running. Habit: right before the session-end status file, rerun everything.

---

## 9. CROSS-THREAD CONTRACTS (FILES YOU PRODUCE FOR OTHERS)

| File | Consumer | When to regenerate |
|------|----------|--------------------|
| `data/nmf_handle_sync.json` | Thread A cascade | After any batch of NMF handle confirmations (run `scripts/sync_handles_to_nd.py`) |
| `public/data/featured_artists_stats.json` | Thread D trending algo | After cascade or weekly (run `scripts/export_featured_stats.py`) |
| `api/enrichment-latest` endpoint | Thread A cascade | Live — served on-demand, cached 1h at edge |
| `public/data/songwriter_cache.json` | NMF client + any surface needing writer stats | After Thread A cascade updates ND DB (run `scripts/regenerate_cache_if_stale.py`) |

**Thread C NEVER writes** to `~/Projects/cowritecompass` or any other thread's repo. Communication is via files in `/tmp/cross_thread_request_c_to_<x>.md` or by Max forwarding messages.

---

## 10. FINAL WAVE 5 STATE

**28 commits total across all waves, 10 in Wave 5**:
```
ab54d99 Fix stale smoke test: guests now land on Nashville, not Connect Spotify
967fcbd [BLOCK 8] Songwriter cache staleness detector + auto-regen
1b557df [BLOCK 7] Cron self-healing: auto-resume from paused/failed chains  ← BUG #2 HERE
a9e0dd0 [BLOCK 6] Expand publisher demo to 5 real tracks                    ← BUG #1 HERE
a681fe3 [BLOCK 5] Mobile Playwright: +4 tests (10 total, was 6)
cbb34d6 [BLOCK 4] Playwright bridge card + funnel E2E tests
5869d2d [BLOCK 3 fix2] songwriter-match: multi-URL fallback + better logging
7572912 [BLOCK 3 fix] songwriter-match: fetch cache via HTTP, not fs
4d39900 [BLOCK 3] Server-side songwriter lookup API /api/songwriter-match
d3546b8 [BLOCK 2] Composer credit slide toggle in carousel settings        ← BUG #3 HERE
```

**Live endpoints** (verified April 12, 2026):
- `https://maxmeetsmusiccity.com/newmusicfriday` → 200
- `https://maxmeetsmusiccity.com/demo/publisher-demo.html` → 200 (BUT LINKS ARE BROKEN — Bug #1)
- `https://maxmeetsmusiccity.com/api/songwriter-match` POST `{"composer_names":["Ashley Gorley"]}` → 200 returns `pg_df752e8c5e64`
- `https://maxmeetsmusiccity.com/api/cron-scan-weekly?max_chains=1` with `Authorization: Bearer $CRON_SECRET` → 200, self-healing verified working (but see Bug #2)

**5 tracks with real composer data in Supabase `weekly_nashville_releases`** (April 12, 2026):
1. Lainey Wilson — "The Jesus I Know Now" (2026-04-03) — Brandon Lake, Lainey Wilson, Emily Weisband, Luke Laird
2. Tucker Wetmore — "Sunburn" (2026-04-04) — Daniel Ross, Ryan Hurd, Jaxson Free
3. Flatland Cavalry — "Work of Heart" (2026-03-27) — Cleto Cordero, Ryan Beaver, Aaron Eshuis
4. Mackenzie Carpenter — "All In Already" (2026-04-03) — Mackenzie Carpenter, Zach Abend, Mia Mantia, Allison Veltz
5. Tigirlily Gold — "Country & Midwestern" (2026-03-27) — Kendra Slaubaugh, Krista Slaubaugh, Daniel Ethridge, Alex Kline

**Uncommitted files in working tree** (safe to ignore — all untracked artifacts):
- `data/nmf_handle_sync.json` (modified — regenerated each sync run)
- `data/songwriter_cache.json` (untracked — ignore, not the real cache)
- `dragnet.mjs` (untracked — leftover script, safe to ignore)

---

## 11. AUDIT FILE REFERENCES

- `/tmp/exhaustion_audit_thread_c.md` — my honest self-assessment at session end
- `/tmp/thread_c_session_end_status.md` — the protocol-mandated handoff status
- `/tmp/report_thread_c_mobile_smoke.md` — Block 5 mobile smoke test report
- `docs/PERFORMANCE_AUDIT.md` — measured numbers from Wave 3/4
- `docs/NMF_SCOPE.md` — scope document (read before building anything new)

---

## 12. IF YOU ONLY DO 4 THINGS, DO THESE

1. **Fix Bug #1**: replace fake pg_ids in `public/demo/publisher-demo.html`, manually click each link, deploy
2. **Fix Bug #2**: add `start_offset` column to `scan_runs` and rewrite the resume math
3. **Address Bug #3**: pick an option and ship it (recommend Option A — single-track slides only)
4. **Re-run the full test suite on the actual prod surface** after each fix: `E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test`

Everything else is gravy. These three bugs are in the critical path of the publisher funnel. The first publisher demo is mid-May. Don't ship a broken funnel.
