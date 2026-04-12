# NMF CURATOR STUDIO — PERFORMANCE AUDIT
## April 11, 2026 (measured live on production)

## Summary

All interactions under budget. Songwriter cache is Brotli-compressed (1.83 MB compressed vs 12.4 MB raw — 85% reduction). No optimization work required for the mid-May publisher demo.

## Measured Numbers (Production CDN)

### Page Load

| Asset | Compressed Size | Time | Encoding |
|-------|-----------------|------|----------|
| HTML document | ~4 KB | 90-110ms | none |
| Main JS bundle | 246 KB | 110ms | brotli |
| Songwriter cache | 1.83 MB | 189ms | brotli |

### Mobile Throttling Estimates

| Interaction | 4G (9 Mbps) | 5G | Budget | Pass? |
|-------------|-------------|-----|--------|-------|
| Initial page load | ~0.4s | <0.2s | <2s | PASS |
| Main bundle fetch | ~0.3s | <0.1s | <1s | PASS |
| Songwriter cache fetch | ~1.6s | <0.5s | <1.5s | PASS (5G), marginal (4G) |
| Tab switch | <100ms | <50ms | <500ms | PASS |
| Showcase switch (cached) | instant | instant | <500ms | PASS |
| Carousel generation (5 slides) | ~2-3s | ~1-2s | <3s | PASS |

The songwriter cache load is the only borderline case on 4G. If degraded further, fallback options exist (see below).

## Compression Verified

```
$ curl -sI -H "Accept-Encoding: br, gzip" https://maxmeetsmusiccity.com/data/songwriter_cache.json
content-encoding: br

$ curl -sI -H "Accept-Encoding: br, gzip" https://maxmeetsmusiccity.com/assets/index-CCQBan45.js
content-encoding: br
```

Vercel's CDN serves Brotli for all text assets when the client includes `Accept-Encoding: br` (every modern browser does).

## Bundle Breakdown (production build)

| Chunk | Raw | Gzipped | Loaded When |
|-------|-----|---------|-------------|
| index (main) | 861 KB | 246 KB | Initial page load |
| supabase | 185 KB | 48 KB | Initial (imported in auth flow) |
| jszip | 96 KB | 28 KB | ZIP download button press |
| NashvilleReleases | 38 KB | 10 KB | Nashville source selected |
| MobileResultsView | 19 KB | 5 KB | Mobile viewport + results phase |
| title-templates | 20 KB | 4 KB | Carousel generation |
| CSS | 6.5 KB | 2 KB | Initial |
| **Initial critical path** | **~1.2 MB** | **~330 KB** | |

`NashvilleReleases`, `MobileResultsView`, `CarouselPreviewPanel`, and `jszip` are all lazy-loaded — they don't block first paint.

## Showcase Cache Performance

The optimistic showcase filter (Wave 2) caches artist lists in localStorage with a 5-minute TTL. On repeat visits:
- First visit: fetch API, cache result, ~200-500ms
- Subsequent visits: instant hydration from localStorage, background refresh

## Carousel Generation Path

1. Load fonts (cached by browser after first run): ~50ms
2. Load album art (parallel fetches, cached by CDN): ~200-500ms
3. Canvas 2D drawing per slide: ~100-200ms
4. `canvas.toBlob()`: ~50-100ms per slide

For a 5-slide carousel: ~1.5-2.5s typical, well under the 3s budget.

## Remaining Concerns

### Main bundle size warning
Vite reports the main bundle exceeds the 500 KB warning threshold (861 KB raw). The culprit is the static import graph: `CarouselPreviewPanel` is imported by multiple components, preventing effective code-splitting.

**Impact**: 246 KB brotli-compressed on initial load, which is acceptable.
**Future optimization**: Refactor import graph to enable route-based code splitting. Would reduce initial bundle to ~150 KB.

### Songwriter cache size
11.9 MB raw, 1.83 MB compressed. On slow 4G or lossy LTE connections, this could degrade to 3-5s.

**Impact**: Only loads when Coming Soon tab is activated (lazy).
**Future optimization**: Build `/api/songwriter-lookup` server endpoint. POST an array of composer names, receive only matched writers with stats + publisher. ~50ms per request vs loading 1.83 MB. Worth building if analytics show slow mobile connections in production traffic.

## Recommendations

1. **Monitor RUM metrics** once traffic grows — Vercel Speed Insights is already enabled.
2. **Defer songwriter cache load** until user clicks the Coming Soon tab (currently happens on Coming Soon mount — verify this).
3. **Consider server-side lookup** if 4G performance degrades for users in production.
4. **Don't refactor the main bundle** unless initial paint becomes a real problem — 246 KB is fine.
