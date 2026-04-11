# NMF CURATOR STUDIO — PERFORMANCE AUDIT
## April 11, 2026

### Bundle Sizes (Vite production build)

| Chunk | Raw | Gzipped | Notes |
|-------|-----|---------|-------|
| index (main bundle) | 861 KB | 246 KB | Includes React, router, all shared code |
| dist (Supabase client) | 185 KB | 48 KB | @supabase/supabase-js |
| jszip.min | 96 KB | 28 KB | Lazy: only loaded on ZIP download |
| NashvilleReleases | 38 KB | 10 KB | Lazy-loaded component |
| MobileResultsView | 19 KB | 5 KB | Lazy-loaded component |
| title-templates | 20 KB | 4 KB | Template definitions |
| Total JS | ~1.25 MB | ~360 KB | |
| CSS | 6.5 KB | 2 KB | |

### Static Data Assets

| File | Size | Load Time (CDN) | Notes |
|------|------|-----------------|-------|
| songwriter_cache.json | 12.4 MB | 0.44s | Only loaded when Coming Soon tab active |
| featured_artists_stats.json | ~50 KB | <0.05s | Lightweight |

### Network Measurements (from dev machine, CDN-served)

| Metric | Measured | Budget | Status |
|--------|----------|--------|--------|
| HTML document load | 0.14s | <0.5s | PASS |
| Songwriter cache fetch | 0.44s | <1.5s (4G) | PASS |
| Main JS bundle (gzip) | 246 KB | <500 KB | PASS |

### Known Performance Concerns

1. **Main bundle at 861 KB (246 KB gzip)** — over the 500 KB warning threshold.
   The `CarouselPreviewPanel` is statically imported by multiple components,
   preventing effective code-splitting. Would benefit from refactoring the
   import graph to enable true lazy loading.

2. **Songwriter cache at 12.4 MB** — large but only loaded lazily when the
   Coming Soon tab is activated. On 4G (9 Mbps), loads in ~1.5s. On 5G, <0.5s.
   If this becomes a bottleneck, consider a server-side lookup API instead of
   shipping the full cache to the client.

3. **Progressive rendering** mitigates DOM jank: only 50 artist cards render
   initially instead of 700+. "Show more" loads incrementally.

4. **Showcase filter cache** eliminates repeated API calls on showcase switch.
   Stale-while-revalidate with 5-minute TTL.

### Recommendations

- Monitor Real User Metrics (RUM) via Vercel Analytics once traffic grows
- Consider splitting the main bundle via route-based code splitting
- If songwriter cache load time degrades on slow connections, build a
  /api/lookup-songwriter endpoint as an alternative to client-side lookup
- The jszip chunk (96 KB) only loads on demand — no impact on initial load
