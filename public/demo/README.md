# NMF Publisher Demo Assets

This directory holds marketing assets for publisher pitch decks.

## Files

- **publisher-demo.html** — Standalone landing page showing live bridge card examples with real songwriter data (Luke Laird, Lainey Wilson, Ryan Hurd, etc.). Live at `/demo/publisher-demo.html`. Share the URL in pitch decks or take screenshots.

## Live demo data sources

The demo uses REAL composer data from live Apple Music API calls:

### Lainey Wilson — "The Jesus I Know Now" (releasing 2026-04-03)
- Brandon Lake (marquee tier)
- Lainey Wilson (25 charting, 14 #1s, marquee)
- Emily Weisband (10 charting, THiS Music)
- Luke Laird (34 charting, 24 #1s, Sony Music Publishing)

### Tucker Wetmore — "Sunburn" (releasing 2026-04-04)
- Daniel Ross (4 charting, 1 #1, rising)
- Ryan Hurd (21 charting, 7 #1s, marquee)
- Jaxson Free (4 charting, 3 #1s, marquee)

## Flow for a publisher demo

1. Open https://maxmeetsmusiccity.com/demo/publisher-demo.html
2. Walk through the example — "These are real tracks, real composers, real data"
3. Switch to https://maxmeetsmusiccity.com/newmusicfriday → Coming Soon tab
4. Show the same tracks live in the actual NMF tool
5. Click an "ND Profile →" link to show the paywalled intelligence

## Updating the demo

Run `/Users/maxblachman/Projects/mmmc-website/scripts/update_songwriter_cache.py` after any ND database update to refresh the cache. The demo HTML uses hardcoded copy that should be updated manually when the featured tracks rotate.
