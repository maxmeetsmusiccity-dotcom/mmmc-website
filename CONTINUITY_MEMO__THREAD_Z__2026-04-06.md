# CONTINUITY MEMO — Thread Z (NMF Curator Studio)
## Full Project History + Handoff
## April 6, 2026

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
| Frontend | Vite + React 19 + TypeScript (SPA) |
| Hosting | Vercel (git-triggered deploys from GitHub) |
| Database | Supabase PostgreSQL (RLS enabled) |
| Storage | Supabase Storage ("carousels" bucket) |
| Auth | Google OAuth via Supabase + guest mode + admin bypass |
| Rendering | HTML5 Canvas 2D (client-side image generation) |
| APIs | 6 Vercel serverless functions (TypeScript) |
| Data | Nashville Decoder Cloudflare Workers API (137K+ entities) |
| Data | R2 browse_artists.json (3,299 Nashville artists, 21 categories) |
| Repo | ~/Projects/mmmc-website → github.com/maxmeetsmusiccity-dotcom/mmmc-website |
| Domain | maxmeetsmusiccity.com |

## Key Files

### Main Page
`src/pages/NewMusicFriday.tsx` (~1600 lines) — All main state. Phase state machine: 'ready' | 'scanning' | 'results'. The dead 'auth' phase was removed (commit 33742f8).

### Canvas Rendering
`src/lib/canvas-grid.ts` (~950 lines) — Image cache (200-item LRU), neon text with screen blend, noise overlay, vignette, grid renderers, title slide renderer. `neonText()` was fixed to extract px size via regex (not parseInt which grabbed font weight). Portrait mode uses purpose-built 900px grid.

### Template Systems
`src/lib/carousel-templates.ts` — 10 grid templates. Max-only filtering via `MAX_ONLY_TEMPLATES` Set.
`src/lib/title-templates.ts` — 13 title templates (was 14, duplicate polaroid_stack removed). 5 Max-only: nashville_neon, vinyl_classic, gold_frame, spotlight, polaroid_stack.

### Components (30+)
```
src/components/
├── AuthGate.tsx             ← Auth flow (Google + guest + email). Shows landing on every new session.
├── ArtistBrowser.tsx        ← ND-powered artist browser with categories
├── CaptionGenerator.tsx     ← Instagram caption with handles/hashtags, curly-quoted song names
├── CarouselPreviewPanel.tsx ← Carousel config, forwardRef + useImperativeHandle for generate/downloadAll
├── ClusterCard.tsx          ← Album release cards with "Credits → ND" link
├── EmbedWidget.tsx          ← Embed code + live iframe preview
├── ErrorBoundary.tsx        ← Crash recovery
├── FilterBar.tsx            ← Albums/Tracks/Archive toggle
├── Footer.tsx               ← "NMF Curator Studio — A Max Meets Music City Tool"
├── GridLayoutSelector.tsx   ← Grid layout options
├── ManualImport.tsx         ← CSV import + artist name paste. Accepts scanEndpoint prop for Apple Music.
├── NashvilleReleases.tsx    ← Nashville source with selectable/expandable tracks, Supabase cache
├── ProductNav.tsx           ← Logo (48px) + "Curator Studio" bold badge
├── ResizablePanel.tsx       ← Draggable panel divider
├── SlideGroup.tsx           ← Slide rendering
├── SlideSplitter.tsx        ← Slide configuration
├── SourceSelector.tsx       ← 4-card source chooser. Spotify grayed out for non-admin.
├── TagBlocks.tsx            ← Instagram handle resolution with unified ARTIST_SPLIT regex
├── TemplateImporter.tsx     ← Image upload → grid overlay → color sample → save
├── TemplateSelector.tsx     ← Grid template picker with arrow key nav
├── TitleTemplatePicker.tsx  ← Title template picker with arrow key nav, scroll constraint
├── TrackCountSelector.tsx   ← Tracks-per-slide selector
├── UnifiedTemplateBuilder.tsx ← 50/50 split builder with live preview (replaces 3 old builders)
└── WeekHistory.tsx          ← Archive display
```

### API Routes (6 Vercel serverless)
```
api/
├── apple-token.ts           ← Apple Music JWT generation (Developer Token)
├── browse-artists.ts        ← R2-backed artist browser. Handles array + nested category formats.
├── cron-scan-weekly.ts      ← Weekly Nashville scan. 200 artists per chunk. Reads from R2 + seed list.
├── discover-instagram.ts    ← Pattern-based IG handle guess
├── nd-proxy.ts              ← Authenticated proxy to ND API (HMAC daily token)
├── scan-artists.ts          ← Spotify catalog search (Client Credentials, no user login)
└── search-apple.ts          ← Apple Music catalog search (Developer Token JWT)
```

### Tests
```
tests/unit/ — 14 suites, 126 tests (all passing)
├── canvas-dimensions, csv-edge, csv-import, grid-advanced, grid-layouts
├── neon-font-parse, platforms, scan-logic, selection, selection-edge
├── source-types, tag-splitting, templates, title-defaults
```

