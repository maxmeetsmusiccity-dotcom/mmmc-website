# CONTINUITY MEMO — NMF Curator Studio Sprint
## April 5, 2026 — For the next Claude Code session

---

## SITUATION

An intensive 6-hour session made 18 commits (3,637 lines added) to the NMF Curator Studio at `/Users/maxblachman/Projects/mmmc-website`. The code is correct, builds clean (131ms), passes 106 unit tests + 9 E2E tests. Git is pushed and Vercel shows deployment as "Ready, Production."

**HOWEVER: Max reports that many changes are not visible on the live site even in incognito mode.** Some changes from early in the session ARE visible (condensed cards, "+ Add Tracks" button, "NMF Curator Studio" branding, "Pick tracks" modal). But changes from the later commits (rubber-band select, Quick Look, header spacing fixes, Archive content, source selector replacing auth gate) are NOT visible.

---

## THE DEPLOYMENT MYSTERY

### What we know:
1. Git remote HEAD matches local HEAD: `14d5496`
2. Vercel deployment shows "Ready, Production" at `mmmc-website-gnylud52a`
3. The deployed JS file is `assets/index-DU_8WO8S.js` (673KB)
4. The local build produces `assets/index-BT6gN0sL.js` (483KB)
5. **The deployed bundle is 40% LARGER than the local build** — this is the red flag
6. String literal searches confirm SOME features exist in the deployed JS (those that survive minification as string literals), but the deployment may be running a different build configuration than local

### Possible root causes:
1. **Vercel build cache corruption** — `vercel --prod --force` was run, but the cache may still be stale. Try: `vercel deploy --prod --no-cache` or delete the `.vercel/output` directory
2. **Different node_modules on Vercel** — Vercel installs from package-lock.json; if there's a lockfile mismatch or different npm version, the build output differs
3. **Vercel building from a different source** — The project might be linked to a GitHub integration that builds from a webhook, separate from `git push`. Check Vercel Dashboard → Settings → Git to see if it's connected to the right repo/branch
4. **Build command mismatch** — Local uses `tsc -b && vite build`. Vercel might override this. Check Vercel Dashboard → Settings → Build & Development Settings
5. **The 673KB vs 483KB size difference** suggests Vercel's build is bundling differently — possibly including sourcemaps inline, or using a different Vite version from the lockfile

### RECOMMENDED INVESTIGATION FOR NEXT SESSION:
```bash
# 1. Check Vercel build settings
vercel project ls
vercel env ls

# 2. Force clean deploy from local
rm -rf dist node_modules/.vite
npm ci
npm run build
vercel deploy --prod

# 3. Compare deployed vs local JS for a specific feature
# Search for a unique string that MUST be in the latest code:
curl -s "https://maxmeetsmusiccity.com/assets/$(curl -s https://maxmeetsmusiccity.com/ | grep -o 'assets/index-[^"]*\.js')" | grep -c "Re-scan for latest"

# 4. Check Vercel build logs in the dashboard
# Go to: https://vercel.com/maxmeetsmusiccity-9406s-projects/mmmc-website/deployments
# Click the latest deployment → Build Logs → look for errors or warnings

# 5. Check if there's a GitHub App integration building separately
# Vercel Dashboard → Settings → Git → see if auto-deploy is from GitHub
```

---

## WHAT IS CONFIRMED WORKING (visible in Max's screenshot)

These changes from the EARLY commits in the session are live:
- "NMF Curator Studio" badge in nav header
- "+ Add Tracks" gold button in sticky toolbar  
- "Pick tracks (2)" modal buttons on multi-track albums
- Condensed card info (Artist · SINGLE on one line, "Spotify" link)
- Status bar at bottom (releases · tracks | selected · slides)
- Cache staleness banner ("Showing cached results... Re-scan for latest releases")
- Thumbnail slider (far right, but unlabeled)
- Font size increases (CSS custom properties)

## WHAT IS NOT WORKING (from Max's live testing)

