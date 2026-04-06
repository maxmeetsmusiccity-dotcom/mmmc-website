# CONTINUITY MEMO — NMF Curator Studio
## Full Project History + Handoff
## April 6, 2026 (Session 2 — Post-Handoff)

---

# PART 0: WHAT THIS PROJECT IS

NMF Curator Studio (maxmeetsmusiccity.com/newmusicfriday) automates Max Blachman's weekly New Music Friday Instagram carousel posts. Max runs @maxmeetsmusiccity (18K+ followers), a Nashville music content brand. Every Friday, Max curates 30+ new Nashville releases into a 4-5 slide Instagram carousel. The old process took 2-3 hours in Canva. This tool does it in 15 minutes.

## The Business

Two-product business feeding Nashville Decoder ($500/seat, $10K/mo enterprise):

**Product 1 — Curator Tool (free forever):** For curators, bloggers, tastemakers. Scan releases, build carousels, tag handles, push playlists. Acquisition hook.

**Product 2 — Publicist Intelligence ($99-499/mo):** For publicists tracking curator coverage. Revenue engine.

Both feed Nashville Decoder (ND), Max's Bloomberg-terminal-style songwriter intelligence platform with 137K+ entities, 7.7M credit edges, and an 18GB SQLite database.

## The ND Data Boundary

NMF is free. Nashville Decoder is $500/seat. NMF can USE ND data as plumbing but must NEVER expose ND intelligence that replaces buying ND. NMF CAN show: artist names, Instagram handles, genre tags, tier label, new release detection. NMF must NOT show: credit counts, chart history, co-writer networks, camp affiliations, career trajectories, detailed tier evidence.

---

# PART 1: TECHNICAL ARCHITECTURE

## Stack
| Layer | Technology |
|-------|------------|
| Frontend | Vite + React 19 + TypeScript (SPA) — NOT Next.js |
| Hosting | Vercel (git-triggered deploys from GitHub) |
| Database | Supabase PostgreSQL (RLS enabled) |
| Storage | Supabase Storage ("carousels" bucket) |
| Auth | Google OAuth via Supabase + guest mode + admin bypass |
| Rendering | HTML5 Canvas 2D (client-side image generation) |
| APIs | 7 Vercel serverless functions (TypeScript) |
| Data | Nashville Decoder Cloudflare Workers API (137K+ entities) |
| Data | R2 browse_artists.json (3,299 Nashville artists, 13 visible categories) |
| Repo | ~/Projects/mmmc-website → github.com/maxmeetsmusiccity-dotcom/mmmc-website |
| Domain | maxmeetsmusiccity.com |

**CRITICAL**: This is a Vite SPA, NOT Next.js. No "use client" directives, no async searchParams, no App Router. Ignore any Next.js-specific linter suggestions.

## Key Files (with line counts)

### Main Page
`src/pages/NewMusicFriday.tsx` (~1655 lines) — All main state. Phase state machine: 'ready' | 'scanning' | 'results'. The dead 'auth' phase was removed (commit 33742f8).

### Canvas Rendering
`src/lib/canvas-grid.ts` (~1149 lines) — Image cache (200-item LRU), neon text with screen blend, noise overlay, vignette, grid renderers, title slide renderer. `neonText()` was fixed to extract px size via regex (not parseInt which grabbed font weight). Portrait mode uses purpose-built 900px grid.

### Template Systems
`src/lib/carousel-templates.ts` — 10 grid templates. Max-only filtering via `MAX_ONLY_TEMPLATES` Set.
`src/lib/title-templates.ts` — 13 title templates (was 14, duplicate polaroid_stack removed). 5 Max-only: nashville_neon, vinyl_classic, gold_frame, spotlight, polaroid_stack.

