# NMF Curator Studio — Technical Documentation
## Version 2.0 | April 9, 2026

---

## 1. Product Overview

NMF Curator Studio is a web-based tool for creating weekly New Music Friday Instagram carousels. It enables music curators to scan new releases from Nashville artists, select tracks, customize carousel templates, generate downloadable slide images, and share with pre-formatted captions and Instagram handle tags.

**URL**: https://maxmeetsmusiccity.com/newmusicfriday

**Stack**: Vite + React 19 + TypeScript (NOT Next.js), Vercel hosting, Supabase auth/DB, Cloudflare Workers (ND API), Konva.js canvas editor.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (SPA)                             │
│  Vite + React 19 + TypeScript                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ NewMusicFriday│  │ NashvilleRel │  │ CarouselPreviewPanel   │ │
│  │ (main page)  │  │ (source)     │  │ (configure + generate) │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
│         │                 │                       │              │
│  ┌──────┴─────────────────┴───────────────────────┴──────────┐  │
│  │ Hooks: useSelectionManager, useCarouselState              │  │
│  │ Libs: spotify.ts, canvas-grid.ts, selection.ts, nd.ts     │  │
│  │       enrichment.ts, supabase.ts, auth-context.tsx        │  │
│  └───────────────────────────┬───────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────────┘
                               │ fetch()
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    VERCEL SERVERLESS API                          │
│  /api/scan-artists     (Spotify catalog search, auth+rate-limit) │
│  /api/search-apple     (Apple Music catalog, auth+rate-limit)    │
│  /api/browse-artists   (ND artist universe, rate-limited)        │
│  /api/apple-token      (MusicKit JWT, origin-checked)            │
│  /api/save-handle      (Instagram handle writes, service_role)   │
│  /api/nd-proxy         (HMAC proxy to ND Workers)                │
│  /api/cron-scan-weekly (Thursday scan, Bearer auth)              │
│  /api/discover-instagram (Pattern-based handle guessing)         │
│  /api/_rateLimit       (Upstash Redis sliding window)            │
└──────────────────────┬───────────────────┬───────────────────────┘
                       │                   │
          ┌────────────┴──┐    ┌───────────┴─────────┐
          │   SUPABASE    │    │  ND WORKERS (Hono)   │
          │               │    │                      │
          │ Auth (Google, │    │ /api/profile/:id     │
          │  Apple OAuth) │    │ /api/search          │
          │ weekly_nash.. │    │ /api/research/enrich │
          │ nmf_features  │    │ /api/research/results│
          │ nmf_weeks     │    │ /api/r2?key=         │
          │ instagram_h.. │    │                      │
          │ user_profiles │    │ R2 bucket: profiles, │
          │ custom_templ..│    │  intelligence, data   │
          └───────────────┘    └──────────────────────┘
                                         │
                               ┌─────────┴──────────┐
                               │  RESEARCH AGENT     │
                               │  (Anthropic hosted)  │
                               │                      │
                               │  Apify Google Search  │
                               │  Apify IG Profiles    │
                               │  Claude Sonnet        │
                               │  → Proposals to R2    │
                               └──────────────────────┘
