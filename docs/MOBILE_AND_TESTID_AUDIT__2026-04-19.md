# mmmc-website mobile viewport + data-testid audit

**Zeta W4 SW2 · Tier 1b + 1c · 2026-04-19**

Audit-first, patch-second. This doc captures current coverage and the specific gaps this sub-wave patches.

---

## 1 · Mobile viewport audit

### Existing infrastructure (strong foundation)

- **`playwright.config.ts`** runs two projects: `desktop` (1440×900) and `mobile` (393×852, `isMobile: true`, `hasTouch: true`). Wave 7 Block 0 introduced the split.
- **`tests/mobile.spec.ts`** — 3 viewport sizes tested (393 iPhone 14 Pro, 375 iPhone SE, 393 again for touch targets). 10 assertions covering horizontal overflow, header wrap, grid columns, touch target minimums, bridge card overflow.
- **`tests/e2e/mobile-audit.spec.ts`** — on-demand diagnostic sweep that walks the curator studio end-to-end on mobile, saving numbered screenshots + a findings JSON.
- **`tests/e2e/mobile-regressions.spec.ts`** — regression guards for the grid-template-columns bug (Block 3) and the artist-grouping modal (Block 4).
- **`tests/e2e/journeys.spec.ts`** — dual-viewport journey tests; the `desktop` and `mobile` projects both run this file.

### Paths covered by existing specs

| Path | Mobile 393 | Desktop 1440 | Touch target | Overflow |
|---|---|---|---|---|
| `/newmusicfriday` (landing) | ✅ `journeys.spec.ts J1` + `mobile.spec.ts` | ✅ `journeys.spec.ts J1` | ✅ | ✅ |
| `/newmusicfriday` (post-guest) | ✅ `mobile.spec.ts` + `mobile-regressions.spec.ts` | ✅ | partial | ✅ |
| `/demo/publisher-demo.html` | ✅ `mobile.spec.ts` | — | ✅ | ✅ |

### Paths NOT covered by existing mobile specs

| Path | Gap |
|---|---|
| `/` (Home hero) | No mobile smoke test. Uses `clamp()` padding + `minmax(min(100%, 340px), 1fr)` auto-fit grid — likely fine — but no assertion. |
| `/newmusicfriday/submit` | No mobile smoke test. Form uses `maxWidth: 520` fixed container — should be fine at 393 but no overflow assertion. |
| `/dashboard` (Curator Studio) | No mobile smoke test. Tabs row uses `overflowX: 'auto'`, grid uses `repeat(auto-fill, minmax(260px, 1fr))` — at 393 viewport a 260px card minimum forces 1 column with ~57px side gutters, which is visually cramped. |
| `/newmusicfriday/archive` | No mobile smoke test. |
| `/curator/:username` | No mobile smoke test. |

### Patch shipped this sub-wave

- `tests/e2e/journeys.spec.ts` — adds smoke tests `J6-home` and `J7-submit` that run at BOTH viewports, asserting heading visible + no horizontal overflow.
- `/dashboard` grid minimum: `minmax(260px, 1fr)` → `minmax(220px, 1fr)` so at 393×852 the 2-col layout activates (currently forces 1-col with large gutters).

### Gaps flagged but NOT patched this sub-wave

- `/curator/:username` public profile deserves dual-viewport journey coverage; deferred to SW3.
- Dashboard submissions list row wraps awkwardly at 393 — fix deferred to when writer-claim card design lands (Tier 1a), since they'll share the card template.

---

## 2 · data-testid audit

### Current coverage (grep: `data-testid=` in `src/`)

**28 testids across 12 files.** Components with solid coverage: `MobileResultsView` (9), `CarouselPreviewPanel` (3), `TitleTemplatePicker` (2), `SourceSelector` (2), `ArtistClusterCard` (2), `PlatformTabs` (2). Pages: `NewMusicFriday` has 2.

### Pages with ZERO testids (user-facing forms & navigation)

| Page | Interactive elements | Priority |
|---|---|---|
| `Submit.tsx` | 1 form, 4 inputs (URL, pitch, name, email, label), 1 submit, 1 success-CTA | **HIGH** — publisher submission funnel |
| `Dashboard.tsx` | 4 tabs, search input, genre select, 6+ CTAs, stats cards, tier pricing cards | **HIGH** — primary curator/admin surface |
| `Home.tsx` | 2+ hero CTAs | MED — top-of-funnel |
| `CuratorProfile.tsx` | Follow/unfollow, external links | MED |
| `Archive.tsx` | Week selector, view buttons | LOW |
| `ThisWeek.tsx` | Read-only | LOW |

### Naming convention (enforced this sub-wave)

Pattern: `<page-or-component>-<role>-<modifier?>`. Examples:
- `submit-form`, `submit-input-track-url`, `submit-input-email`, `submit-button-track`, `submit-success-cta`
- `dashboard-tab-curators`, `dashboard-tab-submissions`, `dashboard-search-curators`, `dashboard-filter-genre`, `dashboard-cta-submit-new`

### Patch shipped this sub-wave

Adds testids to `Submit.tsx` (form + all inputs + submit + success CTA) and `Dashboard.tsx` (tabs + search + filter + top CTAs). Remaining pages flagged above are deferred to SW3 or when the page is otherwise touched.

---

## 3 · Cross-cutting findings

- `global.css` has two mobile-only breakpoints (767 max, 768 min) with hardcoded `!important` overrides on `header[style]` — this works but is brittle. Not patching this sub-wave; flag for future refactor toward token-driven CSS.
- Touch targets: `.btn { min-height: 44px }` is enforced globally (Apple HIG). `.btn-sm { min-height: 36px }` is below HIG — acceptable on densely-packed surfaces but not ideal on primary actions. Not patching; flag.
- `.mobile-only` / `.desktop-only` visibility classes with the warning comment at line 252-254 are working — new code must continue to respect the wrapping pattern.

— Zeta, 2026-04-19
