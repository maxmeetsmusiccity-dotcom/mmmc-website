# CONTINUITY MEMO -- NMF Curator Studio: Template Editor + Polish Sprint
## April 8, 2026 -- For the next Claude Code session

---

## 1. SESSION SUMMARY

This session executed all 10 items from the improvement plan (`agile-skipping-micali.md`) across 30 commits spanning 5+ hours (13:23 - 18:45 CDT). The work fell into three major arcs: (A) Nashville source redesign with artist-grouped views, search, grid/list toggle, and Coming Soon releases; (B) a comprehensive mobile experience with configure bottom sheet, sharing flow, and swipeable slide previews; (C) a full template editor overhaul that progressed from SVG-based CanvasOverlay through multiple rewrites to a Konva.js-based interactive editor with drag, resize, rotate, and undo/redo. The session also delivered caption generator improvements (3 style variants, sharing actions, character count), track suggestions AI, auto-save drafts to localStorage, lazy loading of 3 heavy components, font library expansion from 6 to 32 fonts, plural grammar fixes across the entire codebase, and the consolidation of Browse Artists out of the Manual source. Net change: +1,609 lines added, -517 removed across 25 files.

---

## 2. COMMITS (chronological, oldest first)

| Hash | Time | Description |
|------|------|-------------|
| `9d542dc` | 13:23 | Nashville: tap multi-track album expands track picker instead of selecting all |
| `0262e56` | 13:34 | Nashville: artist-grouped view + selection persistence bar |
| `d966771` | 14:05 | Title template picker: rendered previews matching grid picker (attempt 17) |
| `6465de0` | 14:13 | Fix title template scrollbar: remove invisible custom styling, match grid picker |
| `3ed0c8c` | 14:25 | Fix all plural grammar: "1 slides" -> "1 slide" across entire codebase |
| `6e2e9e1` | 14:59 | Fix editor: opaque background, back button, smaller preview images |
| `16ead93` | 15:13 | Portal editor, font rationalization, preview sizing |
| `7cfddcd` | 15:26 | Grid editor: real album art preview, remove unusable Layer panel |
| `1e30d97` | 15:38 | Fix: all template editor pen icons now show real album art, not placeholders |
| `29ccadf` | 15:59 | Consolidate: remove Browse Artists from Manual source |
| `be0c2fe` | 16:01 | Coming Soon: toggle to view future-dated releases from Nashville artists |
| `aa36bff` | 16:29 | NMF: 7 improvements -- mobile config, sharing, auto-save, captions, suggestions, lazy load |
| `66fa5bd` | 16:35 | Nashville: add search input and list/grid view toggle |
| `eb5026c` | 16:41 | Fix: grid view track picker overlay for albums/EPs in Nashville Releases |
| `24e19f4` | 16:44 | Nashville search: query full artist universe, show grayed-out "no new music" entries |
| `977332a` | 16:46 | Brighten grayed-out Nashville search results (0.4 -> 0.6 opacity) |
| `1115b99` | 16:53 | Fix template editor preview + expand fonts from 6 to 32 |
| `3512266` | 16:59 | Template editor: instant text drag + undo/redo buttons |
| `d280b05` | 17:01 | Fix: remove broken SVG text rendering that created white sail artifact |
| `0b1e6da` | 17:03 | Move Undo/Redo buttons from header to dimensions bar |
| `2333eac` | 17:04 | Fix: all template elements now draggable in both grid and title editors |
| `6de529a` | 17:05 | Combine thumbnail size controls: - [slider] + with double-click reset |
| `a25324e` | 17:42 | Template editor: faster preview, rotation handle, all elements editable |
| `ede3687` | 18:04 | Fix: title slide elements now actually move when dragged |
| `da6bc21` | 18:16 | Fix: click to select element without dragging, then access rotation handle |
| `1cbc52a` | 18:18 | Fix: click now properly selects element and shows rotation handle |
| `b3004ac` | 18:21 | Rewrite CanvasOverlay: fix selection, drag, resize, rotate |
| `6322935` | 18:32 | Full X-position support: elements now move freely in all directions |
| `a74b85b` | 18:40 | Replace SVG overlay with Konva editor for 60fps element manipulation |
| `8154c77` | 18:45 | Fix: Konva elements only visible when selected to prevent double rendering |