### Components (27 .tsx files)
```
src/components/
├── ArtistBrowser.tsx        ← ND-powered artist browser with categories (showcases + marquee + camp_leaders only)
├── AuthGate.tsx             ← Auth flow (Google + guest + email). Shows landing on every new session.
├── CaptionGenerator.tsx     ← Instagram caption with handles/hashtags, curly-quoted song names
├── CarouselPreview.tsx      ← Single slide preview
├── CarouselPreviewPanel.tsx ← Carousel config, forwardRef + useImperativeHandle for generate/downloadAll
├── ClusterCard.tsx          ← Album release cards with "Credits → ND" link
├── EmbedWidget.tsx          ← Embed code + live iframe preview
├── ErrorBoundary.tsx        ← Crash recovery
├── FilterBar.tsx            ← Albums/Tracks/Archive toggle
├── Footer.tsx               ← "NMF Curator Studio — A Max Meets Music City Tool"
├── GridLayoutSelector.tsx   ← Grid layout options
├── ManualImport.tsx         ← CSV import + artist name paste. Accepts scanEndpoint prop for Apple Music.
├── NashvilleReleases.tsx    ← Nashville source with showcase filter pills, selectable/expandable tracks, Supabase cache
├── PlatformTabs.tsx         ← Platform selection tabs
├── PlaylistCreate.tsx       ← Spotify playlist creation
├── ProductNav.tsx           ← Logo (67px) + "Curator Studio" bold badge + BETA badge
├── ResizablePanel.tsx       ← Draggable panel divider
├── SlideGroup.tsx           ← Slide rendering
├── SlideSplitter.tsx        ← Slide configuration
├── SourceSelector.tsx       ← 4-card source chooser. Spotify + Apple Music grayed out with COMING SOON for non-admin.
├── TagBlocks.tsx            ← Instagram handle resolution with unified ARTIST_SPLIT regex
├── TemplateImporter.tsx     ← Image upload → grid overlay → color sample → save
├── TemplateSelector.tsx     ← Grid template picker with arrow key nav
├── TitleTemplatePicker.tsx  ← Title template picker with arrow key nav, scroll constraint
├── TrackCountSelector.tsx   ← Tracks-per-slide selector
├── UnifiedTemplateBuilder.tsx ← 50/50 split builder with live preview (replaces 3 old builders)
└── WeekHistory.tsx          ← Archive display
```

### Pages (11 .tsx files)
```
src/pages/
├── Archive.tsx              ← Past weeks
├── Artists.tsx              ← A-Z artist directory page
├── CuratorProfile.tsx       ← Curator profile page
├── Dashboard.tsx            ← Dashboard
├── Embed.tsx                ← Embeddable widget page
├── Home.tsx                 ← Landing/marketing page
├── NewMusicFriday.tsx       ← MAIN TOOL — 1655 lines
├── Privacy.tsx              ← Privacy policy
├── Submit.tsx               ← Submission page
├── Terms.tsx                ← Terms of service
└── ThisWeek.tsx             ← This week's releases view
```

### API Routes (7 Vercel serverless)
```
api/
├── apple-token.ts           ← Apple Music JWT generation (Developer Token)
├── browse-artists.ts        ← R2-backed artist browser. Filters to showcases + marquee + camp_leaders. No artist cap for showcases.
├── cron-scan-weekly.ts      ← Weekly Nashville scan. 200 artists per chunk. Reads from R2 + seed list. Runs Thursday 11:05 PM CT.
├── discover-instagram.ts    ← Pattern-based IG handle guess
├── nd-proxy.ts              ← Authenticated proxy to ND API (HMAC daily token)
├── scan-artists.ts          ← Spotify catalog search (Client Credentials, no user login). Max 200 artists per request.
└── search-apple.ts          ← Apple Music catalog search (Developer Token JWT)
```