```

---

## 3. Routes

| Route | Page | Auth | Description |
|-------|------|------|-------------|
| `/` | Home | No | Landing page |
| `/newmusicfriday` | NewMusicFriday | AuthGate | Main curator studio |
| `/newmusicfriday/archive` | Archive | No | Past weeks + search |
| `/newmusicfriday/submit` | Submit | Auth required | Track submission form |
| `/newmusicfriday/thisweek` | ThisWeek | No | Aggregated curator picks |
| `/newmusicfriday/embed` | Embed | No | Embeddable carousel player |
| `/dashboard` | Dashboard | AuthGate | Curator dashboard + admin |
| `/curator/:username` | CuratorProfile | No | Public curator profiles |
| `/artists` | Artists | No | Artist directory |
| `/terms` | Terms | No | Terms of service |
| `/privacy` | Privacy | No | Privacy policy |

---

## 4. Components (32 total)

### Core Flow
| Component | Lines | Purpose |
|-----------|-------|---------|
| **NewMusicFriday** | ~2,000 | God component: source selection → scanning → track picking → carousel generation |
| **NashvilleReleases** | ~650 | Artist-grouped weekly releases with search, sort, grid/list toggle, showcase filter, Coming Soon |
| **CarouselPreviewPanel** | ~780 | Two-column configure (shape, templates, grid layout, logo) + preview strip |
| **MobileResultsView** | ~470 | Complete mobile experience: 2-col grid, track picker, configure bottom sheet, swipeable slides |
| **UnifiedTemplateBuilder** | ~1,600 | Full-screen template editor (grid + title modes), Konva canvas, font/color/layout controls |

### Selection & Display
| Component | Purpose |
|-----------|---------|
| ClusterCard | Individual release card (album art, artist, track count, selection state) |
| FilterBar | All/Singles/Albums filter + sort controls |
| TrackSuggestions | Recommends unselected artists after 3+ picks |
| SourceSelector | Nashville/Spotify/Apple Music/Manual source cards |
| ManualImport | Paste artist names or upload CSV |
| SlideSplitter | Drag to reorder tracks across slides |
| SlideGroup | Individual slide within the splitter |
| GridLayoutSelector | Pick grid arrangement (2×2, 2×3, 3×3, 4×4, etc.) |
| TrackCountSelector | Tracks-per-slide picker |
| ResizablePanel | Draggable divider between two panels |

### Template System
| Component | Purpose |
|-----------|---------|
| TemplateSelector | Grid template picker with rendered previews (real album art when tracks selected) |
| TitleTemplatePicker | Title slide template picker with canvas previews |
| TemplateImporter | Import template from image URL |
| KonvaEditor | Konva.js interactive canvas: drag/resize/rotate at 60fps |

### Sharing & Export
| Component | Purpose |
|-----------|---------|
| TagBlocks | Instagram handle resolution, confidence badges, AI Verify, manual edit, copy tag blocks |
| CaptionGenerator | Standard/Casual/Minimal caption styles, character count, share buttons |
| PlaylistCreate | Push to Spotify playlist (admin-gated) |
| EmbedWidget | Shareable embed code generator |

### Infrastructure
| Component | Purpose |
|-----------|---------|
| AuthGate | Auth boundary: Google/Apple sign-in, guest mode |
| ErrorBoundary | Catches React crashes, hides raw errors, reload button |
| ProductNav | Site-wide navigation |
| NavBar | Page header |
| Footer | Page footer |
| Toast / ToastContainer | Notification toasts |
| KeyboardHelp | Keyboard shortcuts overlay |
| Onboarding | First-use walkthrough |
| WeekHistory | Past weeks sidebar with restore |
| PlatformTabs | Cross-platform export options |

---

## 5. Libraries (19 files)

| Library | Purpose |
|---------|---------|
| **spotify.ts** (~550 lines) | Spotify Web API: PKCE auth, artist scanning, release fetching, playlist management, rate limiting |
| **canvas-grid.ts** (~1,200 lines) | Canvas rendering engine: generateGridSlide, generateTitleSlide, all visual compositing |
| **carousel-templates.ts** | 13 grid templates (MMMC Classic, Vinyl, Neon, etc.) + custom template registry |
| **title-templates.ts** | 13 title slide templates + default selection by user |
| **selection.ts** | SelectionSlot model, buildSlots, getSlideGroup, grid positions |
| **editor-elements.ts** | EditorElement model, template↔element conversion, custom elements |
| **auth-context.tsx** | React context: Supabase auth (Google/Apple/email), roles, tiers, guest mode |
| **auth.ts** | Spotify PKCE OAuth: verifier/challenge, token exchange, refresh |
| **supabase.ts** | Supabase client + CRUD: weeks, features, handles, templates, storage |
| **nd.ts** | Nashville Decoder integration: handle resolution, search, profile fetch |
| **enrichment.ts** | Research Agent integration: queue new artists, fetch results, check status |
| **apple-music.ts** | MusicKit JS v3: library scan, catalog lookup, rate limiting |
| **downloads.ts** | JSON/CSV export, album art ZIP download |
| **grid-layouts.ts** | Grid layout definitions and auto-selection |
| **cross-platform.ts** | Platform-specific image generation (Twitter, TikTok, Facebook) |
| **platforms.ts** | Platform dimension definitions |
| **scan-utils.ts** | Shared scan utilities |
| **utils.ts** | General utilities |
| **sources/types.ts** | MusicSource interface: Nashville, Spotify, Apple Music, Manual |
| **sources/manual.ts** | CSV manifest parser |
| **sources/nashville.ts** | Nashville seed artist list, release-to-track conversion |

---

## 6. Custom Hooks

| Hook | Purpose |
|------|---------|
| **useSelectionManager** | Track selection state: selections, selectionsByAlbum, handleSelectRelease, handleDeselect, handleSetCoverFeature, undo history, haptic feedback |
| **useCarouselState** | Carousel config state: aspect ratio, previews, generating flag, tracksPerSlide, card size, ref |

---

## 7. API Endpoints (9 total)

| Endpoint | Method | Auth | Rate Limit | Purpose |
|----------|--------|------|------------|---------|
| `/api/scan-artists` | POST | SCAN_SECRET or Supabase JWT | 5/min (strict) | Scan Spotify catalog for new releases |
| `/api/search-apple` | POST | SCAN_SECRET or Supabase JWT | 5/min (strict) | Scan Apple Music catalog |
| `/api/browse-artists` | GET | None | 30/min (relaxed) | Nashville artist universe (8K+ artists) |
| `/api/apple-token` | GET | Origin check | 20/min (moderate) | Generate MusicKit developer JWT |
| `/api/save-handle` | POST | Supabase JWT | 30/min (relaxed) | Write Instagram handle (service_role) |
| `/api/nd-proxy` | GET/POST | None (proxies with HMAC) | None | HMAC-authenticated proxy to ND Workers |
| `/api/cron-scan-weekly` | GET | Bearer CRON_SECRET | N/A | Thursday night automated scan |
| `/api/discover-instagram` | POST | None | None | Pattern-based handle guessing |
| `/api/_rateLimit` | N/A | N/A | N/A | Upstash Redis rate limit utility |

---

## 8. Data Model

### Supabase Tables

| Table | PK | Purpose |
|-------|-----|---------|
| `user_profiles` | id (UUID) | User role, tier, display name, avatar |
| `nmf_weeks` | week_date | Weekly curation state (selections, handles, status) |
| `nmf_features` | week_date + track_spotify_id | Individual featured tracks per week |
| `instagram_handles` | spotify_artist_id | Handle cache with confidence labels |
| `custom_templates` | id (auto) | User-created carousel templates |
| `nmf_submissions` | id (auto) | Track submission form entries |
| `weekly_nashville_releases` | composite | Cached scan results per week |
| `nmf_artist_cache` | composite | Artist metadata cache |

### RLS Policies (Tightened April 9, 2026)

| Table | Read | Write |
|-------|------|-------|
| `instagram_handles` | Public | service_role only |
| `nmf_artist_cache` | Public | service_role only |
| `weekly_nashville_releases` | Public | service_role only |
| `nmf_submissions` | Own submissions or service_role | Authenticated users |
| All others | Standard Supabase RLS | Standard |

---

## 9. Template System

### Grid Templates (13)
Each defines: background, text colors, accent, fonts (script + body), neon glow, grid layout (gap, rotation, cell styling), decorations (notes, sparkles, vinyl, chevrons), grain/vignette intensity, custom elements.

### Title Templates (13)
Each defines: background/gradient, headline/subtitle/date fonts and positions (X + Y), featured image position/size/rotation/border, glow, frame, divider, swipe pill.

### Custom Templates
Users can create, edit, import (from JSON or image), and delete custom templates. Stored in Supabase `custom_templates` table, scoped by user ID.

### Canvas Rendering
- `generateGridSlide()` — composites album art grid with template styling
- `generateTitleSlide()` — composites title slide with featured album art
- Both support 1:1 (Square), 3:4 (Portrait), 9:16 (Story) aspect ratios
- Custom elements (text, images, shapes) rendered via `drawCustomElements()`
- Export as PNG blob via `canvas.toBlob()`

### Konva Editor
- Background: full rendered template preview as Konva.Image (non-interactive)
- Interactive elements visible only when selected (prevents double-rendering)
- Shared Transformer: resize handles + rotation
- Click to select, click background to deselect
- State syncs on dragEnd/transformEnd

---

## 10. Enrichment Pipeline

### Architecture (Per Thread C Directive)

NMF provides the **UI layer**. The Research Agent (Thread B, Anthropic platform) provides the **AI layer**. The Cascade (Thread A) provides the **durability layer**.

### Flow
1. User clicks "AI Verify" in TagBlocks → POST to `/api/nd-proxy` → `/api/research/enrich`
2. Research Agent queues task in R2 (`agent_inbox/research_tasks.json`)
3. Research Agent runs: Apify Google Search → Apify Instagram Profile → Claude Sonnet synthesis
4. Results written to R2 (`agent_inbox/research_results.json`)
5. User clicks "Pull AI Results" → fetches from `/api/research/results`
6. Categorical confidence badge displayed in TagBlocks

### Friday Automation
When Nashville scan imports tracks, `queueNewArtistsForEnrichment()` checks Supabase cache and queues unconfirmed artists via `/api/research/batch`.

### Confidence Labels (Categorical, NOT Numeric)

| Label | Color | Meaning |
|-------|-------|---------|
| confirmed | Green | Handle exists + bio matches + corroborating source |
| likely | Green | Handle exists + bio plausible, one source |
| unverified | Gold | Single source, not validated |
| contested | Red | Multiple candidates or conflicting data |
| rejected | Gray | Doesn't exist or wrong person |
| queued | Blue | Submitted to Research Agent, awaiting results |
| manual | Gold | User-entered, persisted to Supabase |

### Ground Truth
3,792 handles loaded from ND's `staged_ig_handle_updates.json` (1,525 with pg_ids, bios, followers) and `handle_map.json` (2,267 from venue pipeline). Verification script ready (`scripts/verify-ground-truth.ts`) — validates via Apify Instagram Profile Scraper.

---

## 11. Security

### Authentication
- **Supabase Auth**: Google OAuth, Apple OAuth (Sign in with Apple), email/password
- **Spotify**: PKCE OAuth (no client secret in browser)
- **API endpoints**: SCAN_SECRET (Bearer token) or Supabase JWT
- **Cron**: CRON_SECRET (Bearer token)
- **ND proxy**: HMAC-SHA256 token (`api-access:timestamp`)
- **Apple token**: Origin header check

### Rate Limiting (Upstash Redis)
- Sliding window algorithm, persistent across serverless instances
- Strict (5/60s): scan-artists, search-apple
- Moderate (20/60s): apple-token
- Relaxed (30/60s): browse-artists, save-handle
- Falls back to permissive without Redis (dev/test)

### Headers (vercel.json)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- CORS: `Access-Control-Allow-Origin: https://maxmeetsmusiccity.com`