---

## 3. FEATURES COMPLETED (vs. the 10-item plan)

| # | Plan Item | Status | Notes |
|---|-----------|--------|-------|
| 1 | Fix template editor placeholders | DONE | `1e30d97` -- pen icons now pass `selectedTracks`, `weekDate`, `logoUrl`, `gridLayoutId` through to UnifiedTemplateBuilder |
| 2 | Consolidate Nashville + Artist List | DONE | `29ccadf` -- Browse Artists removed from ManualImport; Nashville is now the single source with artist grouping, search, and showcase filters |
| 3 | Coming Soon releases view | DONE | `be0c2fe` -- toggle between "This Week" and "Coming Soon" in Nashville header; splits on `release_date > today` |
| 4 | Mobile Configure & Preview | DONE | `aa36bff` -- bottom sheet with carousel shape selector, tracks-per-slide, swipeable slide preview with thumbnail strip |
| 5 | Post-generation sharing flow | DONE | `aa36bff` -- CaptionGenerator now has `showShare` prop; renders Open Instagram deep link, email share, native share API |
| 6 | Auto-save and resume | DONE | `aa36bff` -- localStorage draft with `DRAFT_KEY = 'nmf_draft'`, saves every 30s + on selection change, resume banner on load, discards stale weeks |
| 7 | Batch template preview with real art | PARTIAL | Grid template previews use `generateTemplatePreview()` with real tracks. Title template previews use custom canvas rendering in `TitleTemplatePicker.tsx`. Not all templates show live album art in the picker row. |
| 8 | Smart track recommendations | DONE | `aa36bff` -- new `TrackSuggestions.tsx` (87 lines) shows 5 suggested tracks prioritizing unrepresented artists, singles, and recent releases |
| 9 | Caption generator improvements | DONE | `aa36bff` -- 3 caption styles (standard/casual/minimal), character count with Instagram limit warning, edit mode, copy button with toast, sharing actions |
| 10 | Lazy load heavy components | DONE | `aa36bff` -- `React.lazy()` for CarouselPreviewPanel, NashvilleReleases, MobileResultsView in NewMusicFriday.tsx |

---

## 4. KNOWN ISSUES

### Konva Editor Visual Issues (HIGH PRIORITY)

The template editor went through 12+ commits of iteration. The final state uses Konva.js (`KonvaEditor.tsx`, 233 lines) but has unresolved visual problems:

1. **Double rendering / ghost elements**: The workaround at line 129 of `KonvaEditor.tsx` sets `opacity: isSelected ? 1 : 0` on Konva elements. This means unselected elements are invisible in the Konva layer -- the background canvas renders them instead. When an element is selected, BOTH the background canvas AND the Konva element are visible, creating a "doubled" or "offset" appearance if coordinates don't match exactly.

2. **Coordinate mapping mismatch**: The Konva editor uses `offsetX: w / 2` (line 123) to center elements horizontally, but the background canvas rendering in `canvas-grid.ts` uses `textAlign: 'center'` with x as the center point. These two coordinate systems can produce slightly different positions, making the selected element "jump" when clicked.

3. **Text editing uses `window.prompt()`**: Line 165 of `KonvaEditor.tsx` uses `prompt('Edit text:')` for text editing, which is a poor UX. Should be replaced with an inline text input or Konva's built-in text editing.

4. **No touch support tested on the Konva layer**: While Konva supports touch events and the code sets `onTap`, the interaction quality on mobile/tablet has not been verified.

5. **The old CanvasOverlay.tsx (270 lines) is still in the codebase** but no longer imported by UnifiedTemplateBuilder. It was replaced by KonvaEditor but not deleted.

### Nashville Releases

6. **Search debounce fires API call on every keystroke after 300ms**: The `searchTimer` in `NashvilleReleases.tsx` (line 85) clears and resets, but rapid typing still generates multiple API calls. Consider using `AbortController` to cancel in-flight requests.

