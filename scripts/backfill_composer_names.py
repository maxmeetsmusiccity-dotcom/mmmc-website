#!/usr/bin/env python3
"""
Backfill composer_name for future-dated weekly_nashville_releases rows.

Wave 7 Block 1. As of 2026-04-13, 242 future-dated rows in
weekly_nashville_releases had composer_name=NULL, which meant the live
Coming Soon tab rendered ZERO bridge cards and the two data-dependent
Playwright tests in Wave 6 Addendum #7 skipped vacuously.

Strategy:
  1. Query Supabase for distinct (artist_name, album_name) pairs where
     composer_name IS NULL and release_date >= today.
  2. Call POST /api/search-apple with batches of up to 100 artists per
     call. The endpoint already pulls composerName from the Apple Music
     catalog; the original scan lost composer data for these rows (likely
     a silent failure in the batch include=tracks call).
  3. Match response tracks back to Supabase rows by (artist_name, album_name)
     — case-insensitive, whitespace-normalized.
  4. UPDATE the row's composer_name via PATCH.

Rate limit: /api/search-apple caps at 5 req/60s/IP. With 100 artists per
batch, 242 unique artists take ~3 calls well under the cap. We still
sleep 15s between calls to stay safe.

Auth: the endpoint accepts either Bearer SCAN_SECRET or an Origin header
of maxmeetsmusiccity.com. We use Origin because the local .env.local
SCAN_SECRET normalization may not match the deployed secret in every
environment.

Usage:
    python3 scripts/backfill_composer_names.py --dry-run   # preview only
    python3 scripts/backfill_composer_names.py --apply     # write to DB

Requires .env.local to be normalized (no literal \\n in values).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.local"
SUPABASE_URL = "https://kpwklxrcysokuyjhuhun.supabase.co"
SEARCH_APPLE_URL = "https://maxmeetsmusiccity.com/api/search-apple"
BATCH_SIZE = 100
RATE_LIMIT_SLEEP_S = 15


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        # Strip optional surrounding quotes AND literal trailing \n (legacy)
        val = val.strip()
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        if val.endswith("\\n"):
            val = val[:-2]
        env[key.strip()] = val
    return env


def norm(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip().lower()


def http_request(method: str, url: str, headers: dict[str, str], body: bytes | None = None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def fetch_null_composer_rows(env: dict[str, str]) -> list[dict[str, Any]]:
    """Return every weekly_nashville_releases row with NULL composer_name
    and release_date >= today. Supabase caps PostgREST at 1000 rows by
    default; 242 rows fits in one page."""
    today = date.today().isoformat()
    url = (
        f"{SUPABASE_URL}/rest/v1/weekly_nashville_releases"
        f"?select=id,artist_name,album_name,track_name,track_id,release_date,composer_name"
        f"&composer_name=is.null"
        f"&release_date=gte.{today}"
        f"&order=artist_name.asc"
        f"&limit=1000"
    )
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    status, body = http_request(
        "GET",
        url,
        {"apikey": key, "Authorization": f"Bearer {key}"},
    )
    if status != 200:
        raise RuntimeError(f"Supabase GET failed: {status} {body[:400]!r}")
    return json.loads(body)


def patch_row(env: dict[str, str], row_id: str, composer_name: str) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/weekly_nashville_releases?id=eq.{row_id}"
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    payload = json.dumps({"composer_name": composer_name}).encode("utf-8")
    status, body = http_request(
        "PATCH",
        url,
        {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        payload,
    )
    if status not in (200, 204):
        print(f"  PATCH failed ({status}): {body[:200]!r}", file=sys.stderr)
        return False
    return True


def fetch_apple_composers(
    artist_names: list[str],
    target_friday: str,
    days_back: int,
) -> list[dict[str, Any]]:
    payload = json.dumps(
        {
            "artistNames": artist_names,
            "targetFriday": target_friday,
            "daysBack": days_back,
        }
    ).encode("utf-8")
    status, body = http_request(
        "POST",
        SEARCH_APPLE_URL,
        {
            "Origin": "https://maxmeetsmusiccity.com",
            "Content-Type": "application/json",
        },
        payload,
    )
    if status == 429:
        print("  Rate limited — sleeping 60s", file=sys.stderr)
        time.sleep(60)
        return fetch_apple_composers(artist_names, target_friday, days_back)
    if status != 200:
        print(
            f"  search-apple failed ({status}): {body[:200]!r}",
            file=sys.stderr,
        )
        return []
    data = json.loads(body)
    return data.get("tracks", [])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--target-friday",
        default="",
        help="Apple Music search anchor date (default: widest window from rows)",
    )
    parser.add_argument(
        "--days-back",
        type=int,
        default=60,
        help="Search window — default 60 covers scan_week to release_date spread",
    )
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Use --dry-run or --apply", file=sys.stderr)
        return 2

    env = load_env(ENV_FILE)
    if "SUPABASE_SERVICE_ROLE_KEY" not in env:
        print("SUPABASE_SERVICE_ROLE_KEY missing from .env.local", file=sys.stderr)
        return 2

    print("[1/4] Fetching NULL composer rows from Supabase...")
    rows = fetch_null_composer_rows(env)
    print(f"      {len(rows)} rows with NULL composer_name and future release_date")
    if not rows:
        print("Nothing to backfill. Exiting cleanly.")
        return 0

    # Index rows by (artist_name, album_name) and by artist_name for lookup.
    rows_by_pair: dict[tuple[str, str], list[dict[str, Any]]] = {}
    rows_by_artist: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        pair = (norm(row["artist_name"]), norm(row["album_name"]))
        rows_by_pair.setdefault(pair, []).append(row)
        rows_by_artist.setdefault(norm(row["artist_name"]), []).append(row)

    unique_artists = sorted({row["artist_name"] for row in rows})
    print(f"[2/4] {len(unique_artists)} unique artists across those rows")

    # Pick the target_friday that maximizes the date window around the row
    # spread — use the midpoint between earliest and latest release_date.
    release_dates = sorted({row["release_date"] for row in rows})
    target_friday = args.target_friday or release_dates[len(release_dates) // 2]
    print(f"      targetFriday={target_friday} daysBack={args.days_back}")

    # Fetch Apple Music composer data in batches of BATCH_SIZE artists.
    print("[3/4] Calling /api/search-apple in batches...")
    all_tracks: list[dict[str, Any]] = []
    for i in range(0, len(unique_artists), BATCH_SIZE):
        batch = unique_artists[i : i + BATCH_SIZE]
        print(
            f"      batch {i // BATCH_SIZE + 1}: {len(batch)} artists "
            f"({batch[0]!r}..{batch[-1]!r})"
        )
        tracks = fetch_apple_composers(batch, target_friday, args.days_back)
        print(f"        → {len(tracks)} tracks returned")
        all_tracks.extend(tracks)
        if i + BATCH_SIZE < len(unique_artists):
            time.sleep(RATE_LIMIT_SLEEP_S)

    print(f"      total {len(all_tracks)} tracks with any data")
    resolved_tracks = [
        t
        for t in all_tracks
        if t.get("composer_name") and str(t["composer_name"]).strip()
    ]
    print(f"      {len(resolved_tracks)} tracks have non-empty composer_name")

    # Match resolved tracks back to Supabase rows.
    print("[4/4] Matching tracks to Supabase rows...")
    updates: list[tuple[dict[str, Any], str]] = []
    unmatched_tracks: list[dict[str, Any]] = []
    for track in resolved_tracks:
        artist = norm(track.get("artist_names") or "")
        album = norm(track.get("album_name") or "")
        composer = track["composer_name"]
        pair_rows = rows_by_pair.get((artist, album))
        if pair_rows:
            for row in pair_rows:
                updates.append((row, composer))
            continue
        # Fallback: match by artist_name alone — if the artist has exactly
        # one row AND it's still NULL, apply. Otherwise skip.
        artist_rows = rows_by_artist.get(artist, [])
        still_null = [r for r in artist_rows if r["composer_name"] is None]
        if len(still_null) == 1:
            updates.append((still_null[0], composer))
        else:
            unmatched_tracks.append(track)

    print(f"      matched updates: {len(updates)}")
    print(f"      unmatched Apple tracks: {len(unmatched_tracks)}")

    if updates[:5]:
        print("\n      sample updates:")
        for row, composer in updates[:5]:
            print(
                f"        {row['artist_name']} — {row['album_name']!r} → "
                f"composer={composer!r}"
            )

    if args.dry_run:
        print("\n[dry-run] No DB writes performed. Rerun with --apply.")
        return 0

    print("\n[apply] Writing to Supabase...")
    # Dedupe by row id (a track batch could hit the same row via both pair
    # match and fallback path).
    seen: set[str] = set()
    ok = 0
    fail = 0
    for row, composer in updates:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        if patch_row(env, row["id"], composer):
            ok += 1
        else:
            fail += 1
    print(f"      {ok} rows updated, {fail} failed")

    # Re-count remaining NULL rows so the session-end memo has an exact delta.
    remaining = fetch_null_composer_rows(env)
    print(
        f"\n[verify] remaining NULL-composer future rows: {len(remaining)}"
        f" (started at {len(rows)})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