### Input Validation
- CuratorProfile: sequential `.eq()` queries (no PostgREST interpolation)
- `daysBack` clamped to 1-30
- ND proxy: URL-decoded path traversal check + prefix whitelist
- Error responses: generic messages (no stack traces)
- Embed interval: clamped 1000-30000ms

---

## 12. Testing

**264 tests across 20 files** (Vitest)

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| auth.test.ts | 20 | PKCE verifier/challenge, token expiry, storage |
| selection.test.ts | 20 | buildSlots, cover feature, edge cases |
| selection-edge.test.ts | — | GRID_POSITIONS, boundary conditions |
| canvas-templates.test.ts | 55 | Template registry, visibility, required fields |
| title-defaults.test.ts | — | Default template selection |
| templates.test.ts | — | Additional template tests |
| rate-limit.test.ts | 6 | Async API, fallback behavior, getClientIp |
| api-validation.test.ts | 13 | getClientIp, isRateLimited |
| caption-styles.test.ts | 21 | Standard/casual/minimal, resolveHandles |
| components.test.ts | 13 | TrackSuggestions scoring, diversity boost |
| csv-import.test.ts | 8 | parseManifestCSV |
| csv-edge.test.ts | — | CSV edge cases |
| grid-layouts.test.ts | 8 | getGridsForCount, suggestBetterCounts |
| grid-advanced.test.ts | — | Advanced grid tests |
| scan-logic.test.ts | 12 | parseReleaseDate |
| source-types.test.ts | 5 | SOURCES, getSource |
| neon-font-parse.test.ts | — | Neon font rendering |
| platforms.test.ts | — | Platform definitions |
| canvas-dimensions.test.ts | — | Aspect ratio dimensions |
| tag-splitting.test.ts | — | Artist name splitting regex |

