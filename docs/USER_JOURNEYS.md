# NMF Curator Studio — User Journey Map

**Owner:** Thread C · **Updated:** 2026-04-13 (Wave 7 Block 0)

This document is the test specification for `tests/e2e/journeys.spec.ts`.
Every journey below is enforced at BOTH desktop (1440×900) AND mobile
(393×852, iPhone 14 Pro with touch events). If a journey passes on one
viewport and fails on the other, CI fails.

## Why this exists

The publisher funnel starts on a phone. Max posts carousels from NMF to the
@nashvilledecoder Instagram account (18K followers). Publishers see the
carousel, tap the bio link, land on NMF on their phone. If the mobile UX is
broken, the funnel is broken — and `npx playwright test tests/mobile.spec.ts`
passing is not sufficient verification because it only covers overflow + touch
targets, not the actual journeys a publisher takes.

## The publisher funnel path (P0)

This is the single most important sequence. Every commit must keep it intact.

```
Instagram post → NMF mobile landing → Get Started as Guest
  → Coming Soon tab → filter pills → bridge card with songwriter credits
  → "ND Profile →" link → Nashville Decoder profile
```

OR, via the demo page (text-message path):

```
Text link → /demo/publisher-demo.html → "ND Profile →" link
  → Nashville Decoder profile
```

## Desktop journeys (1440×900)

| #  | Name                     | Entry                                | Key assertions                                                                 |
|----|--------------------------|--------------------------------------|--------------------------------------------------------------------------------|
| D1 | First-time visitor       | `/newmusicfriday`                    | Landing renders; "Get Started as a Guest" button present; click reaches app   |
| D2 | Carousel builder flow    | This Week tab (guest-mode)           | Week selector renders; track list loads                                        |
| D3 | Coming Soon discovery    | Coming Soon tab (guest-mode)         | Filter pill visible; tab renders without crash                                 |
| D4 | Showcase filtering       | This Week tab (guest-mode)           | Showcase dropdown (if present) does not overflow; clickable                    |
| D5 | Publisher demo page      | `/demo/publisher-demo.html`          | Heading renders; ≥10 `.nd-link` anchors have real `pg_id` format (not `pg_123`)|
| D6 | Carousel download        | Carousel preview (guest-mode)        | Download button exists (smoke)                                                 |
| D7 | Handle confirmation      | Artist card (guest-mode)             | Smoke: artist card surface is reachable                                        |

## Mobile journeys (393×852, isMobile, hasTouch)

| #  | Name                     | Entry                                | Key assertions                                                                 |
|----|--------------------------|--------------------------------------|--------------------------------------------------------------------------------|
| M1 | Instagram → NMF          | `/newmusicfriday`                    | Landing renders; no horizontal overflow; Get Started tappable (≥44px)         |
| M2 | Mobile carousel browse   | This Week tab (guest-mode)           | No horizontal overflow after entering app                                      |
| M3 | Mobile Coming Soon       | Coming Soon tab (guest-mode)         | Filter pills tappable; bridge card fits viewport; no horizontal overflow       |
| M4 | Mobile carousel download | Carousel preview (guest-mode)        | Download affordance visible + tappable                                         |
| M5 | Mobile showcase filter   | This Week tab (guest-mode)           | Showcase control does not overflow 393px                                       |
| M6 | Publisher on phone       | `/demo/publisher-demo.html`          | No overflow; `.nd-link` touch targets ≥44px high; real `pg_id` format          |

## pg_id format

Real pg_ids look like `PG_AUTO_<hash>` or `PG_<hash>` (Wave 6 Block 4 regex).
Placeholder pg_ids look like `pg_123`, `pg_456`, etc. Tests MUST assert the
real format, not the placeholder format.

## Rules

1. **Every commit** to NMF runs `npm run session:verify` which exercises both
   viewports. No "it passes on my laptop" — publishers are on phones.
2. **Dual-viewport testing** is enforced via Playwright `projects` in
   `playwright.config.ts`. The `desktop` project runs all specs in `tests/e2e`;
   the `mobile` project runs `tests/e2e/journeys.spec.ts` + `tests/mobile.spec.ts`.
3. **Data-dependent journeys** (M3 bridge cards, D3 bridge cards) degrade
   gracefully if composer data is absent — they assert the filter surface but
   skip the bridge-card assertion when `composer_name` is universally NULL.
   Those assertions auto-activate once Thread A's Apple Music enrichment
   backfills the 242 future-dated releases.
4. **Scope discipline**: new journeys added to NMF surface must be added here
   FIRST and tested SECOND. This doc is the contract.