### Lib Files (17 .ts files)
```
src/lib/
├── apple-music.ts           ← Apple Music API client
├── auth.ts                  ← Spotify PKCE OAuth
├── auth-context.tsx         ← React auth context (Google + guest + admin bypass)
├── canvas-grid.ts           ← Canvas rendering engine (1149 lines)
├── carousel-templates.ts    ← 10 grid templates
├── cross-platform.ts        ← Cross-platform utilities
├── downloads.ts             ← JSON/CSV/art export
├── grid-layouts.ts          ← Grid layout generator (exact, close, mosaic, logo variants)
├── nd.ts                    ← ND API client
├── platforms.ts             ← Platform detection
├── scan-utils.ts            ← Scan utilities
├── selection.ts             ← Selection slot management
├── sources/
│   ├── apple-music.ts       ← Apple Music source adapter
│   ├── manual.ts            ← Manual import source
│   ├── nashville.ts         ← Nashville source + seed artist list (82 artists)
│   ├── spotify.ts           ← Spotify source adapter
│   └── types.ts             ← MusicSource type + SOURCES array (4 sources)
├── spotify.ts               ← Spotify API client (scan, playlists, follows)
├── supabase.ts              ← Supabase client + helpers
├── title-templates.ts       ← 13 title slide templates
└── utils.ts                 ← Shared utilities
```

### Tests (14 unit + 1 E2E)
```
tests/
├── e2e/smoke.spec.ts
└── unit/
    ├── canvas-dimensions.test.ts
    ├── csv-edge.test.ts
    ├── csv-import.test.ts
    ├── grid-advanced.test.ts
    ├── grid-layouts.test.ts
    ├── neon-font-parse.test.ts
    ├── platforms.test.ts
    ├── scan-logic.test.ts
    ├── selection-edge.test.ts
    ├── selection.test.ts
    ├── source-types.test.ts
    ├── tag-splitting.test.ts
    ├── templates.test.ts
    └── title-defaults.test.ts
```

All 14 unit suites, 126 tests passing. Build succeeds.

## State Architecture
- Phase: 'ready' | 'scanning' | 'results' (no more 'auth')
- Header + toolbar: position:fixed, ref-measured heights, z-index 40/35
- Carousel state lifted to NewMusicFriday: carouselAspect, allPreviews, generating
- CarouselPreviewPanel: forwardRef + useImperativeHandle exposes generate()/downloadAll()
- Template rows: overflow:hidden + minWidth:0 on parent prevents panel expansion
- Export toggle: [All Tracks | Selects] state controls which dataset buttons export
- Custom templates: user-scoped localStorage keys + Supabase (column names: template_name, config)
- Add Tracks: `showAddTracks` state controls centered modal overlay (replaced old `<details>` dropdown)

## Source System
4 sources defined in `src/lib/sources/types.ts`:
| Source | ID | Auth Required | Status |
|--------|----|---------------|--------|
| Nashville | `nashville` | No | **Active** — default source. Showcase filter pills. Supabase cache. |
| Spotify | `spotify` | Yes (PKCE OAuth) | **Admin-only** — COMING SOON sash for non-admin |
| Apple Music | `apple-music` | Yes (MusicKit) | **Admin-only** — COMING SOON sash for non-admin |
| Artist List | `manual` | No | **Active** — CSV import + paste names + browse |

## Cron Schedule
- `5 5 * * 5` = Friday 5:05 AM UTC = Thursday 11:05 PM CST / Friday 12:05 AM CDT
- New Music Friday drops at 11:00 PM CT (midnight ET) on Thursday nights
- Cron runs 5 minutes after drop to catch all releases
- Scans 200 artists per invocation, chains via `?start=N` query param
- Stores results in Supabase `weekly_nashville_releases` table
- **Known issue**: Vercel cron only triggers once — only first 200 of 3,299 artists scanned automatically. Remaining require manual chaining or a self-triggering mechanism.