---

## 13. Bundle Analysis

| Chunk | Size | Gzip | Lazy? |
|-------|------|------|-------|
| index (main) | 400 KB | 113 KB | No |
| CarouselPreviewPanel | 400 KB | 117 KB | Yes |
| supabase | 188 KB | 49 KB | No (static import) |
| jszip | 96 KB | 28 KB | Yes (dynamic) |
| canvas-grid | 46 KB | 12 KB | Yes |
| NashvilleReleases | 24 KB | 7 KB | Yes |
| ErrorBoundary | 24 KB | 9 KB | Yes |
| MobileResultsView | 14 KB | 4 KB | Yes |
| **Total** | **~1.2 MB** | **~340 KB gzip** | |

---

## 14. Deployment

### Vercel Configuration (vercel.json)
- Cron: `/api/cron-scan-weekly` at `5 5 * * 5` (Friday 5:05 AM UTC / Thursday 11:05 PM CT)
- Redirects: `/nmf` → `/newmusicfriday`
- Rewrites: SPA catch-all to `/index.html`
- Cache: 0-max-age for HTML, 1-year immutable for `/assets/`

### CI/CD
- GitHub push to `main` → Vercel auto-deploy
- GitHub Actions: `ci.yml` runs `npm run build` + `npx vitest run`
- Pre-commit: TypeScript strict mode (`tsc -b`)

