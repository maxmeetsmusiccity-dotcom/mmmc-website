# Weekly Scan Architecture & Operations

**Purpose:** Produce a complete, accurate universe of every new music release
from Nashville's showcase artists (~7,500 entities) and surface it to publishers
by Friday morning. The scan fires Thursday 11:30 PM CT (= Friday 4:30 AM UTC)
immediately after New Music Friday drops, and must complete overnight.

This document codifies the rules, the architecture, and the operational
procedures — written during and after the April 17, 2026 incident, when we
discovered that the scan had been silently broken in four compounding ways for
over a week. Everything here is load-bearing. Edit with care.

---

## 1. Non-negotiable rules (apply to every change)

These are invariants. Breaking any of them regressed us today. If you think one
should change, add a new rule and deprecate the old one; do not silently remove.

### R1. Apple `/artists/{id}/albums` **must** use `sort=-releaseDate`.
Apple's default sort for that endpoint is not chronological. Prolific artists'
newest releases sit beyond any reasonable `limit`. Always request:
```
GET /v1/catalog/us/artists/{id}/albums?limit=25&sort=-releaseDate
```
This is undocumented but reliable. Verified by direct test April 17, 2026:
Kacey Musgraves' "Middle of Nowhere" (May 1 pre-release) went from invisible
to position 1 after this change.

### R2. Every album **must** be expanded into per-track rows.
A 6-track EP stored as 1 row is a 5-track data loss. Use the catalog API's
batch fetch with `include=tracks`:
```
GET /v1/catalog/us/albums?ids={id1,id2,...}&include=tracks
```
Emit one output row per track. Use the track's ISRC where present for
deduplication across Apple/Spotify:
```
track_id = "apple_isrc_" + isrc  ||  "apple_track_" + catalog_track_id
```
Set `album_spotify_id = "apple_album_" + album_id` as a grouping key so the UI
can cluster tracks from the same release.

### R3. Artist name matching **must** be exact (case-insensitive).
"ANNALEA" (Nashville) fuzzy-matched to "Alea Aquarius" (German audiodrama) on
Apple search today. Never fall back to `results[0]` on a non-exact match; return
empty, cache the miss, move on. A missed match beats a wrong match.
```ts
const match = results.find(a => a.name.toLowerCase() === input.toLowerCase());
if (!match) return { id: null, reason: 'no_exact_match' };
```

### R4. Use the `artist_platform_ids` cache.
Searching for each artist by name on every weekly scan is 3× the API budget
we need. Look up platform IDs once, cache them in Supabase, re-use forever.
Cache miss → search + save. Cache hit → skip search, go straight to `/albums`.
Table: `artist_platform_ids` (migration `004_artist_platform_ids.sql`).

### R5. 429 retries **must** share a 30-second budget per handler invocation.
Per-call 60s sleeps cascade into function timeouts. Fail open to partial results
+ cache writes, not closed to 0 results.
```ts
const budget = new RateBudget(30_000);  // one per handler call
fetchWith429Retry(url, init, budget);
```

### R6. Inter-chain pacing ≥ 30s.
Back-to-back chain dispatch kills rolling-window rate limits around chain 4-5.
Spotify's dev-mode quota is measured in a rolling 30-second window. 30s pause
between chains gives the window time to reset.

### R7. Fire-and-forget chain dispatch — not awaited recursion.
Each chain awaiting the next blows the 300s function budget at depth 2:
```ts
// WRONG: recursive await, chain 0 stays alive for all 25 chains
await fetch(nextChainUrl);
// RIGHT: dispatch and return
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 3000);
await fetch(nextChainUrl, { signal: ctrl.signal }).catch(e => {
  if (e.name === 'AbortError') return; // expected — child is independent
  throw e;
});
```

### R8. Never retry a 429 aggressively.
Spotify's `Retry-After` escalates exponentially — we have seen 13-hour bans
reported. One retry with a short wait (<10s), then skip and cache the miss.

