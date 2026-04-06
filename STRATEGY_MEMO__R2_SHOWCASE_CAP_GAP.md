# STRATEGY MEMO — R2 Showcase Artist Cap Gap
## April 6, 2026

---

## The Gap

`browse_artists.json` in R2 currently caps each showcase category at **250 artists**. Nashville Decoder's database contains significantly more artists per showcase — for example, Whiskey Jam has **3,400+ artists and songwriters** who have played that showcase.

### Current State (R2)
| Showcase | R2 Count | Estimated ND Count |
|----------|----------|--------------------|
| Whiskey Jam | 250 | 3,400+ |
| Song Suffragettes | 250 | ~800+ |
| Bluebird Cafe | 250 | ~1,500+ |
| Listening Room | 250 | ~1,000+ |
| Rowdy/Outside the Round | 250 | ~600+ |
| Rebel Rouser | 250 | ~500+ |
| PinDrop | 250 | ~400+ |
| Grand Ole Opry | 73 | 73 (accurate) |
| Grindhouse | 250 | ~300+ |
| Buscall | 250 | ~300+ |
| Raised Rowdy | 250 | ~300+ |

### Why It Matters

The NMF Curator Studio now has showcase filtering on the Nashville tab. When a user clicks "Whiskey Jam", they see this week's releases from Whiskey Jam artists — but only from the 250 currently in R2, missing potentially thousands of valid artists.

The weekly cron scans all 3,299 top-level artists from R2. Since **100% of showcase artists overlap with the top-level list**, the scan already covers them. However, the showcase membership data (which artist belongs to which showcase) is limited to the 250 per category.

### Impact on Curation

A curator filtering by "Whiskey Jam" might miss releases from artists who HAVE played Whiskey Jam but aren't in the top 250 of that category. The top 250 are selected by the build script's sorting logic (likely by tier/credits/listeners), so less-established artists get cut first — which is exactly the segment curators most need to discover.

---

## The Fix (Thread A)

The cap lives in `build_browse_artists.py` (Thread A's domain). The fix:

1. **Remove the 250-per-category cap** in the build script's showcase category builder
2. **Or raise it to the full count** (e.g., `LIMIT 5000` or no limit)
3. R2 file size will increase — currently ~2.8MB. With full showcase rosters, estimate ~8-12MB. Still well within R2 limits and the browse-artists API already caches for 10 minutes.
4. The deduplication logic already handles artists appearing in multiple categories — no changes needed there.

### Specific Code Location
`scripts/build_browse_artists.py` — look for the `LIMIT` clause in `build_showcase_category()` or the slice that caps results.

---

## Verification After Fix

After Thread A removes the cap and runs a new cascade:
1. `curl -s R2_URL/browse_artists.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f'{c[\"id\"]}: {len(c.get(\"artists\",[]))}') for c in d['categories'] if c.get('type')=='showcase']"`
2. Whiskey Jam should show 3,400+ (not 250)
3. NMF showcase filter will automatically pick up the larger roster — no frontend changes needed.

---

## Timeline

- **Now**: NMF showcase filter works with 250 artists per showcase (shipped)
- **Next cascade run**: Thread A updates build script, removes cap
- **After cascade**: Full showcase rosters flow through to NMF automatically
