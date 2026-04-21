---
name: eyeball
description: "End-to-end visual and cold-visitor verification for any user-facing surface. Use this skill EVERY TIME you declare a feature 'done', 'ready', 'shipped', 'verified', or 'working'. Also use when: deploying to production, sharing a URL with anyone, preparing for a demo, or claiming a UI task is complete. This skill exists because the single most expensive failure in MMMC history — a live publisher demo that showed a 401 auth wall — was caused by testing with bypass cookies instead of the exact URL the user would click. Automated green ≠ visually correct. Tests passing ≠ ready. ALWAYS verify with your eyes before declaring done."
---

# Visual & Cold-Visitor Verification

## Level 1: Visual Screenshot (EVERY UI change)
Take Playwright screenshots at both viewports (1440×900 + 393×852). Run a DOM geometry report to catch overflow bugs. DESCRIBE what you see — don't just say "screenshot taken." Say "I see 5 WRITER cards, first is Anthony Smith (country). No deceased names visible."

## Level 2: Cold-Visitor Probe (EVERY "ready" declaration)
Hit the EXACT URL a user will click with ZERO pre-existing cookies or headers:
```javascript
const res = await fetch(url, { credentials: 'omit', redirect: 'manual' });
// Must return 200. Not 301, not 302, not 401.
```
Rules: No bypass headers. No pre-authenticated browser. No server-side knowledge. Just the URL and a clean user agent.

## Level 3: Data Inspection (EVERY data change)
Query actual values, not just counts. Look at names, genres, statuses. Ask: "Would a publisher seeing this data write a $10K check or close the tab?"

## The Anti-Pattern
The most dangerous sentence a thread can write: **"Verified programmatically."** This must ALWAYS be followed by "and visually confirmed via screenshot at [path]."
