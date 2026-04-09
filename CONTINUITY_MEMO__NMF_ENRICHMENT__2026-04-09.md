# Continuity Memo: NMF Enrichment Pipeline + Security Hardening
## April 9, 2026 — Thread C Checkpoint

---

## Session Summary

Massive session covering security hardening (33 audit items), mobile regression fixes, Konva editor integration, and the beginning of the AI-powered enrichment pipeline. ~50 commits across two days (April 8-9).

---

## Completed Today (April 9)

### Security Hardening (Batches 1-7 of 33-item audit)
- PostgREST injection fix in CuratorProfile
- Auth added to scan-artists + search-apple (SCAN_SECRET or Supabase JWT)
- Rate limiting on all API endpoints (api/_rateLimit.ts)
- CORS + security headers in vercel.json
- Admin check moved from hardcoded emails to user_profiles.user_role
- Service role key fail-closed in cron
- Error responses sanitized, auth logging gated behind DEV
- 5 dead files deleted (CanvasOverlay, ArtistBrowser, CarouselPreview, LayerPanel, pluralize)
- JSZip dual-load fixed, hardcoded values moved to env vars
- ErrorBoundary improved with componentDidCatch
- Playlist push gated behind isAdmin
- Console.logs gated behind import.meta.env.DEV
- RLS migration executed (instagram_handles, nmf_artist_cache, weekly_nashville_releases write-restricted to service_role)
- Admin roles set for both Max accounts
- All env vars configured in Vercel, production deployed

### Test Suite (Batch 9)
- 264 tests across 20 files (up from 126/14)
- Auth, selection, templates, rate limiter, caption styles, components

### NMF Decomposition (Batch 10)
- useSelectionManager hook extracted
- useCarouselState hook extracted

### Mobile Regression Fixes
- Mobile generate: hidden CarouselPreviewPanel renders so carouselRef connects
- Tile sizes: alignSelf: 'start' on grid children
- Showcase filter: error handling added (was swallowing failures silently)
- Instagram handle writes: new /api/save-handle endpoint (RLS broke direct writes)

### Enrichment Pipeline (Phase 1)
- 3,792 ground truth handles loaded into Supabase from ND's staged_ig_handle_updates.json + handle_map.json
- Apify account connected (Starter plan, $29/mo)
- Google CSE engine created (16 music industry sites) — key blocked by free trial, will resolve when account upgrades
- Fresh GCP project created (mmmc-research-agent) with billing linked
- Apify Google Search tested and working ($0.0035/query)
- Apify Instagram Profile Scraper tested and working
- Course correction: removed parallel api/enrich-artist.ts pipeline
- TagBlocks wired to Research Agent via ND proxy (/api/research/enrich)
- Categorical confidence badges (confirmed/likely/unverified/contested/rejected/queued)
- Manual handle edits persist to Supabase via /api/save-handle
- AI Verify button routes through ND proxy to Research Agent Workers

---

## Architecture (Per Thread C Directive)

```
NMF Studio (Thread C)           Research Agent (Thread B)         Cascade (Thread A)
      │                                │                                │
      │ POST /api/research/enrich ────>│                                │
      │ (AI Verify button)             │ Apify Google + IG + Claude     │
      │                                │                                │
      │ <── research results (R2) ─────│                                │
      │ (categorical label + evidence) │                                │
      │                                │── proposals to R2 inbox ──────>│
      │ Show badge in TagBlocks        │                                │ Apply next run
      │                                │                                │
      │ Max reviews proposals ────────>│                                │
      │ (approve/reject)               │── decision to R2 inbox ───────>│
```

---

## Remaining Items (4-6 from execution order)

### Item 4: Ground Truth Verification Pass — DONE
- Script: `scripts/verify-ground-truth.ts`
- Runs handles through Apify Instagram Profile Scraper
- Validates bio with 40+ music keywords
- Tags as confirmed/likely/unverified/rejected with evidence
- 5 concurrent, 2s between batches, skips already-confirmed
- **NOT YET RUN** — costs ~$11-38. Run with:
  `VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... APIFY_TOKEN=... npx tsx scripts/verify-ground-truth.ts`

