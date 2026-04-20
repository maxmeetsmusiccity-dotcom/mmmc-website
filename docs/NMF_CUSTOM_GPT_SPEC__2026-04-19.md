# NMF Custom GPT — MVP spec

**Zeta W4 · Tier 5 · 2026-04-19 · scaffold only (deployment gated on Max provisioning the OpenAI GPT)**

Deliverables here are design-time: OpenAPI spec for GPT Actions, persona prompt, query examples. Build targets are the existing MMMC Vercel routes + ND Workers routes. No new endpoints needed for MVP.

---

## 1. Persona

**Name:** *NMF Analyst*
**Audience:** Nashville publishers, A&R, managers, sync supervisors, studio engineers. Monday-morning "who's relevant this week" queries.

**Voice rule:** plain-English, answers grounded in data, never fabricate an artist/track/writer. If a query returns no results, say "no results for X" — don't hallucinate names to fill the answer.

**System prompt (draft):**

> You are the NMF Analyst, a research assistant for Nashville music publishers and industry professionals. You answer questions about newly-released and upcoming country / americana / Nashville-orbit tracks using real data from the Max Meets Music City platform.
>
> Every answer must be grounded in a tool call result. When a user asks "who wrote X" or "what's Lainey Wilson releasing next", call the appropriate tool and cite track names, release dates, and writer credits verbatim.
>
> Never speculate about charts, streams, or unreleased projects. Never fabricate IG handles. If a tool returns an empty result, say so.
>
> Scope: tracks released in the last 48 hours (daily scan) or the most recent Friday (weekly scan), plus historical catalog for artists in the `browse_artists` universe (~40K Nashville-orbit artists).

---

## 2. Endpoints the GPT needs (all already deployed)

### 2.1 `/api/enrichment-latest` (GET, auth-gated)

Returns the latest weekly or daily scan's tracks plus stats.

- **Path:** `https://maxmeetsmusiccity.com/api/enrichment-latest`
- **Auth:** `Authorization: Bearer <CRON_SECRET>` OR `X-ND-Token: <token>`. Neither of these should be in the GPT config directly — instead, gate via ND Workers proxy (see 2.7) or provision a GPT-specific read-only token.
- **Response shape:**
  ```json
  {
    "scan_week": "2026-04-17",
    "total_scanned": 38241,
    "total_tracks": 88,
    "composer_credits": 51,
    "releases": [
      {
        "artist_name": "...",
        "track_name": "...",
        "album_name": "...",
        "release_date": "YYYY-MM-DD",
        "album_type": "single | album | ep",
        "cover_art_300": "...",
        "composer_name": "..."
      }
    ],
    "future_releases": [ ... ]
  }
  ```
- **Good for:** "what released this Friday", "what's coming soon", "count composer credits on last week's releases"

### 2.2 `/api/browse-artists` (GET, public with rate-limit)

Returns the ~40K-artist universe with tiers, archetypes, categories.

- **Path:** `https://maxmeetsmusiccity.com/api/browse-artists`
- **Auth:** rate-limited by IP, no secret
- **Response shape:**
  ```json
  {
    "generated_at": ISO-8601,
    "categories": { "<id>": { "name": "...", "description": "...", "emoji": "...", "count": N } },
    "artists": [
      {
        "pg_id": "P...",
        "name": "...",
        "tier": "active | developing | rising | marquee",
        "archetype_display": "...",
        "spotify_genres": [...],
        "monthly_listeners": N,
        "spotify_popularity": N,
        "camp_name": "...",
        "no1_songs": N,
        "credits": N,
        "categories": ["song_suffragettes", ...]
      }
    ]
  }
  ```
- **Good for:** "who's in the rising tier", "list all Whiskey Jam regulars", "which artists have >5 #1s"

### 2.3 `/api/songwriter-match` (POST)

Text-matches a name or partial-name against the writer catalog.

- **Path:** `POST https://maxmeetsmusiccity.com/api/songwriter-match`
- **Body:** `{ "query": "Shane McAnally", "limit": 10 }`
- **Response:** ranked matches with pg_id, canonical name, tier, top collaborators
- **Good for:** "did Shane McAnally write this", disambiguation of similar names