7. **Grid view track picker overlay** (`NashvilleReleases.tsx` lines 618-664): The overlay uses `position: absolute; inset: 0` which works but can be visually jarring on smaller grid tiles. The overlay clips track names on narrow columns.

### Auto-save

8. **Draft saves to localStorage only, not Supabase**: Plan item #6 mentioned Supabase persistence, but the implementation uses `localStorage.setItem(DRAFT_KEY, ...)` only. Drafts are lost if the user switches browsers or clears storage.

### Caption Generator

9. **Handle resolution is passive**: `CaptionGenerator.tsx` line 21 receives handles via props from parent, but handle resolution depends on an external `resolveHandles` map that may be empty for Nashville source tracks (which don't go through the ND handle resolution pipeline).

---

## 5. ARCHITECTURE DECISIONS

### Why Konva.js for the template editor

The session progressed through three approaches for the interactive element editor:

1. **CSS-positioned divs over canvas** (original, pre-session): Elements were HTML divs absolutely positioned over a `<canvas>` preview. Problem: canvas re-renders on every change caused flicker, and z-ordering between HTML and canvas was unreliable.

2. **SVG overlay** (commits `3512266` through `b3004ac`): An SVG element overlaid the canvas. Text elements were SVG `<text>`, interactive handles were SVG `<rect>`. Problem: SVG text rendering differs from canvas text rendering (font metrics, wrapping, glow effects), creating a "white sail artifact" (`d280b05`). Drag performance was also poor because each mouse move triggered React re-renders of the SVG.

3. **Konva.js** (commits `a74b85b`, `8154c77`): Konva provides a React-friendly canvas rendering library with built-in drag, resize, rotate via `<Transformer>`. The Konva stage sits IN FRONT of the background canvas. Elements are rendered as Konva nodes for interaction, while the background canvas (rendered by `generateTemplatePreview` / `generateTitleSlide`) shows the non-interactive composite.

**The key tradeoff**: Because the background canvas already renders all elements (text, images, decorations), Konva elements are set to `opacity: 0` when unselected and `opacity: 1` when selected. This prevents "double rendering" but creates a visual pop when selecting an element. The proper fix is to exclude the selected element from the background canvas render, which requires passing `selectedElementId` down to the canvas rendering functions in `canvas-grid.ts`.

### How KonvaEditor integrates

```
UnifiedTemplateBuilder.tsx (1,620 lines)
  |
  |-- customElements: EditorElement[]  (state)
  |-- previewUrl: string  (background image from canvas render)
  |
  +-- KonvaEditor.tsx (233 lines)
        |-- backgroundSrc = previewUrl  (static background layer)
        |-- elements = editorElements  (merged template + custom elements)
        |-- onElementUpdate -> patches customElements state
        |-- onTextEdit -> patches customElements text props
        |
        |-- Layer 1: Static background (non-interactive)
        |-- Layer 2: Interactive elements + Transformer
```

### Lazy loading strategy

Three heavy components are lazy-loaded in `NewMusicFriday.tsx`:
- `CarouselPreviewPanel` -- only loaded when user has selections and opens the preview
- `NashvilleReleases` -- only loaded when Nashville source is active
- `MobileResultsView` -- only loaded on mobile viewport

This reduces the initial bundle. The `TrackSuggestions` and `CaptionGenerator` components are NOT lazy-loaded because they are small (87 and 185 lines respectively).

### Editor element model

`EditorElement` (defined in `src/lib/editor-elements.ts`, line 8) uses normalized coordinates:
- `x`, `y`: 0-1 fractions of canvas dimensions (x is horizontal center, y is top edge)
- `width`, `height`: 0-1 fractions of canvas dimensions
- `rotation`: degrees
- `props`: type-specific properties (text, font, color, etc.)

Template-to-element converters: `titleTemplateToElements()` and `gridTemplateToElements()` break a template definition into individual manipulable elements. `elementsToTitleTemplate()` reconverts back for saving.

Custom elements (user-added text, images, shapes) are created by factory functions: `createCustomText()`, `createCustomImage()`, `createCustomShape()`. These are rendered on the final canvas by `drawCustomElements()`.

---

## 6. FILES CHANGED

### New files created this session

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/KonvaEditor.tsx` | 233 | Konva.js-based interactive editor with drag/resize/rotate/select |
| `src/components/TrackSuggestions.tsx` | 87 | Suggests unrepresented artists for carousel diversity |
| `src/lib/pluralize.ts` | 4 | `p(count, singular, plural?)` utility for grammar-safe plurals |

### Heavily modified files

| File | Lines | Key changes |
|------|-------|-------------|
| `src/components/UnifiedTemplateBuilder.tsx` | 1,620 | Replaced CanvasOverlay with KonvaEditor; portal rendering; font picker expanded to 32 fonts (5 categories: sans/serif/display/script/mono); undo/redo stacks; custom element factories for text/image/shape; removed Layer panel; preview sizing logic |
| `src/components/NashvilleReleases.tsx` | 798 | +356 lines: search input with debounced API call to `/api/browse-artists`, list/grid view toggle, Coming Soon toggle, artist-grouped list view, grid tile track picker overlay, universe search results (grayed-out "no new music" entries), sort controls, selection persistence bar |
| `src/components/MobileResultsView.tsx` | 466 | +108 lines: configure bottom sheet (carousel shape, tracks-per-slide), swipeable slide preview, thumbnail strip, "Select All" / "Clear" buttons, search input, filter pills, sort controls |
| `src/components/CaptionGenerator.tsx` | 185 | +145/-: 3 caption styles (standard/casual/minimal), edit mode with textarea, character count with 2,200 limit warning, `showShare` prop with Instagram deep link, email mailto, Web Share API |
| `src/pages/NewMusicFriday.tsx` | 2,137 | +151 lines: auto-save draft to localStorage (30s interval + selection change), resume banner on load, `React.lazy()` for 3 components, `TrackSuggestions` integration, expanded demo data to 35 real Spotify tracks, `pushSelectionHistory` callback |
| `src/components/TitleTemplatePicker.tsx` | ~400 | +175 lines: canvas-rendered previews for each title template, pen icon now passes `coverFeature` + `weekDate` to UnifiedTemplateBuilder |
| `src/components/TemplateSelector.tsx` | ~200 | +42 lines: pen icon now passes `selectedTracks`, `weekDate`, `logoUrl`, `gridLayoutId` to UnifiedTemplateBuilder |
| `src/lib/editor-elements.ts` | 425 | +14 lines: added `createCustomShape()` factory, `ShapeKind` type, `drawCustomElements()` handles shapes (rectangle/circle/line) |
| `src/lib/title-templates.ts` | ~300 | +112/-: refactored template definitions for better preview rendering compatibility |
| `src/components/CanvasOverlay.tsx` | 270 | Major rewrite of SVG overlay (commits b3004ac, 6322935) -- ultimately replaced by KonvaEditor but file still exists |
| `src/components/ManualImport.tsx` | ~150 | -52 lines: removed Browse Artists tab (consolidated into Nashville source) |

### Minor changes

| File | Change |
|------|--------|
| `src/components/ClusterCard.tsx` | Plural fix |
| `src/components/GridLayoutSelector.tsx` | Plural fix |
| `src/components/SlideSplitter.tsx` | Plural fix ("1 slides" -> "1 slide") |
| `src/components/WeekHistory.tsx` | Plural fix |
| `src/components/ResizablePanel.tsx` | +18 lines: adjusted defaults |
| `src/components/CarouselPreviewPanel.tsx` | +23 lines: wired new props for sharing/caption |
| `src/lib/canvas-grid.ts` | +13 lines: minor rendering adjustments |
| `src/lib/carousel-templates.ts` | +6 lines: template metadata additions |
| `src/lib/sources/types.ts` | -1 line: removed browse-artists source type |
| `tests/unit/source-types.test.ts` | Updated to match source type removal |
| `index.html` | Minor meta tag change |

---

## 7. RECOMMENDATIONS (ordered by priority)

### P0: Fix Konva editor coordinate mismatch

The most impactful fix is eliminating the double-rendering problem. Two approaches:

**Option A (recommended):** Pass `selectedElementId` to the canvas rendering functions (`generateTitleSlide` in `canvas-grid.ts`, `generateTemplatePreview`) and SKIP rendering that element in the background canvas. Then set all Konva elements to `opacity: 1` always. This eliminates the "pop" on selection and the coordinate mismatch entirely.

**Option B (simpler):** Remove `offsetX` from Konva elements (line 123 of `KonvaEditor.tsx`) and adjust x-coordinates to match the canvas rendering convention. Test thoroughly with text alignment.

Files to modify: `src/components/KonvaEditor.tsx` (lines 120-130), `src/lib/canvas-grid.ts` (wherever selected element can be excluded).

### P1: Security audit

The user explicitly requested a security audit during this session but it was never performed. Areas to audit:

- **Supabase RLS policies**: Are `weekly_nashville_releases` reads public or auth-gated?
- **API routes**: `/api/scan-artists`, `/api/browse-artists` -- do they validate input? Rate limiting?
- **localStorage draft data**: Contains full track data including Spotify URIs. Is this acceptable?
- **CORS on cover art**: `crossOrigin = 'anonymous'` is set in KonvaEditor for Spotify CDN images. Verify this works reliably.
- **Template import from image**: `TemplateImporter.tsx` accepts user-uploaded images. Are they sanitized?

### P2: Delete dead code

- `src/components/CanvasOverlay.tsx` (270 lines) is no longer imported. Delete it.
- `ArtistBrowser` component may still exist but is no longer referenced from ManualImport. Verify and delete if orphaned.
- In `UnifiedTemplateBuilder.tsx`, lines 220-221: `void _defaultGrid; void _defaultTitle;` are dead code markers for unused functions.

### P3: Replace window.prompt() for text editing

`KonvaEditor.tsx` line 165 uses `prompt('Edit text:')` which blocks the thread and looks terrible. Replace with:
- An inline `<input>` or `<textarea>` positioned over the Konva stage at the element's coordinates
- Or a text editing field in the left-panel properties section (already partially exists in UnifiedTemplateBuilder's property inspector)

### P4: Upgrade auto-save to Supabase

The current localStorage-only draft system meets the immediate need but doesn't survive browser switches. The plan specified Supabase persistence. Add a Supabase `nmf_drafts` table with columns: `user_id`, `week_date`, `selections_json`, `tracks_json`, `updated_at`. Save alongside localStorage. Show "Draft synced" indicator.

### P5: Batch template preview with real album art (complete item #7)

Currently grid template previews in `TemplateSelector.tsx` render with real tracks via `generateTemplatePreview()`, but title template previews in `TitleTemplatePicker.tsx` use a simplified canvas rendering (no actual cover art). Pass `coverFeature` track data into the title preview generator to show the actual featured image in the picker thumbnails.

### P6: Abort controller for Nashville search

`NashvilleReleases.tsx` line 85 uses `setTimeout` + `fetch` for debounced search. Add an `AbortController` that cancels in-flight requests when a new keystroke arrives:

```typescript
const abortRef = useRef<AbortController | null>(null);
// In the effect:
abortRef.current?.abort();
abortRef.current = new AbortController();
fetch(url, { signal: abortRef.current.signal })
```

### P7: Performance -- Konva package size

Konva.js adds ~150KB to the bundle. Since the editor is only used when the user opens template customization, consider lazy-loading the KonvaEditor component:

```typescript
const KonvaEditor = lazy(() => import('./KonvaEditor'));
```

This would require adding konva/react-konva to a separate chunk via Vite's `manualChunks` config.

### P8: Mobile template editing

`UnifiedTemplateBuilder.tsx` lines 1562-1573 show a "Template editing is available on desktop" notice for mobile. Eventually, the Konva editor could work on mobile with touch drag/pinch-zoom, but this is lower priority than fixing desktop issues first.

### P9: Handle resolution for Nashville tracks

The `CaptionGenerator` relies on Instagram handles from the parent component. Nashville source tracks bypass the ND handle resolution pipeline. Consider adding a lightweight handle lookup from the `search_index.json` or a dedicated API endpoint so Nashville tracks also get `@handle` tags in captions.

---

## 8. TECHNICAL DEBT

### Hasty implementations that need cleanup

1. **UnifiedTemplateBuilder.tsx is 1,620 lines**: This file handles template editing for BOTH grid and title modes, the property inspector, the preview rendering, the Konva integration, undo/redo, portal rendering, font picker, color swatches, and template saving. It should be split into:
   - `TemplateEditorLayout.tsx` (portal, left/right split)
   - `PropertyInspector.tsx` (element property editors)
   - `TemplateColorPanel.tsx` (color/gradient controls)
   - `TemplateFontPanel.tsx` (font picker)
   - Keep `KonvaEditor.tsx` as-is (already extracted)

2. **Inline styles everywhere**: Every component in this session uses inline `style={{}}` objects. There are no CSS modules or styled-components. This makes the code verbose and hard to maintain. The project uses CSS custom properties (defined in `index.css`) but all layout/spacing is inline. Not urgent to fix, but the component files are 30-40% longer than they need to be.

3. **Demo data hardcoded in NewMusicFriday.tsx**: Lines 54-95 contain 35 hardcoded demo tracks with real Spotify IDs and CDN URLs. These should be extracted to a separate `src/lib/demo-data.ts` file. The demo data alone is ~42 lines taking up space in an already 2,137-line file.

4. **CanvasOverlay.tsx is dead code**: 270 lines still in the repo, no longer imported. Should be deleted in next session.

5. **Multiple rendering paths for template previews**: Title template previews are rendered three different ways: (a) `generateTitleSlide()` in canvas-grid.ts for actual carousel output, (b) `generateTitlePreview()` in TitleTemplatePicker.tsx for picker thumbnails, (c) `previewUrl` in UnifiedTemplateBuilder for the editor background. These should be consolidated into one rendering path with a `size` parameter.

6. **Konva dependency not in package.json review**: Verify that `konva` and `react-konva` were properly added to `package.json` dependencies (not devDependencies). The import at `KonvaEditor.tsx` line 3 (`import Konva from 'konva'`) and line 2 (`from 'react-konva'`) require both packages.

7. **Editor element `x` is "horizontal center" but `y` is "top edge"**: This inconsistency (documented in `editor-elements.ts` lines 16-20) causes confusion when calculating Konva positions. The `offsetX: w / 2` in KonvaEditor line 123 compensates for x being center-based, but `offsetY: 0` treats y as top edge. Consider standardizing both to top-left corner to match Konva's native coordinate system.

8. **No tests for any of the new components**: KonvaEditor, TrackSuggestions, the modified CaptionGenerator, and the Nashville search functionality have zero unit tests. The session focused on shipping features, not test coverage. Priority test targets:
   - `TrackSuggestions`: scoring algorithm (pure function, easy to test)
   - `CaptionGenerator`: `buildCaption()` function (pure, 3 variants)
   - `pluralize.ts`: `p()` function (trivial but should have coverage)
   - `editor-elements.ts`: `titleTemplateToElements()` and `elementsToTitleTemplate()` roundtrip

---

## QUICK START FOR NEXT SESSION

```bash
cd /Users/maxblachman/Projects/mmmc-website

# 1. Verify current state
git log --oneline -5
npm run build   # should succeed

# 2. Priority fix: Konva coordinate mismatch
# Start in: src/components/KonvaEditor.tsx (233 lines)
# Then: src/lib/canvas-grid.ts (exclude selected element from background)

# 3. Delete dead code
# rm src/components/CanvasOverlay.tsx

# 4. Key files to understand the editor flow:
# src/components/UnifiedTemplateBuilder.tsx  (main editor, 1620 lines)
# src/components/KonvaEditor.tsx            (Konva interactive layer, 233 lines)
# src/lib/editor-elements.ts               (element model + converters, 425 lines)
# src/lib/canvas-grid.ts                   (canvas rendering engine)
```
