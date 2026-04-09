# MMMC — NMF Curator Studio Rules

## Testing — Non-Negotiable
- `npm run build` must pass before every commit
- `npx vitest run` must pass (264+ tests, zero failures) before every commit
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
