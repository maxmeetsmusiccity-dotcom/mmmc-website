# CONTINUITY MEMO — Thread Z (NMF Curator Studio)
## April 6, 2026

## CURRENT STATE
- 65+ commits this sprint (April 5-6)
- 126 tests, all passing
- Latest commit: bae2161 (constrain template rows)

## IMMEDIATE FIXES NEEDED (from Max's last message)

### 1. "+ Add Tracks" dropdown UX
- Add X close button at top right of the dropdown
- Make the dropdown larger, centered, more user-friendly
- Move "New Scan" button from header right side to next to "+ Add Tracks"

### 2. Logo size
- Increase from 48px to ~67px (40% larger) in header

### 3. Browse Artists / Showcase scan — BROKEN
- Clicking "Whiskey Jam" in the artist browser should scan ALL Whiskey Jam artists for new releases
- Currently returns "Failed to load artists" and "no new releases found from 1 artists"
- The showcase categories from R2 have 250 artists each — those need to be scanned via /api/scan-artists
- Grammar fix: "1 artist" not "1 artists" (pluralization)

### 4. Showcase integration on source selector page
- When user selects Nashville source, they should be able to pick a showcase (Whiskey Jam, Suffragettes, etc.)
- System scans just those artists and shows results
- This should also work from the Browse Artists page

## ARCHITECTURE REFERENCE

### Key files
- `src/pages/NewMusicFriday.tsx` — main page (~1600 lines)
- `src/components/CarouselPreviewPanel.tsx` — carousel builder with forwardRef
- `src/components/NashvilleReleases.tsx` — Nashville source with selectable/expandable tracks
- `src/components/SourceSelector.tsx` — 4-card source chooser (Nashville, Spotify, Apple, Artist List)
- `src/components/TitleTemplatePicker.tsx` — title template horizontal row
- `src/components/TemplateSelector.tsx` — grid template horizontal row
- `src/components/UnifiedTemplateBuilder.tsx` — 50/50 split builder with live preview
- `src/components/ArtistBrowser.tsx` — ND-powered artist browser
- `src/pages/Artists.tsx` — full Browse Artists page with showcase categories
- `src/lib/sources/nashville.ts` — Nashville scan with 150+ seed artists
- `api/scan-artists.ts` — Spotify catalog search (server-side, Client Credentials)
- `api/search-apple.ts` — Apple Music catalog search
- `api/browse-artists.ts` — R2-backed browse with 3,299 artists, 21 categories
- `api/cron-scan-weekly.ts` — Weekly cron, 200 artists per chunk

### State architecture
- Header + toolbar: position:fixed, ref-measured heights
- Carousel state lifted: carouselAspect, allPreviews, generating in NewMusicFriday
- CarouselPreviewPanel exposes generate/downloadAll via useImperativeHandle
- Template rows constrained with overflow:hidden + minWidth:0

### Credentials
- Spotify Client ID: 43c4155bfae44185bf1de3c9aacae466
- Spotify Client Secret: 6616d49ede3642cbba2d5c8ff672d9ec (in Vercel env, use printf not echo)
- Supabase: kpwklxrcysokuyjhuhun
- R2 browse_artists.json: 3,299 artists, 21 showcase/genre categories
- Supabase tables: weekly_nashville_releases (266 cached tracks), scan_metadata

### Admin emails
- maxmeetsmusiccity@gmail.com
- maxblachman@gmail.com
- Spotify grayed out for all other users with "COMING SOON" sash

## WHAT WAS COMPLETED THIS SPRINT

### Infrastructure
- Weekly cron scan (Friday 11:01 PM CT) of 3,311 Nashville artists
- Supabase cache for instant Nashville release loading
- Apple Music catalog search endpoint
- 15 showcase badge images
- Dynamic showcase/genre category grouping from R2

### Features
- Visual drag-and-drop title slide editor
- UnifiedTemplateBuilder (50/50 split, live preview, replaces 3 old builders)
- 3 new Max-only title templates (Gold Frame, Spotlight, Polaroid Stack)
- Header redesign: logo, Curator Studio badge, Generate in toolbar, export toggle
- Nashville releases: selectable + expandable by album
- ZIP export via JSZip
- Keyboard shortcuts overlay
- Template A/B comparison
- Arrow key navigation between templates

### Bug fixes
- Canvas drawImage crash (parseInt font weight vs size)
- Double date on vinyl classic
- Instagram tags cross-contamination (unified ARTIST_SPLIT)
- Custom template data isolation (user-scoped localStorage)
- Supabase 406 (wrong column names)
- Dead auth phase removed (no more "Connect Spotify" screen)
- All .split() crashes guarded
- Spotify env vars (trailing newline from echo)
- Portrait text positioning (purpose-built 900px grid)

## REMAINING WORK
1. Fix showcase scan (Whiskey Jam → scan all 250 artists → show results)
2. Add X close button to + Add Tracks dropdown
3. Move New Scan button next to + Add Tracks
4. Logo 40% larger
5. Grammar: "1 artist" not "1 artists"
6. Dual-source scanning (Spotify + Apple Music, deduplicate by ISRC)
7. ND data ingestion pipeline (weekly releases → R2 → ND cascade)
8. Apple Music user library scan (MusicKit JS authorization)
9. Mobile bottom bar for key actions
10. Supabase email auth rate limit (dashboard setting)
11. E11: Playwright visual regression baselines