## State Architecture
- Phase: 'ready' | 'scanning' | 'results' (no more 'auth')
- Header + toolbar: position:fixed, ref-measured heights, z-index 40/35
- Carousel state lifted to NewMusicFriday: carouselAspect, allPreviews, generating
- CarouselPreviewPanel: forwardRef + useImperativeHandle exposes generate()/downloadAll()
- Template rows: overflow:hidden + minWidth:0 on parent prevents panel expansion
- Export toggle: [All Tracks | Selects] state controls which dataset buttons export
- Custom templates: user-scoped localStorage keys + Supabase (column names: template_name, config)

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
| Max admin emails | maxmeetsmusiccity@gmail.com, maxblachman@gmail.com |
| Vercel env vars | Use printf (NOT echo) to set — echo adds trailing newline that breaks auth |

---

# PART 2: FULL BUILD HISTORY (72+ hours, 65+ commits)

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

## April 5-6 (Thread Z — this thread): 65+ commits

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
- Weekly cron (Friday 11:01 PM CT): scans 3,311 artists in 200-per-chunk batches
- 266 tracks cached for week of April 3
- Nashville releases: selectable + expandable by album (checkboxes, multi-track expand)
- Nashville pre-selected as default source

### Phase 5: Browse Artists
- R2 browse_artists.json: 3,299 artists, 21 showcase/genre categories
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
- Header: MMMC logo (48px), "Curator Studio" bold badge, "New Music Friday" text
- Row 2: export toggle [All Tracks | Selects], Generate button, ZIP download, slide count, Undo, Shortcuts
- Spotify grayed out for non-admin with "COMING SOON" centered sash
- Dead auth phase deleted (60 lines removed, "Connect Spotify" screen gone forever)
- AuthGate: always shows landing page on new session
- Nashville releases: all shown (removed 100-item cap)
- Mobile CSS: compact header, 44px touch targets, full-width modals
- ZIP export via JSZip (dynamic import)
- Keyboard shortcuts overlay (? key)
- "Data last refreshed" replaces "Showing cached results"

---

# PART 3: WHAT STILL NEEDS TO BE DONE

## IMMEDIATE (from Max's last message)

### 1. Showcase scan — BROKEN
Clicking "Whiskey Jam" in the artist browser should:
- Fetch all 250 Whiskey Jam artists from R2 browse_artists.json
- Scan them via /api/scan-artists (Spotify catalog)
- Show results with selectable tracks
Currently returns "Failed to load artists" and shows grammar error "1 artists"

### 2. "+ Add Tracks" dropdown UX
- Add X close button at top right
- Make the dropdown larger, centered, more user-friendly
- Move "New Scan" button from header right side to next to "+ Add Tracks"

### 3. Logo size
- Increase from 48px to ~67px (40% larger)

### 4. Grammar
- "1 artist" not "1 artists" (pluralization throughout)

### 5. Showcase integration on source selector
- Nashville source should let users pick a showcase before scanning
- System scans just those artists and shows results

## PLANNED (from strategy memo)

### 6. Dual-source scanning
- Scan Spotify AND Apple Music in parallel
- Deduplicate by ISRC (best) or artist_name + track_name (fallback)
- Merge results with cross-platform IDs

### 7. ND data ingestion pipeline
- Weekly scan results → R2 export → ND cascade step
- Upsert into dim_releases, dim_spotify_enrichment
- Create dim_apple_enrichment table
- Feed intelligence pipeline

### 8. Apple Music user library scan
- MusicKit JS authorization (no user limit, unlike Spotify's 5-user dev mode)
- Scan followed artists for new releases
- Currently the Apple Music source card just shows the paste-names interface

### 9. Full Canva-like visual editor
- Visual drag-and-drop exists for repositioning elements
- Full free-form canvas editing (draw shapes, add text layers) is a larger feature

### 10. Supabase email auth
- Rate limit: "for security purposes" error on first attempt
- Supabase dashboard → Auth → Rate Limits: lower cooldown or configure SMTP

### 11. Playwright visual regression (E11)
- Need baselined screenshots in CI

---

# PART 4: CROSS-THREAD COORDINATION

## Thread Z (this thread): mmmc-website frontend
- SOLE writer to mmmc-website
- All NMF frontend work

## Thread C: ND repo
- feature/nmf-api-endpoints branch (needs wrangler deploy)
- /api/profile/{pg_id}/instagram endpoint (currently 404)

## Thread A: browse_artists.py
- Generates browse_artists.json with showcase categories
- Published to R2 (latest: 2026-04-06T18:17:59, 3,299 artists)
- Need: categories field on top-level artist objects (currently empty [])

## Thread D: Cascade master
- Runs SpotScraper credits
- Generates and uploads R2 files
- Need: ND ingestion step for weekly_nashville_releases

---

# PART 5: GOVERNANCE RULES

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