### R9. Never scale up without observability.
Before running a 7500-artist scan, verify a 10-artist probe returns sensible
results first. Before running 1000 chains, run 1.

### R10. `scan_runs` is the source of truth. Monitor it.
`tracks_found: 0` for 2+ consecutive runs is a critical alert. If you see it,
stop everything and diagnose before running another scan.

---

## 2. Architecture

### Data flow

```
Thursday 23:30 CT (Friday 04:30 UTC)
     │
     ▼
Vercel scheduled cron → /api/cron-scan-weekly?force_rescan=true
     │
     ▼
Chain 0 (first 300 artists of universe)
  ├── Apple Music block (primary, parallel pool of 10)
  │      ├── for each artist name:
  │      │      ├── cache-lookup (artist_platform_ids)
  │      │      │    └── hit → skip search, use cached Apple ID
  │      │      │    └── miss → search-apple, write cache
  │      │      ├── /artists/{id}/albums?sort=-releaseDate&limit=25
  │      │      ├── filter by date window (cutoff → +28d)
  │      │      ├── batch-fetch tracks for matching albums
  │      │      └── emit one row per track
  │      └── upsert to weekly_nashville_releases
  ├── Spotify block (optional, serial with 400ms gap)
  │      └── same pattern, scan-artists.ts
  ├── sleep 30s
  └── fire-and-forget dispatch → Chain 1 (next 300)
     │
     ▼
... cascade through all 25 chains (7,500 artists) ...
     │
     ▼
Data landed in weekly_nashville_releases by ~05:30 UTC
(= 12:30 AM CT Friday, ~1 hour after scan starts)
```

### Key files

| File | Purpose |
|------|---------|
| `api/cron-scan-weekly.ts` | Orchestrator. Loads universe from R2, iterates chains, dispatches fire-and-forget. |
| `api/search-apple.ts` | Apple Music catalog scanner. Per-artist search → albums → tracks. |
| `api/scan-artists.ts` | Spotify catalog scanner. Per-artist search → albums → tracks. |
| `api/_platform_cache.ts` | `artist_platform_ids` cache helpers + `RateBudget` + `fetchWith429Retry`. |
| `vercel.json` | Cron schedule. Currently `30 4 * * 5` = Friday 04:30 UTC = Thursday 11:30 PM CT. |
| `migrations/004_artist_platform_ids.sql` | Platform-ID cache table. |

### Tables

| Table | Role |
|-------|------|
| `weekly_nashville_releases` | Output. One row per (scan_week, track_id). Upsert on conflict. |
| `artist_platform_ids` | Cache. One row per canonical artist name with Spotify + Apple IDs. |
| `scan_runs` | Observability. One row per chain invocation with counts, duration, status. |
| `scan_metadata` | High-level state (last_scan_week, r2_generated_at, current status). |

### Rate limit reality

| Platform | Token type | Observed ceiling | Our budget |
|----------|------------|------------------|------------|
| Spotify  | client_credentials (app-level) | ~180 req/min rolling 30s, dev-mode | 150 req/min sustained |
| Spotify  | user OAuth (authorization_code) | ~5× higher than app | frontend-only right now |
| Apple    | developer JWT | Undocumented; catalog endpoints cached server-side; search is stricter | Conservative parallelism 10 |
| Apple    | music user token | Higher per-user | not used server-side |

The only way to fit 7,500 artists into the overnight window inside Spotify dev
quota is to SKIP the search step via the cache. After bootstrap, weekly scans
are 1 `/albums` call per artist = ~7,500 calls/run, ~50 calls/min spread over
2.5 hours. Comfortably inside quota.

---

## 3. Monitoring (the real prevention)

The April 17 incident happened because six days of zero-track cron runs were
silently logged and never alerted on. Monitoring gaps:

### Implemented

- `scan_runs` table captures chain-level telemetry.
- cron response includes `apple_tracks` and `spotify_tracks` per-chain.
- Console logs for each chain include duration, track counts, and status.