## Credentials
| Service | Detail |
|---------|--------|
| Spotify Client ID | 43c4155bfae44185bf1de3c9aacae466 |
| Spotify Client Secret | 6616d49ede3642cbba2d5c8ff672d9ec |
| Supabase Project | kpwklxrcysokuyjhuhun |
| Supabase URL | https://kpwklxrcysokuyjhuhun.supabase.co |
| ND API Base | https://nd-api.nd-api.workers.dev |
| ND AUTH_TOKEN_SECRET | B7jVe3DgEzofyWtDhex+ychwO8hc3QoaGJfb+elx3kk= |
| Apple Music Team ID | G46PBQ4ZQL |
| Apple Music Key ID | XP4Q9YVKQU |
| R2 Public Base | https://pub-639573660a1e48d2b2075b4563f00cd3.r2.dev |
| Max admin emails | maxmeetsmusiccity@gmail.com, maxblachman@gmail.com |
| Vercel env vars | Use printf (NOT echo) to set — echo adds trailing newline that breaks auth |

---

# PART 2: FULL BUILD HISTORY (173 commits total, 90+ hours)

## April 3-4 (Sessions 1-3): From nothing to deployed product
- Full auth (Google OAuth, guest, admin bypass)
- Spotify PKCE OAuth with sequential scan
- Release clustering, multi-track selection, cover feature starring
- 10 grid templates + 10 title templates
- Canvas 2D rendering pipeline (neon text, vignette, grain)
- CSV import, Apple Music adapter (disabled)
- Supabase: tables + RLS + Storage + Google OAuth
- Mobile responsive basics, OG meta tags, error boundary

## April 5 (Sessions 4-7, dead thread): Massive feature sweep
- CSS custom property font system
- Template builder (35+ controls), template import from image
- ResizablePanel, keyboard shortcuts, undo stack
- Source selector (4-card: Spotify/Apple/Manual/Browse)
- Browse Artists API (HMAC auth, Web Crypto)
- 106 unit tests, 9 Playwright E2E

## April 5 (Thread C): Overlapping push to main
- browse-artists.ts rewritten to R2 fetch
- Vinyl classic localStorage default fix
- Artist directory A-Z page
- Nashville releases source (NashvilleReleases.tsx)

## April 5-6 (Thread Z — previous session): 65+ commits

### Phase 1: Diagnosis + Critical Fixes
- Canvas drawImage crash: parseInt(font) grabbed weight not size → regex fix
- Auth gate: phase starts 'ready', guests see SourceSelector immediately
- Rubber-band drag: stale closure fixed via rubberBandRef
- Double date on vinyl: wrapped common date code in if(!tt.vinylRecord)
- Instagram tags: unified ARTIST_SPLIT regex, Refresh Handles button
- Caption: wired handles from TagBlocks, curly-quoted song names

### Phase 2: Header Redesign (12+ attempts at sticky)
- Went through sticky → fixed → ref-measured → single container
- Final solution: position:fixed on header (z-index 40) and toolbar (z-index 35)
- Dynamic top offset via headerRef.current.offsetHeight
- Spacer divs: headerHeight for header, toolbarHeight for toolbar

### Phase 3: Template System
- 3 new title templates: Gold Frame, Spotlight, Polaroid Stack
- UnifiedTemplateBuilder.tsx (1,140 lines): replaces TemplateBuilder + TitleTemplateBuilder + TitleSlideEditor
- 50/50 horizontal split with live canvas preview (300ms debounce)
- Deleted 3 old builder files
- Arrow key navigation between templates
- Template rows constrained with overflow:hidden + minWidth:0

### Phase 4: Nashville Source
- 150+ seed artist list for Spotify catalog scan
- Nashville progress bar (batched scan with progress feedback)
- Supabase weekly_nashville_releases table (migration run)
- Weekly cron: scans 3,299+ artists in 200-per-chunk batches
- 266 tracks cached for week of April 3
- Nashville releases: selectable + expandable by album (checkboxes, multi-track expand)
- Nashville pre-selected as default source

