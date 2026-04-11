# NMF CURATOR STUDIO — SCOPE DEFINITION

This document defines what NMF is and what it is NOT.
Enforce this on every feature decision.

## WHAT NMF IS

- A weekly Instagram carousel builder for New Music Friday
- A Coming Soon preview with bridge cards showing songwriter charting stats + ND Profile links
- A data collection tool (handles, relevance signals, editorial decisions flow to ND)
- A funnel to Nashville Decoder for publishers who see the carousel
- Free (with possible future freemium upgrade path)

## WHAT NMF IS NOT

- NOT a songwriter search tool (that's ND)
- NOT a publisher intelligence platform (that's ND)
- NOT an email digest service (that belongs on ND's publisher dashboard)
- NOT a free substitute for Nashville Decoder or CoWrite Compass

## THE TROJAN HORSE PRINCIPLE

NMF is the Trojan Horse. It collects data for ND. The intelligence stays behind the paywall.
The bridge cards show just enough to make publishers curious. The "ND Profile" link does the rest.

Flow: Instagram carousel with songwriter credits -> publisher sees it -> "how do you know that?" -> ND Profile link -> Nashville Decoder subscription inquiry

## APPROVED NMF FEATURES

- Carousel builder (This Week + Coming Soon)
- Bridge cards with songwriter charting stats + ND Profile links
- Carousel slides with songwriter credits (Instagram funnel)
- Handle confirmation button (data collection)
- Showcase filtering + progressive rendering + mobile polish
- ZIP/image download + Save to Photos

## PROHIBITED NMF FEATURES

- Songwriter search field (would cannibalize ND)
- Publisher intelligence display beyond basic publisher name on bridge cards
- Email digest (belongs on ND)
- Any feature that would make ND or CWC less valuable
- Exposed Apple Music search endpoint (cron-only)

## FREEMIUM BOUNDARY (TBD)

Free: carousel builder + basic Coming Soon + bridge cards
Premium: TBD (handle enrichment, richer bridge cards, possibly email digest)
Handle confirmation: TBD (Max 50/50 on free vs premium)

## DATA FLOWS

- NMF -> ND: confirmed handles (artist_handle_confirmations -> sync_handles_to_nd.py)
- NMF -> ND: enrichment data (nmf_enrichment_latest.json from cron scan)
- NMF -> Thread D: featured artists stats (featured_artists_stats.json)
- ND -> NMF: songwriter cache (update_songwriter_cache.py reads ND DB)