### Item 5: Friday Scan Queue Integration — DONE
- `src/lib/enrichment.ts` — queueNewArtistsForEnrichment()
- Called after Nashville import in NewMusicFriday.tsx
- Checks cache, queues unconfirmed via ND proxy → /api/research/batch
- Fire-and-forget, non-blocking

### Item 6: Research Results Display — DONE
- "Pull AI Results" button in TagBlocks
- Fetches from /api/research/results via ND proxy
- Matches by pg_id or display_name, updates badges
- fetchResearchResults() + getResearchStatus() in enrichment.ts

---

## Credentials Status

| Service | Status | Env Var |
|---|---|---|
| Apify | ✅ Working (Starter $29/mo) | APIFY_TOKEN |
| Google CSE | ❌ Free trial blocking | GOOGLE_CSE_API_KEY (saved, not working) |
| Google CSE Engine ID | ✅ Created | GOOGLE_CSE_ENGINE_ID = f70c6d20c89154ac5 |
| Anthropic | ✅ Via Research Agent | On Anthropic platform |
| Supabase service_role | ✅ Working | SUPABASE_SERVICE_ROLE_KEY |
| SCAN_SECRET | ✅ Generated | SCAN_SECRET |
| CRON_SECRET | ✅ Generated | CRON_SECRET |

---

## Key Rules (From Thread C Directive)

1. Categorical confidence labels only — no numeric scores
2. No auto-approve until 500+ human reviews calibrate confidence
3. MusicBrainz is NOT a source
4. Research Agent (Thread B) does collection — NMF provides UI only
5. Every handle discovery checks for merge/split resolution evidence
6. Runs weekly on unconfirmed handles — confirmed handles are locked
7. No database artifacts as user-facing metrics

---

## Files Changed This Session

| File | Change |
|---|---|
| api/_rateLimit.ts | NEW: in-memory rate limiter |
| api/save-handle.ts | NEW: server-side handle writes (service_role) |
| api/enrich-artist.ts | CREATED then DELETED (course correction) |
| api/scan-artists.ts | Auth + rate limiting added |
| api/search-apple.ts | Auth + rate limiting added |
| api/apple-token.ts | Origin check + rate limiting |
| api/browse-artists.ts | Rate limiting added |
| api/cron-scan-weekly.ts | Fail-closed, pass SCAN_SECRET to internal calls |
| api/nd-proxy.ts | URL-decode path traversal check, /api/research/ allowed |
| api/discover-instagram.ts | Error response sanitized |
| src/components/TagBlocks.tsx | AI Verify button, confidence badges, manual edit persistence |
| src/components/ErrorBoundary.tsx | Improved: hide raw errors, add componentDidCatch |
| src/components/SourceSelector.tsx | Admin from useAuth, not hardcoded emails |
| src/components/MobileResultsView.tsx | Tile sizing fix (alignSelf) |
| src/components/CarouselPreviewPanel.tsx | Console.logs gated |
| src/components/UnifiedTemplateBuilder.tsx | ErrorBoundary around KonvaEditor |
| src/lib/auth-context.tsx | Admin from DB role, auth logs gated behind DEV |
| src/lib/nd.ts | HandleSource extended, cacheHandle routes through /api/save-handle |
| src/lib/supabase.ts | saveHandle routes through /api/save-handle |
| src/lib/auth.ts | Spotify Client ID from env var |
| src/lib/sources/nashville.ts | ND API URL from env var |
| src/lib/downloads.ts | JSZip CDN import removed |
| src/pages/NewMusicFriday.tsx | isAdmin, hidden CarouselPreviewPanel on mobile, hooks |
| src/pages/CuratorProfile.tsx | PostgREST injection fixed |
| src/pages/ThisWeek.tsx | select('*') → explicit columns, .catch() |
| src/pages/Dashboard.tsx | Promise.all loading fix |
| src/pages/Submit.tsx | Auth required |
| src/pages/Embed.tsx | Interval clamped |
| src/pages/Archive.tsx | .catch() added |
| src/hooks/useSelectionManager.ts | NEW: extracted from NMF |
| src/hooks/useCarouselState.ts | NEW: extracted from NMF |
| scripts/load-ground-truth-handles.ts | NEW: loads ND handles into Supabase |
| vercel.json | CORS + security headers |
| supabase-migration-rls-tighten.sql | NEW: RLS policies executed |
| tests/unit/ | 6 new test files, 264 total tests |