### Phase 5: Browse Artists
- R2 browse_artists.json: 3,299 artists, 21 categories (13 now visible after pruning)
- Dynamic category grouping by type (showcase vs genre)
- 15 badge images (Whiskey Jam, Suffragettes, Bluebird, Opry, Rebel Rouser, PinDrop, NTS, etc.)
- Spotify catalog search fallback when R2 empty
- Import to Curator Studio from Artists page

### Phase 6: API + Credentials
- Spotify credentials: fixed trailing newline in Vercel env vars (use printf not echo)
- Apple Music catalog search endpoint (search-apple.ts)
- Supabase 406 fix: code used wrong column names (template_data→config, template_id→template_name)
- All .split() crashes guarded across entire codebase

### Phase 7: UX Polish
- Header: MMMC logo (67px), "Curator Studio" bold badge, "New Music Friday" text
- Row 2: export toggle [All Tracks | Selects], Generate button, ZIP download, slide count, Undo, Shortcuts
- Spotify + Apple Music grayed out for non-admin with "COMING SOON" centered sash
- Dead auth phase deleted (60 lines removed, "Connect Spotify" screen gone forever)
- AuthGate: always shows landing page on new session
- Nashville releases: all shown (removed 100-item cap)
- Mobile CSS: compact header, 44px touch targets, full-width modals
- ZIP export via JSZip (dynamic import)
- Keyboard shortcuts overlay (? key)
- "Data last refreshed" replaces "Showing cached results"

## April 6 (This Session — Session 2 post-handoff): 3 commits

### Commit 65f8c0e: Showcase scan + UX sweep
- **browse-artists.ts crash fix**: `catMeta` was undefined on line 169, crashing every category request. Replaced with proper fields from `catObj`.
- **Showcase filter on Nashville tab**: NashvilleReleases.tsx now fetches showcase categories from `/api/browse-artists` on mount, displays filter pills (Whiskey Jam, Song Suffragettes, Bluebird, etc.), and cross-references releases with showcase artist lists client-side for instant filtering.
- **No artist cap for showcases**: Removed the `.slice(0, 100)` that was truncating category results.
- **Add Tracks UX overhaul**: Replaced tiny `<details>` dropdown with a centered 480px modal overlay. X close button, click-outside-to-close backdrop, proper header.
- **"New Scan" moved**: From header right side to toolbar, next to "+ Add Tracks".
- **Logo size**: 48px → 67px.
- **Grammar/pluralization**: Fixed across ArtistBrowser, ManualImport, CaptionGenerator, NashvilleReleases. All "N artists/tracks/releases" strings handle singular.
- **Apple Music COMING SOON**: Same grayed-out + sash treatment as Spotify for non-admin users in SourceSelector.
- **Cron schedule**: Changed from `1 5 * * 6` (Friday night) to `5 5 * * 5` (Thursday 11:05 PM CT) to align with NMF drop timing.
- **R2 gap strategy memo**: Documented that R2 caps showcases at 250 artists each while ND has 3,400+ for Whiskey Jam.

### Commit fdfcd61: Category pruning + BETA badge
- **Removed 8 generic categories**: nashville_live, hot_right_now, breaking_through, hit_makers, producer_spotlight, rising_stars, multi_platinum, fresh_faces. These were generic tier/genre filters that didn't provide real ND intelligence.
- **Kept 13 categories**: 11 showcases + marquee (ND marquee 500) + camp_leaders (ND songwriter camps).
- **BETA badge**: Added to ProductNav, right of Curator Studio button.
- **Fallback categories updated** to match the new whitelist.

### Commit cd6a7dd: BETA badge height fix
- Matched BETA badge height to Curator Studio button (same padding: 5px, borderRadius: 6).

---

# PART 3: CURRENT STATE — WHAT'S DEPLOYED

As of commit cd6a7dd (pushed to main, deploying on Vercel):