### Required (not yet built)

- **Zero-track alert.** If the Friday cron sum-of-tracks-this-week < 100, page
  on-call. Any number below that means the scan broke.
- **Week-over-week anomaly alert.** If this week's release count is < 50% of
  the rolling 4-week average, alert. Catches silent regressions like the
  fuzzy-match pollution that inflates counts without reflecting reality.
- **Rate-limit health probe.** Hourly call to Spotify `/v1/me` and Apple
  catalog search. Any 429 response → alert. Pre-warning of imminent overnight
  run trouble.
- **SCAN_SECRET integrity check.** On boot, compare the env var's length and
  prefix to a known-good fingerprint stored in Supabase. If mismatched, refuse
  to run the cron and alert. (The April 17 root cause was a trailing `\n`
  baked into the env var.)

---

## 4. Runbook — Thursday 11 PM CT operator checklist

Do this every Thursday before 10:30 PM CT:

### Pre-flight (30 minutes before scheduled fire)

1. **Verify R2 universe.** `curl https://maxmeetsmusiccity.com/api/browse-artists`.
   Should return 18 categories with non-zero counts. Total artist union should
   be ≥ 7,000.
2. **Verify `scan_metadata.status` = 'complete' or 'idle'.** If stuck on
   'scanning' from a prior run, reset via SQL:
   `UPDATE scan_metadata SET status='idle' WHERE id='nashville_weekly';`
3. **Verify cache is populated.**
   `SELECT COUNT(*) FROM artist_platform_ids WHERE apple_artist_id IS NOT NULL;`
   Should be ≥ 5,000. If under 1,000, the scan will search every artist and
   likely timeout — investigate before running.
4. **Probe both APIs.**
   ```bash
   curl -X POST https://maxmeetsmusiccity.com/api/search-apple \
     -H "Authorization: Bearer $SCAN_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"artistNames":["Lainey Wilson","Kacey Musgraves"],"daysBack":8,"targetFriday":"YYYY-MM-DD"}'
   ```
   Should return tracks in <5s. If 0 tracks or timeout, APIs are rate-limited
   and tonight's scan will fail.
5. **Check Vercel deployment.** Latest prod deploy must be the Friday-release
   code (no pending migrations or experimental branches).

### Fire (11:30 PM CT automatic)

Vercel cron fires `/api/cron-scan-weekly?force_rescan=true`. Watch:
- `scan_runs` table fills with chain 0, 1, 2... rows
- `weekly_nashville_releases` count climbs

### Post-flight (12:30 AM CT — 60 min after fire)

- Final release count should be 500-2000 tracks typical week. Under 200 = bad.
- `scan_metadata.status` should be `'complete'`.
- No chain in `scan_runs` should have `tracks_found: 0` AND `duration_ms < 5000`
  (that signature = rate-limit-induced silent failure).
- `scan_metadata.r2_generated_at` should match the R2 snapshot timestamp.

### If the scan failed

1. **DO NOT immediately retry.** Retrying extends rate limits.
2. Check Vercel logs for 401/429/500 distribution.
3. Check `artist_platform_ids` — did we populate new IDs? (Indicates search
   worked but albums failed, vs. search failed entirely.)
4. Wait minimum 60 minutes for rate windows to reset.
5. Trigger a single-chain diagnostic (`max_chains=1&offset=0`) before
   re-running the full cascade.

---

## 5. Cache bootstrap (one-time, before first production use)

The cache (`artist_platform_ids`) needs a populated baseline before the weekly
cron can run without search overhead. Bootstrap procedure:

1. Extract the 7,500-artist universe from R2 (union of all category `artists`).
2. Run at 1 req/sec sustained (to stay well under every rate limit):
   ```bash
   python3 /tmp/apple_universe_scan.py  # see repo for current version
   ```
3. Completes in ~30 minutes for Apple. Each run populates
   `apple_artist_id` + `apple_display_name` for every artist it resolves.