These changes from LATER commits are NOT visible:
1. **Slider labels** — should show "Compact" and "Detail" labels flanking the slider. The slider itself moved into the toolbar but lost its labels.
2. **Archive button centering** — still misaligned
3. **Header smooshed when scrolling** — the sticky header + toolbar stack still appears cramped
4. **Auth gate still blocks** — "Jump In" goes to Connect Spotify / Try Demo instead of source selector with all 3 options
5. **No rubber-band drag select** — Shift+drag doesn't draw selection rectangle
6. **No Quick Look** — Space on hover doesn't preview
7. **Source selector not replacing auth gate** — the fundamental flow hasn't changed
8. **Archive page empty** — no past week data displayed

---

## ALL ITEMS MAX REQUESTED (master checklist)

### From the original audit addendum:
- [x] BUG-1: Layout balance (multiple iterations)
- [x] BUG-2: Preview/generation mismatch (drawGrid removed)
- [x] BUG-3: Slide split auto-update
- [x] BUG-4: Grid layout icon differentiation (star)
- [x] BUG-6: Template builder duplicates (stopped global mutation)
- [x] BUG-11: Cache staleness banner
- [x] F-1: Logo upload
- [x] 5xx retry: 8 retries with 1.2^n backoff

### From the comprehensive sweep:
- [x] 1A: Slide labels "Slide N of M (K tracks)"
- [x] 1B: Remove bottom badges
- [x] 1C: Shuffle buttons after last track
- [x] 1D: Font sizes +30% (CSS custom properties)
- [x] 1E: Vinyl classic default (useEffect + guard ref)
- [x] 2A+2B: Back nav on all pages
- [x] 2C: Sticky header
- [ ] 2D: Hover tooltips — PARTIAL (key buttons only, not all 80+)
- [ ] 2E: Archive button centering — NOT VERIFIED ON LIVE
- [x] 2F: Footer component
- [x] 2G: Rename "NMF Curator Studio"
- [x] 2H: /nmf redirect (301)
- [x] 3A: ResizablePanel + touch events
- [x] 4A: Per-template visual effects
- [x] 4B: Template builder expansion (35+ controls)
- [x] 4C: "Create Your Own" first in row
- [x] 4D: Template import from image
- [x] 4E: Grid layout picker in panel
- [x] 5: Portrait 3:4 optimization
- [x] 6A: Tests to 106 (was 60)
- [x] 6B: Playwright E2E (9/9)
- [x] 6D: Pre-push validation script
- [x] 6F: GitHub Actions CI

### From the gaps addendum:
- [x] GAP 1: Thumbnail slider (Lightroom-style)
- [x] GAP 2: Duplicate swipe text fixed
- [x] GAP 3: Song name in italic script with quotes
- [x] GAP 4: neonText screen-blend compositing
- [ ] GAP 5: Archive page content — CODE EXISTS but not verified on live
- [ ] GAP 6: mmmc.media domain — VERCEL DASHBOARD ACTION NEEDED
- [x] GAP 7: Embed preview + builder debouncing
- [x] GAP 8: Browse artists API crash fixed
- [x] GAP 9: ResizablePanel touch events

### From the final polish:
- [x] Item 1: Track picker modal (lightbox)
- [x] Item 2: Card info condensation
- [x] Item 3: Thumbnail slider in toolbar
- [ ] Item 4: Vinyl classic default — STILL NOT VERIFIED WORKING
- [x] Item 5: Default card size 240px
- [x] Item 6: Resizer default 35/65
- [x] Item 7: Preview positioning
- [x] Item 9: Remove duplicate "Title Slide Style" label
- [x] Item 10: Remove social media platform buttons
- [x] Item 11: Consolidate grid layout rows
- [x] Item 12: "Create New" first
- [x] Item 13: Edit pencil on templates
- [x] Item 14: 3:4 text positioning (fixed bottom offset)

### From the latest addendum:
- [ ] Source selector always available — CODE IN TOOLBAR but auth gate still blocks initial flow
- [x] Vinyl classic rendering matches reference image (tilted art, sparkles, notes, chevrons)
- [ ] Template importer drag-and-drop — CODE EXISTS, not verified
- [ ] Template importer grid auto-fit — CODE EXISTS, not verified
- [ ] Importer simplified to 3 steps — CODE EXISTS, not verified
- [x] Export section redesigned (Instagram first, others collapsible)
- [x] Instagram tags parse feat./ft./x/& separators
- [x] Embed widget preview + MMMC branding
- [ ] Archive button text centering — NOT FIXED
- [ ] Header breathing room — PARTIALLY FIXED (padding increased but still "smooshed")