### Working Features
1. **Nashville source** (default): Loads cached releases from Supabase, with showcase filter pills
2. **Showcase filtering**: Click "Whiskey Jam" → see only releases from WJ artists (client-side cross-reference)
3. **Artist List source**: Paste names or import CSV, scans Spotify catalog server-side
4. **Release browser**: Grouped by album, selectable tracks, expandable multi-track releases
5. **Carousel generation**: Canvas 2D rendering with 10 grid templates, 13 title templates
6. **Template builder**: UnifiedTemplateBuilder with 50/50 split live preview
7. **Instagram integration**: Caption generator with handles, hashtags, curly-quoted names
8. **Playlist creation**: Spotify playlist create/append (admin only)
9. **Export**: Individual PNGs, ZIP download, JSON, CSV
10. **Auth**: Google OAuth, guest mode, admin bypass
11. **Mobile responsive**: Compact header, touch targets, full-width modals
12. **BETA badge**: Visible in header

### Categories Visible in Browse
- 11 showcases: Whiskey Jam, Song Suffragettes, Bluebird Cafe, The Listening Room, Rowdy/Outside the Round, Rebel Rouser, PinDrop Writers Series, Nashville Tour Stop, Grand Ole Opry, Grindhouse, Buscall, Raised Rowdy
- 2 curated: Marquee Songwriters, Camp Leaders

### Source Cards
- Nashville: Active (default)
- Spotify: COMING SOON (admin-only)
- Apple Music: COMING SOON (admin-only)
- Artist List: Active

---

# PART 4: WHAT STILL NEEDS TO BE DONE

## KNOWN ISSUES

### 1. Cron only scans first 200 artists
The Vercel cron triggers once. `cron-scan-weekly.ts` processes 200 artists per invocation and returns a `next` URL, but nobody calls it. Only ~6% of the 3,299 R2 artists get scanned each week. **Fix options**: (a) Self-chain via fetch to own endpoint, (b) Multiple cron entries with staggered `?start=` params, (c) Use Vercel Queues for durable chaining.

### 2. R2 showcase cap at 250 artists
Documented in `STRATEGY_MEMO__R2_SHOWCASE_CAP_GAP.md`. Thread A's `build_browse_artists.py` caps each showcase at 250. Whiskey Jam has 3,400+ in ND. Fix is in Thread A — remove the LIMIT clause. NMF frontend is already ready for larger rosters (no cap on showcase category returns).

### 3. Showcase filter uses primary artist name matching
`NashvilleReleases.tsx` matches releases to showcases by splitting `artist_name` on commas/feat and comparing the primary name (lowercased) against the showcase artist set. This works for most cases but could miss artists with different name formatting between Spotify and R2.

## PLANNED FEATURES

### 4. Dual-source scanning
- Scan Spotify AND Apple Music in parallel
- Deduplicate by ISRC (best) or artist_name + track_name (fallback)
- Merge results with cross-platform IDs

### 5. ND data ingestion pipeline
- Weekly scan results → R2 export → ND cascade step
- Upsert into dim_releases, dim_spotify_enrichment
- Create dim_apple_enrichment table
- Feed intelligence pipeline

