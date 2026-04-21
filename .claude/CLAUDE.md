# MMMC — NMF Curator Studio Rules

## Testing — Non-Negotiable
- `npm run build` must pass before every commit
- `npx vitest run` must pass (327+ tests, zero failures) before every commit
- Show passing output in chat before committing
- NEVER reduce test count below current baseline
- NEVER push code that breaks existing tests
- NEVER tell Max something is fixed without proving it
- Every bug fix requires a regression test

## Instagram Handles
- Ground truth: 3,792 handles in Supabase instagram_handles table
- Lookup order: Spotify artist ID → name fallback (.ilike, .limit(1), NOT .single())
- Name verification guard: cached name must match requested name before use
- Confidence is categorical: confirmed/likely/unverified/contested/rejected
- MusicBrainz is NOT a trusted source

## Caption Rules
- No hashtags, no emoji credit lines, no em dashes
- Always use personal pronouns naturally
- Never use absolute terms or superlatives Max hasn't stated

## Spotify Scan
- Sequential with 150ms gaps, abort on 429 with no retry
- SCAN_SECRET or same-origin required for scan endpoints

## SESSION-END PROTOCOL (mandatory, every session)
Run the `debrief` skill (`.claude/skills/debrief.md`) when within 10 minutes of budget, when Max says "wrap up" / "checkpoint" / "how are you doing", or when context health drops to 6/10. Produces 3 mandatory documents (accomplishment memo, exhaustion audit, top-10 recommendations) + continuity memo if health ≤ 6. Full templates and rules in the skill file.

## CROSS-THREAD SIGNALS
Signals live in cross_thread/ (committed, not /tmp/). Format: from_[source]_to_[target]__[topic].md. Consuming thread deletes after acting.

## TESTING DOCTRINE
Screenshot every UI change at both viewports before commit. Cold-visitor test every URL before declaring "ready." Test what would have been broken, not what already works. Query actual data after changes — look at names and numbers, not just row counts.

## SKILL TRIGGERS (automatic)
- Session start → run `preflight` before any work
- Every 30 minutes → run `scope` (am I still on mission?)
- When Max reports a bug → run `investigate` (reproduce before fixing)
- Before any file edit → consult `recon` + `handshake` (right target? no conflicts?)
- Before any git add/commit → run `gate`
- Before any production deploy → run `deploy`
- Before any bulk data operation (cascade, rebuild, upload) → run `cascade`
- After any database write or data export → run `canary`
- Before declaring anything done/ready/shipped → run `eyeball`
- Session end / wrap up / checkpoint → run `debrief`

A UI commit with only one viewport screenshot is NOT verified. Both 1440×900 desktop AND 393×852 mobile required on every UI-touching commit. One viewport is zero viewports.