### From the gap closure addendum:
- [ ] Rubber-band drag select — CODE EXISTS, not verified on live
- [ ] Quick Look spacebar preview — CODE EXISTS, not verified on live
- [x] Tests to 106+
- [x] Playwright E2E running (9/9)
- [x] Caption Generator component
- [ ] Writer credits teaser — NOT BUILT (needs ND API endpoint)
- [ ] Template A/B comparison UI — NOT BUILT

### Dropped/deferred items that MUST be built:
- [ ] Keyboard shortcut overlay (? / Cmd+/)
- [ ] Cmd+G generate, Cmd+D download shortcuts
- [ ] Arrow key navigation between album cards
- [ ] Number keys 1-9 for quick template selection
- [ ] Title slide template builder ("Create New" for title templates)
- [ ] QR code generation for playlists
- [ ] Auto-save to archive when carousel generates
- [ ] Visual regression screenshots (toHaveScreenshot)

---

## CRITICAL UX FLOW ISSUE

The BIGGEST structural problem: **the auth gate still controls the initial flow.** When a guest clicks "Jump In," they see the old "Connect Spotify / Try Demo" screen. The source selector (Spotify / Apple Music / Manual) IS in the 'ready' phase, but it's buried behind the auth gate's flow.

**What Max wants:** After "Jump In," the user should IMMEDIATELY see all three source options (Spotify scan, CSV import, Artist browser) without any intermediate screen. The "Connect Spotify" flow should be ONE of three equal options, not the default gate.

**Fix:** In the 'ready' phase of NewMusicFriday.tsx, the SourceSelector already renders. But the 'auth' phase shows a different screen with just "Connect Spotify" and "Try Demo." The fix: make the 'auth' phase use SourceSelector too, with Spotify as one option that triggers OAuth, CSV/Manual as options that don't need auth.

---

## FILES MOST RECENTLY MODIFIED

```
src/pages/NewMusicFriday.tsx          — main page (1500+ lines, most edits)
src/components/ClusterCard.tsx        — album cards
src/components/CarouselPreviewPanel.tsx — carousel config panel
src/components/TemplateSelector.tsx   — template selection
src/components/TitleTemplatePicker.tsx — title template selection
src/components/TemplateImporter.tsx   — image import wizard
src/components/CaptionGenerator.tsx   — NEW: Instagram caption
src/components/ResizablePanel.tsx     — draggable panel divider
src/components/SlideSplitter.tsx      — slide configuration
src/components/GridLayoutSelector.tsx — grid layout options
src/components/Footer.tsx             — NEW: page footer
src/lib/canvas-grid.ts               — canvas rendering (900+ lines)
src/lib/title-templates.ts           — title template definitions
src/lib/carousel-templates.ts        — grid template definitions
src/lib/spotify.ts                   — Spotify API + retry logic
api/browse-artists.ts                — browse API (Web Crypto fix)
```

---

## HOW TO VERIFY DEPLOYMENT IN NEXT SESSION

```bash
# Step 1: Verify git state
git log --oneline -3
git ls-remote origin HEAD

# Step 2: Clean build
rm -rf dist
npm run build

# Step 3: Check what Vercel is actually serving
curl -s https://maxmeetsmusiccity.com/ | grep -o 'assets/index-[^"]*\.js'
# Compare that filename with dist/assets/index-*.js

# Step 4: If different, force deploy from local
vercel deploy --prod

# Step 5: Verify specific features
curl -s "https://maxmeetsmusiccity.com/$(curl -s https://maxmeetsmusiccity.com/ | grep -o 'assets/index-[^"]*\.js')" | wc -c
# Should match: wc -c < dist/assets/index-*.js

# Step 6: If sizes differ, investigate Vercel build settings
# Dashboard → Settings → Build Command, Output Directory, Node version
```

---

## ND DATA BOUNDARY RULE (critical for all future features)

NMF is free. Nashville Decoder is $500/seat. NMF can USE ND data but must NOT expose ND intelligence:

**NMF CAN show:** Artist names, Instagram handles, genre tags, tier label (one word), new release detection
**NMF must NOT show:** Credit counts, chart history, co-writer networks, camp affiliations, career trajectories

Any ND-powered feature must show blurred/limited data with "Unlock on Nashville Decoder" CTA.
