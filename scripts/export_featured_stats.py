#!/usr/bin/env python3
"""
Export featured artists stats for Thread D's trending algorithm.

Queries Supabase for scan history: how many weeks each artist appeared
in Nashville releases (proxy for NMF curation frequency). Thread D
reads this as an editorial signal boost for the trending score.

Output: public/data/featured_artists_stats.json
"""

import json
import os
import sys
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_PATH = os.path.join(PROJECT_DIR, "public", "data", "featured_artists_stats.json")

def main():
    # Load env
    env_path = os.path.join(PROJECT_DIR, ".env.local")
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k] = v.strip().strip('"').replace("\\n", "")

    url = env.get("VITE_SUPABASE_URL", "")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not url or not key:
        print("ERROR: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    try:
        from supabase import create_client
        sb = create_client(url, key)
    except ImportError:
        print("ERROR: supabase-py not installed")
        sys.exit(1)

    # Fetch all releases grouped by artist
    try:
        result = sb.from_("weekly_nashville_releases").select("artist_name, scan_week").execute()
        rows = result.data or []
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    if not rows:
        print("No release data found.")
        return

    # Aggregate per artist
    artist_stats: dict[str, dict] = {}
    for row in rows:
        name = (row.get("artist_name") or "").split(",")[0].strip()
        if not name:
            continue
        week = row.get("scan_week", "")

        if name not in artist_stats:
            artist_stats[name] = {
                "artist_name": name,
                "weeks_featured": set(),
                "total_tracks_featured": 0,
            }

        artist_stats[name]["weeks_featured"].add(week)
        artist_stats[name]["total_tracks_featured"] += 1

    # Convert sets to counts and sort
    output_list = []
    for stats in artist_stats.values():
        weeks = sorted(stats["weeks_featured"])
        output_list.append({
            "artist_name": stats["artist_name"],
            "weeks_featured": len(weeks),
            "first_featured": weeks[0] if weeks else None,
            "last_featured": weeks[-1] if weeks else None,
            "total_tracks_featured": stats["total_tracks_featured"],
        })

    output_list.sort(key=lambda x: x["weeks_featured"], reverse=True)

    output = {
        "artists": output_list,
        "total_artists": len(output_list),
        "total_weeks": len(set(row.get("scan_week", "") for row in rows)),
        "exported_at": datetime.now().astimezone().isoformat(),
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Featured artists stats: {len(output_list)} artists")
    print(f"  Across {output['total_weeks']} scan weeks")
    if output_list:
        top = output_list[0]
        print(f"  Most featured: {top['artist_name']} ({top['weeks_featured']} weeks, {top['total_tracks_featured']} tracks)")
    print(f"\nWritten to: {OUTPUT_PATH}")
    print()
    print("THREAD C → THREAD D DATA FEED:")
    print(f"  Featured artists stats at: {OUTPUT_PATH}")
    print("  D reads this for editorial signal boost in trending algorithm")


if __name__ == "__main__":
    main()