### 2.4 `/api/scan-health` (GET, auth-gated)

Upstream provider status (Spotify + Apple). Useful for the GPT to know whether a query failure is data-freshness vs upstream outage.

- **Response:** `{ "spotify": { "ok": true, "status": 200 }, "apple": { "ok": true, "status": 200 }, "tested_at": ISO-8601 }`

### 2.5 `/api/scan-artists` (POST, auth-gated)

On-demand scan of a specific artist's last-48h releases. Kept in the MVP for targeted queries like "has Morgan Wallen released anything today".

### 2.6 `/api/discover-instagram` (POST)

IG-handle-to-artist lookup. Built on the Zeta SW2 known_handle_index_v2.

- **Path:** `POST https://maxmeetsmusiccity.com/api/discover-instagram`
- **Body:** `{ "handle": "lainey_wilson_music" }`
- **Response:** artist pg_id + canonical name + tier + confidence

### 2.7 ND Workers endpoints (via `nd-proxy.ts`)

The MMMC site proxies to the ND Workers API at `https://nd-api.nd-api.workers.dev` for deeper catalog queries. Endpoints:

- `/api/profile/<pg_id>` — full artist profile (credits, collaborations, arc)
- `/api/cowriters/<pg_id>` — known co-writers + frequency
- `/api/compare?a=<pg1>&b=<pg2>` — head-to-head stats
- `/api/network?seed=<pg_id>&depth=N` — collaboration network
- `/api/credits?query=<text>` — free-text credit search

These live behind ND_AUTH_TOKEN_SECRET — do not expose directly to the GPT. Proxy via MMMC or mint a GPT-scoped read-only token.

---

## 3. OpenAPI 3.1 spec (draft — minimal)

Save as `docs/openapi/nmf_custom_gpt.yaml` when building out. This is the shape — endpoints omit auth headers for GPT action compatibility (auth handled via GPT action-level config).

```yaml
openapi: 3.1.0
info:
  title: NMF Analyst — MMMC read-only API
  version: 0.1.0
  description: Read-only endpoints for the NMF Analyst Custom GPT. All responses are cached at the edge (s-maxage=3600).
servers:
  - url: https://maxmeetsmusiccity.com
paths:
  /api/enrichment-latest:
    get:
      operationId: getLatestScan
      summary: Latest NMF scan (weekly or daily) with tracks and stats
      responses:
        "200":
          description: Scan results
          content:
            application/json:
              schema:
                type: object
                properties:
                  scan_week: { type: string, format: date }
                  total_scanned: { type: integer }
                  total_tracks: { type: integer }
                  composer_credits: { type: integer }
                  releases:
                    type: array
                    items: { $ref: "#/components/schemas/Release" }
                  future_releases:
                    type: array
                    items: { $ref: "#/components/schemas/Release" }

  /api/browse-artists:
    get:
      operationId: browseArtists
      summary: Artist universe with tiers and categories
      responses:
        "200":
          description: Artist catalog
          content:
            application/json:
              schema:
                type: object
                properties:
                  generated_at: { type: string, format: date-time }
                  artists:
                    type: array
                    items: { $ref: "#/components/schemas/Artist" }

  /api/songwriter-match:
    post:
      operationId: matchSongwriter
      summary: Search songwriter catalog by name
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [query]
              properties:
                query: { type: string }
                limit: { type: integer, default: 10 }
      responses:
        "200":
          description: Ranked matches
          content:
            application/json:
              schema:
                type: object
                properties:
                  matches:
                    type: array
                    items: { $ref: "#/components/schemas/Writer" }

  /api/discover-instagram:
    post:
      operationId: resolveInstagramHandle
      summary: Resolve an Instagram handle to an artist
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [handle]
              properties: { handle: { type: string } }
      responses:
        "200":
          description: Resolved artist (or null)
          content:
            application/json:
              schema:
                type: object
                properties:
                  handle: { type: string }
                  artist:
                    oneOf:
                      - $ref: "#/components/schemas/Artist"
                      - type: "null"
                  confidence: { type: string, enum: [confirmed, likely, unverified, contested, rejected] }

components:
  schemas:
    Release:
      type: object
      properties:
        artist_name: { type: string }
        track_name: { type: string }
        album_name: { type: string }
        release_date: { type: string, format: date }
        album_type: { type: string, enum: [single, album, ep, compilation] }
        cover_art_300: { type: string, format: uri }
        composer_name: { type: string, nullable: true }
    Artist:
      type: object
      properties:
        pg_id: { type: string }
        name: { type: string }
        tier: { type: string, enum: [active, developing, rising, marquee] }
        archetype_display: { type: string }
        spotify_genres:
          type: array
          items: { type: string }
        monthly_listeners: { type: integer }
        no1_songs: { type: integer }
        credits: { type: integer }
    Writer:
      type: object
      properties:
        pg_id: { type: string }
        canonical_name: { type: string }
        tier: { type: string }
        top_collaborators:
          type: array
          items: { type: string }
```