4. Repeat for Spotify — separately, on a different day if rate budget is tight.
5. Once both platforms cached, weekly scan is a pure `/albums` loop.

Re-bootstrap every 3-6 months to catch newly-discovered artists and refresh
stale platform IDs.

---

## 6. Incident timeline — April 17, 2026

Reference for understanding why each rule exists.

| Time | Event |
|------|-------|
| ~Apr 9 | Prod `SCAN_SECRET` env var acquires a trailing `\n` (unknown cause) |
| Apr 11 | First failed cron — `tracks_found: 0`, nobody notices |
| Apr 11-16 | Every cron run logs zero tracks to `scan_runs`. DB gets populated instead by Max's browser-side manual scans, masking the failure. |
| Apr 17 00:00 | New Music Friday drops |
| Apr 17 04:30 UTC | Scheduled cron fires, 401s on every artist, 0 tracks written |
| Apr 17 08:43 CT | Max notices UI shows only 40 releases — vs 500+ expected |
| Apr 17 09:35 | SCAN_SECRET trailing-newline identified, env var rewritten, redeployed |
| Apr 17 09:45 | First successful scan since Apr 9; immediately reveals rate-limit cliff at chain 4 |
| Apr 17 10:00 | Spotify quota poisoned from earlier hammering; Apple still responsive |
| Apr 17 10:15 | Architecture fixes shipped: cache, 429 budget, inter-chain pacing, strict name match, per-track expansion, Apple sort=-releaseDate |
| Apr 17 10:30 | Max's personal scan broken — fuzzy match "ANNALEA"→"Alea Aquarius" pollution discovered |
| Apr 17 10:45 | Strict-match fix shipped. Universe bootstrap initiated. |

### Root-cause stack

The incident looked simpler than it was because four bugs hid each other:

1. `SCAN_SECRET` trailing newline → silent 401 on every call. Hid everything below.
2. Apple default sort not chronological → prolific-artist new releases invisible. Hidden by #1 because no Apple calls were getting through.
3. Album-level rows instead of per-track → 2-3× undercount on every release. Hidden by #2 because we weren't counting anyway.
4. Fuzzy name-match fallback → "ANNALEA"→"Alea Aquarius" pollution. Surfaced only after #1 fixed let calls through.

Each fix unmasks the next. This is why running a live probe before declaring
anything "fixed" is R9. And why chasing a single explanation is usually wrong
when a system has been quiet for days.

---

## 7. Open work (not shipped as of April 17, 2026)

- **Spotify user-OAuth refresh-token server-side.** Store Max's refresh token
  in Supabase, let the cron use his per-user Spotify quota. 10× the dev-mode
  app ceiling. Biggest remaining unlock for reliability.
- **Spotify Extended Quota Mode application.** Slow (weeks), ~5% approval
  rate per Spotify's May 2025 criteria. File in parallel; treat as insurance.
- **Alerting.** All the monitoring rules above exist as SQL queries or log
  filters. None are paged. Build a daily Friday 1 AM CT Slack notification
  that posts the post-flight checklist results.
- **Cover art `{w}`/`{h}` template substitution verification.** We substitute
  Apple's URL template literals. Verify none slip through unreplaced.

---

## 8. Golden-path code references

Use these as the canonical examples when modifying scan code:

- `api/search-apple.ts` — the `processArtist` function after April 17 is the
  reference implementation for R1–R4. Any new platform scanner should mirror
  its cache→strict-match→sort-by-date→per-track-expand pattern.
- `api/_platform_cache.ts` — `RateBudget` + `fetchWith429Retry` are the
  reference for R5. Every outbound third-party call should use them.
- `api/cron-scan-weekly.ts` — inter-chain pacing (R6) and fire-and-forget
  dispatch (R7) are documented in comments at the dispatch site.

If you're writing code that doesn't match one of these patterns, stop and ask
why. The patterns exist because every deviation today cost us hours.