### 6. Apple Music user library scan
- MusicKit JS authorization (no user limit, unlike Spotify's 5-user dev mode)
- Scan followed artists for new releases
- Currently the Apple Music source card shows COMING SOON

### 7. Full Canva-like visual editor
- Visual drag-and-drop exists for repositioning elements
- Full free-form canvas editing (draw shapes, add text layers) is a larger feature

### 8. Supabase email auth
- Rate limit: "for security purposes" error on first attempt
- Supabase dashboard → Auth → Rate Limits: lower cooldown or configure SMTP

### 9. Playwright visual regression
- Need baselined screenshots in CI

### 10. Select All text size
- Select All / Clear buttons in NashvilleReleases bumped to `--fs-sm` with fontWeight 600 to match Import button size (done this session)

---

# PART 5: CROSS-THREAD COORDINATION

## This thread: mmmc-website frontend
- SOLE writer to mmmc-website repo
- All NMF frontend work
- Latest: cd6a7dd on main, pushed to production

## Thread A: browse_artists.py
- Generates browse_artists.json with showcase categories
- Published to R2 (latest: 2026-04-06, 3,299 artists, 21 categories in R2, 13 visible after API filtering)
- **ACTION NEEDED**: Remove 250-per-showcase cap. See `STRATEGY_MEMO__R2_SHOWCASE_CAP_GAP.md`.

## Thread C: ND repo
- feature/nmf-api-endpoints branch (needs wrangler deploy)
- /api/profile/{pg_id}/instagram endpoint (currently 404)

## Thread D: Cascade master
- Runs SpotScraper credits
- Generates and uploads R2 files
- Need: ND ingestion step for weekly_nashville_releases

---

# PART 6: R2 DATA FORMAT

`browse_artists.json` structure:
```json
{
  "generated_at": "2026-04-06T18:17:59Z",
  "category_count": 21,
  "artist_count": 3299,
  "artists": [
    {
      "pg_id": "pg_...",
      "name": "Artist Name",
      "tier": "marquee|rising|developing",
      "credits": 1515,
      "charting": 10,
      "no1": 3,
      "career_arc": "growing|emerging",
      "arc_momentum": 2.5,
      "spotify_id": "spotify_...",
      "instagram_handle": "@handle",
      "monthly_listeners": 50000,
      "cover_art_url": "https://..."
    }
  ],
  "categories": [
    {
      "id": "whiskey_jam",
      "name": "Whiskey Jam",
      "emoji": "🥃",
      "type": "showcase",
      "count": 250,
      "artists": [ /* same schema as above */ ]
    }
  ]
}
```

**Key fact**: 100% of showcase artists overlap with the top-level `artists` array. The cron scans the top-level list, so all showcase artists get scanned. The showcase filter is just a client-side cross-reference.

---

# PART 7: GOVERNANCE RULES

1. Read the codebase first. Read every file before proposing changes.
2. Commit after each logical section. Run tests + build after every commit.
3. Verify deployment after every push (curl deployed JS for key strings).
4. No screenshots from Max — they kill the thread (>20MB context).
5. When Max reports something is broken, BELIEVE HIM. Investigate. Don't dismiss.
6. Never defer without explicit approval.
7. Use printf (NOT echo) for Vercel env vars.
8. The words "later," "future session," and "if time permits" are banned.
9. Anti-gaslighting: if Max says it's broken, it's broken.
10. Max finds apologies performative — don't apologize, just fix it.
11. This is a Vite SPA. Ignore all Next.js-specific validation suggestions.
12. Pause and ask questions before barreling ahead on multi-step tasks.
13. For creative/visual work, take time to make it exceptional — quality over speed.
14. CWC is discovery research, not social networking; no "Connect" buttons or dating-app aesthetics.
15. Never scope-creep from UI thread into data pipeline work; each thread owns specific file types.

---

# PART 8: HOW TO RESUME

1. `cd ~/Projects/mmmc-website`
2. `git pull origin main` — should be at cd6a7dd or later
3. `npx vitest run` — should show 14 suites, 126 tests passing
4. `npx vite build` — should succeed
5. `npx vite dev` — local dev server at localhost:5173
6. Production: maxmeetsmusiccity.com/newmusicfriday

### Quick verification after deploy:
```bash
# Check showcase filter works (was crashing before this session)
curl -s 'https://maxmeetsmusiccity.com/api/browse-artists?category=whiskey_jam' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Whiskey Jam: {d[\"total\"]} artists')"

# Check categories are filtered (should be 13, not 21)
curl -s 'https://maxmeetsmusiccity.com/api/browse-artists' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"categories\"])} categories'); [print(f'  {c[\"id\"]}') for c in d['categories']]"
```