---

## 4. Example queries the GPT should handle

Matched to the 10-publisher-question framing from `feedback_business_value_not_technical_credibility`:

| User query | Tool calls | Answer shape |
|---|---|---|
| "Who released country music this Friday?" | `getLatestScan` | "88 country tracks hit this Friday. Top by streams: …" |
| "Has Morgan Wallen released anything in the last 2 days?" | `getLatestScan` (filter artist_name) or `scanArtists` | "No releases for Morgan Wallen in the 2026-04-17 scan. Next upcoming: …" |
| "Who wrote 'I Had Some Help'?" | `matchSongwriter` or `getLatestScan` (filter track_name) | "Credited writers: …" |
| "Which developing-tier artists are in Whiskey Jam's rotation?" | `browseArtists` (filter tier + categories) | "12 developing-tier writers: …" |
| "Is `@laineyofficial` Lainey Wilson?" | `resolveInstagramHandle` | "Yes — Lainey Wilson, pg_id=P…, confidence=confirmed" |
| "Which artists have >5 #1s and are in 3rd & Lindsley's rotation?" | `browseArtists` (filter no1_songs + categories) | list |
| "Show me the top 10 composer credits in last week's releases." | `getLatestScan` (group by composer_name) | ranked list |
| "Are Spotify and Apple data up to date?" | `getScanHealth` | summary |

---

## 5. What's NOT in MVP

- **Write actions.** The GPT is read-only. No ingest, no credit confirmation, no handle save.
- **Boss-mode gates.** Same policy as the website — Shows tab features stay off per `feedback_shows_boss_mode`. If the GPT needs showcase-level data, it uses only the public `browse-artists` categories.
- **Bulk exports.** A GPT conversation shouldn't be the path for pulling 10K-row datasets. Keep the answer surface bounded (top-N, aggregates).
- **Real-time Spotify/Apple passthrough.** The GPT reads our cached scan outputs, not upstream provider APIs directly.

---

## 6. Deployment steps (for a later session)

1. Provision OpenAI Custom GPT via chatgpt.com → My GPTs → Create.
2. Paste system prompt (§1) + load Actions YAML (§3).
3. Configure Actions auth: API key shared-secret in GPT config, matching a `CUSTOM_GPT_SECRET` Vercel env var and endpoint-level header check (`x-gpt-secret`).
4. Alternative: mint a read-only Bearer token via ND Workers that the GPT injects on each call.
5. Ship behind `boss-mode` flag initially, widen later.
6. Verify queries from §4 manually before public release.

---

## 7. Cross-thread notes

- **Alpha** owns no piece of this MVP — all endpoints listed already exist. Alpha does not need to prioritize anything from this spec.
- **Zeta** (this thread) will refine this spec if Max decides to proceed; specifically, the IG handle resolver endpoint (§2.6) benefits from the SW2 / W4 `known_handle_index_v2` work already on disk.
- **Gamma / Delta / Eta** — no overlap.

— Zeta W4, 18:40 CT
