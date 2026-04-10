#!/usr/bin/env python3
"""
Ingest Apple Music future release dragnet results into Supabase.
Reads /tmp/future_releases_dragnet.json and upserts into weekly_nashville_releases.

Usage:
  python3 scripts/ingest_dragnet_results.py --dry-run
  python3 scripts/ingest_dragnet_results.py --execute
"""

import json, os, sys, requests
from datetime import datetime, timedelta

# Load env
env = {}
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_path):
    for line in open(env_path):
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            v = v.strip().strip('"')
            env[k.strip()] = v

SUPABASE_URL = env.get('VITE_SUPABASE_URL', '')
# Try service role key first, fall back to anon key
SUPABASE_KEY = env.get('SUPABASE_SERVICE_ROLE_KEY', '').replace('\\n', '')
if len(SUPABASE_KEY) < 100:
    SUPABASE_KEY = env.get('VITE_SUPABASE_ANON_KEY', '').replace('\\n', '')
    print(f"Using anon key (service role key too short: {len(env.get('SUPABASE_SERVICE_ROLE_KEY', ''))} chars)")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

def get_friday_for_date(date_str):
    """Get the Friday before or on the given date (scan_week value)."""
    d = datetime.strptime(date_str[:10], '%Y-%m-%d')
    # Find the most recent Friday (including today if Friday)
    days_since_friday = (d.weekday() - 4) % 7
    friday = d - timedelta(days=days_since_friday)
    return friday.strftime('%Y-%m-%d')

def get_current_scan_week():
    """Get this week's Friday (for scan_week)."""
    now = datetime.now()
    days_since_friday = (now.weekday() - 4) % 7
    friday = now - timedelta(days=days_since_friday)
    return friday.strftime('%Y-%m-%d')

def main():
    dry_run = '--dry-run' in sys.argv
    execute = '--execute' in sys.argv

    if not dry_run and not execute:
        print("Usage: python3 scripts/ingest_dragnet_results.py [--dry-run | --execute]")
        sys.exit(1)

    # Read dragnet results
    dragnet_path = '/tmp/future_releases_dragnet.json'
    if not os.path.exists(dragnet_path):
        print(f"ERROR: {dragnet_path} not found. Is the dragnet running?")
        sys.exit(1)

    with open(dragnet_path) as f:
        results = json.load(f)

    print(f"Loaded {len(results)} future tracks from dragnet")

    today = datetime.now().strftime('%Y-%m-%d')
    scan_week = get_current_scan_week()

    # Filter: only tracks with release_date > today (actually future)
    future = [r for r in results if (r.get('release_date') or '') > today]
    print(f"Future releases (after {today}): {len(future)}")

    # Deduplicate by ISRC or apple_track_id
    seen = set()
    unique = []
    for r in future:
        key = r.get('isrc') or r.get('apple_track_id') or f"{r['artist_name']}_{r['track_name']}"
        if key not in seen:
            seen.add(key)
            unique.append(r)

    print(f"Unique tracks after dedup: {len(unique)}")

    # Build Supabase rows
    rows = []
    for r in unique:
        track_id = r.get('isrc') or r.get('apple_track_id') or f"future_{r['artist_name']}_{r['track_name']}"
        rows.append({
            'scan_week': scan_week,
            'artist_name': r['artist_name'],
            'track_name': r['track_name'],
            'album_name': r['album_name'],
            'track_id': track_id,
            'album_id': r.get('apple_album_id') or '',
            'album_type': 'single' if r.get('is_single') else 'album',
            'release_date': r['release_date'][:10],
            'cover_art_640': (r.get('artwork_url') or '').replace('/300x300', '/640x640').replace('300x300bb', '640x640bb'),
            'cover_art_300': r.get('artwork_url') or '',
            'track_number': 1,
            'duration_ms': r.get('duration_ms') or 0,
            'explicit': False,
            'total_tracks': 1,
            'spotify_url': '',
            'spotify_artist_id': '',
        })

    # Stats
    with_credits = sum(1 for r in unique if r.get('composer_name'))
    with_artwork = sum(1 for r in unique if r.get('artwork_url'))
    print(f"\nIngestion summary:")
    print(f"  Tracks to upsert: {len(rows)}")
    print(f"  scan_week: {scan_week}")
    print(f"  With composer credits: {with_credits} ({round(with_credits/max(len(unique),1)*100)}%)")
    print(f"  With artwork: {with_artwork} ({round(with_artwork/max(len(unique),1)*100)}%)")

    # Show sample
    if rows:
        print(f"\n  Sample: {rows[0]['artist_name']} — {rows[0]['track_name']} ({rows[0]['release_date']})")

    if dry_run:
        print(f"\n[DRY RUN] Would upsert {len(rows)} tracks into weekly_nashville_releases")
        # Show unique albums
        albums = {}
        for r in unique:
            key = r.get('apple_album_id') or r['album_name']
            if key not in albums:
                albums[key] = {'artist': r['artist_name'], 'album': r['album_name'], 'date': r['release_date']}
        print(f"  Unique releases: {len(albums)}")
        for a in sorted(albums.values(), key=lambda x: x['date']):
            print(f"    📅 {a['date']} — {a['artist']} \"{a['album']}\"")
        return

    # Execute: upsert in batches of 50
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
    }

    inserted = 0
    errors = 0
    batch_size = 50

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        resp = requests.post(
            f'{SUPABASE_URL}/rest/v1/weekly_nashville_releases',
            headers=headers,
            json=batch,
        )
        if resp.status_code in (200, 201):
            inserted += len(batch)
        elif resp.status_code == 409:
            # Conflict = duplicates, try individual upserts
            for row in batch:
                r2 = requests.post(
                    f'{SUPABASE_URL}/rest/v1/weekly_nashville_releases',
                    headers=headers,
                    json=row,
                )
                if r2.status_code in (200, 201):
                    inserted += 1
                else:
                    errors += 1
        else:
            print(f"  Batch error {resp.status_code}: {resp.text[:200]}")
            errors += len(batch)

        if (i + batch_size) % 200 == 0:
            print(f"  Progress: {min(i + batch_size, len(rows))}/{len(rows)} ({inserted} inserted, {errors} errors)")

    print(f"\nDone: {inserted} inserted, {errors} errors")

if __name__ == '__main__':
    main()