---

## 15. External Service Integrations

| Service | Integration Point | Auth Method | Data Flow |
|---------|-------------------|-------------|-----------|
| **Supabase** | Auth, DB, Storage | Anon key (client), Service role (server) | Bidirectional |
| **Spotify** | Web API | PKCE OAuth (client), Client Credentials (server) | Read + Write (playlists) |
| **Apple Music** | MusicKit JS v3 | Developer JWT (server-generated) | Read only |
| **Nashville Decoder** | Workers API | HMAC token via nd-proxy | Read + Write (proposals) |
| **Apify** | REST API | Bearer token | Research Agent collection |
| **Upstash Redis** | REST API | Token auth | Rate limiting state |
| **Google CSE** | REST API (pending) | API key | Artist research |
| **Anthropic** | Managed agent platform | Platform auth | Research Agent synthesis |

---

## 16. Key Design Decisions

1. **Vite + React, not Next.js** — SPA with Vercel serverless API routes. No SSR needed; carousel generation is client-side canvas work.

2. **Konva.js for template editor** — Replaced custom SVG overlay after multiple failed attempts. Provides 60fps drag/resize/rotate natively.

3. **Lazy loading** — CarouselPreviewPanel, NashvilleReleases, MobileResultsView loaded on demand. Reduced initial bundle from 586 KB to 418 KB.

4. **Categorical confidence labels** — No numeric scores until calibrated through 500+ human reviews. Labels: confirmed/likely/unverified/contested/rejected.

5. **Research Agent separation** — NMF provides UI only. Research Agent (Thread B) handles collection and synthesis. Cascade (Thread A) applies proposals. Three interfaces, one system.

6. **RLS tightening** — Instagram handles, artist cache, and weekly releases restricted to service_role writes. Client reads via anon key; writes via `/api/save-handle` server endpoint.

7. **Upstash over in-memory** — Persistent rate limiting shared across serverless instances. Free tier covers 10K commands/day.

8. **Auto-save to localStorage** — Draft saved every 30s, resume banner on page reload. Not Supabase (to avoid write costs for every selection change).

9. **Handle enrichment is identity resolution evidence** — Every handle discovery checks for merge/split signals. Results are proposals, not direct writes.

10. **MusicBrainz excluded** — Per Max's directive, MusicBrainz handles are unreliable. Only approved sources: Max's ground truth, Apify, Claude synthesis, Spotify social links.
