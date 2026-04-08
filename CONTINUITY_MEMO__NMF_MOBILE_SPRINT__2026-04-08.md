# NMF Curator Studio — Continuity Memo
## April 8, 2026 — Mobile Sprint Handoff

## Session Summary (April 7-8)

### What Shipped (40+ commits)
- Mobile: collapsible header, bottom sheet toolbar, showcase dropdowns, Select All/Clear, NavBar
- Template editor: live preview, canvas overlay, layers, custom elements, undo/redo, font previews
- Data pipeline: Workers scan engine (8,379 showcase artists), dual-source Spotify+Apple Music
- Apple Music: library scan (catalog albums, limit=100), Sign in with Apple, session boundaries
- UI: multi-slide preview strip, drag reorder, 9:16 Story format, toasts, onboarding, keyboard help
- Security: R2 auth, session isolation, MusicKit deauth on sign-out
- Sort controls on Nashville releases and Artist Browser

### What's Broken / Needs Work

#### CRITICAL: Mobile Experience
Estevan's screenshots (IMG_8474.png, IMG_8475.png) show:
1. **Desktop toolbar showing on mobile** — the mobile-only/desktop-only wrappers only cover the toolbar rows. The Row 2 (exports, downloads, CSV/JSON/Art ZIP, aspect ratio, Generate) is NOT wrapped and shows on mobile.
2. **Track grid 3-column on phone** — cards are too small, text truncates badly
3. **Configure & Preview section** — ResizablePanel does stack on mobile but the left panel still shows ALL desktop controls (tracks per slide, grid layout, grid style template, title template, slide split)
4. **Bottom status bar** — text wraps and is unreadable on mobile
5. **Instructional text** — "Shift-click to select a range" doesn't apply on mobile (no shift key)

#### Mobile Redesign Plan
The entire results phase needs a mobile-first redesign:

**Track Selection (mobile)**
- Single-column card layout (not 3-column grid)
- Larger cards with full album art, artist name, track name
- Tap to select (no shift-click), star icon for cover feature
- Sticky bottom bar: selection count + Generate button
- Filters/sort in a collapsible section or bottom sheet

**Configure & Preview (mobile)**
- Full-width stacked: preview on top, controls below
- Carousel shape: horizontal pill selector
- Template pickers: horizontal scrollable rows (already exist, just need full width)
- Generated slides: horizontal swipeable gallery
- Download: prominent full-width button

**What Should NOT Be on Mobile**
- CSV/JSON/Art ZIP exports (desktop power-user feature)
- Card size slider
- Keyboard shortcuts
- Template editor (already gated to desktop)
- Import template from image

### Infrastructure State

#### Workers Scan Engine
- **Deployed**: `nd-api.nd-api.workers.dev`
- **Cron**: 8 staggered triggers Thursday 11:05 PM - 2:35 AM CT
- **Artists**: 8,379 showcase artists from R2 browse_artists.json
- **Dual-source**: Spotify (client credentials) + Apple Music (catalog search)
- **Incremental**: KV tracking prevents re-scanning same week
- **Spotify rate limit**: Hit after ~6,750 artists. Need the staggered approach for Thursday.
- **Apple catalog limit**: Fixed to 100 albums per artist (was 20, missing releases)
- **Supabase**: 333 tracks for week of 2026-04-03 (will grow after Thursday scan)

#### Apple Music Integration
- **Sign in with Apple**: Working (Supabase OAuth, Services ID com.maxmeetsmusiccity.nmf.web)
- **MusicKit library scan**: Working (catalog albums, not library albums)
- **Developer token**: Key P4CJV5BNMH (MusicKit), Key AG62D3UT64 (Sign in with Apple)
- **OAuth secret**: JWT expires October 2026, signed with AG62D3UT64
- **Pre-authorization**: MusicKit auto-authorizes on page load for Apple users
- **Future releases filtered**: releases > today go to comingSoon callback (not yet surfaced in UI)

#### Supabase
- **Anon key**: sb_publishable_aFWE7qj-_aZDyDmOuGPcnQ_yood08R0
- **URL**: https://kpwklxrcysokuyjhuhun.supabase.co
- **Site URL**: https://maxmeetsmusiccity.com/newmusicfriday
- **Apple provider**: enabled, client_id=com.maxmeetsmusiccity.nmf.web
- **Google provider**: enabled

### Files Modified This Session
Key files with significant changes (most important first):
- `src/pages/NewMusicFriday.tsx` — Apple Music source, sort, mobile toolbar, auth
- `src/components/CarouselPreviewPanel.tsx` — preview strip, inline editing, story export
- `src/components/UnifiedTemplateBuilder.tsx` — canvas overlay, layers, custom elements, undo
- `src/lib/sources/apple-music.ts` — catalog albums, future filter, auth check
- `src/lib/auth-context.tsx` — Apple sign-in, session clear, PKCE handling
- `src/components/AuthGate.tsx` — Apple button, auto-enter on auth
- `src/components/NashvilleReleases.tsx` — sort controls, terminology
- `src/components/ArtistBrowser.tsx` — sort controls, weekly data only
- `workers/src/routes/nmf-scan.js` — dual-source, staggered, incremental
- `workers/src/index.js` — cron handler, scheduled export
- `api/browse-artists.ts` — R2 auth via Workers proxy
- `api/apple-token.ts` — public endpoint, correct key ID
