# Daily scan cron — first-fire review (2026-04-19)

**Zeta W4 · Tier 1 · 2026-04-19 17:50 CT**

## TL;DR

**The daily cron has never fired.** But — not a bug. The code landed today *after* today's 09:00 UTC scheduled window. First fire = **2026-04-20 09:00 UTC** (~10:45h from now at time of writing).

No tuning is possible until we observe real telemetry tomorrow morning.

## Timeline

| Event | Time (UTC) | Source |
|---|---|---|
| Daily cron code authored (`af6f9e9`) | 2026-04-19 15:03 | `git show af6f9e9` |
| Today's scheduled cron window (`0 9 * * *`) | 2026-04-19 09:00 | `vercel.json` — **passed 6h before commit existed** |
| Merged to `main` (`dac61ef`, PR #9) | 2026-04-19 17:29 | `git log main` |
| Production deploy `dpl_3T9ojWSucJtrRdY2ZUkh6ABu3uVN` (kszt86g8k) | 2026-04-19 17:29 | `vercel inspect` |
| Next scheduled fire | **2026-04-20 09:00** | — |

## Deployment verification

- `vercel inspect` on `mmmc-website-kszt86g8k` confirms `target=production` and `status=Ready` at 2026-04-19 17:29 UTC.
- Aliases include `maxmeetsmusiccity.com`, so prod traffic hits this deploy.
- Endpoint probe `https://maxmeetsmusiccity.com/api/cron-scan-daily` returns **401 Unauthorized** (not 404) — the function is deployed and responding; my local `CRON_SECRET` in `.env.local` is out of sync with Vercel's env var, which is expected (Vercel stores the live secret and uses it to invoke its own crons).
- `api/scan-health` returns `{"spotify":{"ok":true,"status":200},"apple":{"ok":true,"status":200}}` — preflight will pass.

## Database confirmation

- `SELECT scanner, COUNT(*) FROM nmf_scan_intelligence GROUP BY scanner` → only `nmf_weekly_cron` (1 row, 2026-04-17). Zero `nmf_daily_cron` rows ever.
- `SELECT * FROM scan_runs ORDER BY run_date DESC LIMIT 1` → latest 2026-04-17, all with `target_week='2026-04-17'`. Daily cron writes its own `scan_runs` rows too (see `api/cron-scan-daily.ts:184-189`), so absence is evidence the cron has never invoked the insert path.

## Cron count note — watch

`vercel.json` defines **4 crons**: preflight, weekly, postflight, daily.

- Vercel **Hobby** plan allows 2 crons max (excess silently dropped).
- Vercel **Pro** plan allows 40.

If this project is on Hobby, the daily cron would be dropped despite being deployed. Weekly has fired successfully in the past, so at least one cron-slot is working; unclear whether the 3rd/4th get accepted. **No self-serve way to confirm plan via CLI.**

→ **Recommend Max confirm Pro plan is active** before relying on 2026-04-20 09:00 UTC first fire.

If Hobby, mitigation options:
1. Upgrade to Pro.
2. Collapse postflight into the tail of weekly, freeing a slot.
3. Move daily invocation to external scheduler (GitHub Actions `schedule: cron`, Upstash QStash, etc.).

## What the code will do when it fires tomorrow

Reviewed `api/cron-scan-daily.ts`:

- Preflight at chain 0: Apple 429 → abort + Slack alert + 503 response (line 103-108).
- Artist universe pull from R2 via `/api/r2?key=browse_artists.json`, falls back to 34 seed artists if ND API unreachable (line 140).
- `BATCH_SIZE=200`, `maxChains=5` default → up to 1,000 artists per run over 5 chained invocations.
- Apple-only (`daysBack=2`). No Spotify fallback (by policy — `feedback_no_spotscraper` adjacent: Spotify quota re-poisoning risk documented at lines 9-16).
- Degradation alert fires when `failRate > 5%` OR `artists>=10 AND tracks==0` (line 66, 70).
- `scan_runs` insert wrapped in `try/catch { /* ignore */ }` (line 189) — absent rows won't block the run, but also means we can't distinguish "cron didn't fire" from "cron fired but insert threw" purely from `scan_runs`. `nmf_scan_intelligence` is the ground-truth signal.
- Self-chains via `fetch()` with `ctrl.abort()` after 3s (line 283-286) — Vercel function returns, next chain runs independently.

## Monitoring plan for first fire

1. At **2026-04-20 09:00 UTC** (04:00 CT), Vercel's scheduler should invoke `/api/cron-scan-daily` with Vercel's internal `Authorization: Bearer ${CRON_SECRET}`.
2. Within 60-90s, expect:
   - `nmf_scan_intelligence` row with `scanner='nmf_daily_cron'`, `scan_week=<yesterday>`.
   - `scan_runs` row(s) with `total_chains=5`, `target_week=<yesterday>`.
   - `weekly_nashville_releases` upserts (if any tracks found in last 48h).
   - `#nd-alerts` Slack silence (no degradation alert unless real failure).
3. If no rows appear by 10:00 UTC tomorrow, file `from_zeta_to_strategy__daily_cron_still_silent__<HHMM>.md` + investigate (plan limit, env var missing, Slack alert should have fired from preflight abort, etc.).

## Tuning decisions deferred to real observation

- Chain count (`maxChains=5` default, hard-capped to 10 at line 93). Will observe duration_ms across chains and decide if too conservative / too aggressive.
- Batch size (`BATCH_SIZE=200`). Will observe Apple 429 rate.
- `daysBack=2` window. Fine for post-Friday catch-up; may want wider for Monday/Tuesday lag.
- Slack alert thresholds. 5% Apple fail rate is reasonable; zero-tracks gate at 10 artists may be too tight (seed artists don't all release weekly).

## Cross-thread signals

- Filing separate signal `from_zeta_to_strategy__daily_cron_first_fire_timing__1750.md` noting (a) first fire = tomorrow 09:00 UTC and (b) 4-cron count vs Vercel plan check needed.
- Alpha doesn't own this; no signal to Alpha.

— Zeta W4, 17:50 CT
