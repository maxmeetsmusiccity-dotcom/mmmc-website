#!/usr/bin/env python3
"""
NMF → ND Handle Sync Bridge

Reads: artist_handle_confirmations WHERE synced_to_nd = false (from Supabase)
Matches: artist_name against songwriter_cache to find pg_id
Outputs: data/nmf_handle_sync.json
Marks synced_to_nd = true after export.

Run after NMF curation sessions to propagate Max's handle confirmations
to Nashville Decoder via Thread A's cascade.
"""

import json
import os
import sys
from datetime import datetime

# Resolve paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
CACHE_PATH = os.path.join(PROJECT_DIR, "public", "data", "songwriter_cache.json")
OUTPUT_PATH = os.path.join(PROJECT_DIR, "data", "nmf_handle_sync.json")

def main():
    # Load songwriter cache for pg_id matching
    if not os.path.exists(CACHE_PATH):
        print("ERROR: songwriter_cache.json not found. Run update_songwriter_cache.py first.")
        sys.exit(1)

    with open(CACHE_PATH) as f:
        cache = json.load(f)
    writers = cache.get("writers", {})
    aliases = cache.get("aliases", {})

    def find_pg_id(name: str) -> str | None:
        key = name.lower().strip()
        if key in writers:
            return writers[key].get("pg_id")
        alias_target = aliases.get(key)
        if alias_target and alias_target in writers:
            return writers[alias_target].get("pg_id")
        return None

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
        print("ERROR: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
        sys.exit(1)

    try:
        from supabase import create_client
        sb = create_client(url, key)
    except ImportError:
        print("ERROR: supabase-py not installed. Run: pip install supabase")
        sys.exit(1)

    # Fetch unsynced confirmations
    try:
        result = sb.from_("artist_handle_confirmations").select("*").eq("synced_to_nd", False).execute()
        rows = result.data or []
    except Exception as e:
        print(f"WARNING: Could not read artist_handle_confirmations: {e}")
        print("Table may not exist yet. Run migrations/001_composer_pipeline.sql first.")
        rows = []

    if not rows:
        print("No unsynced handle confirmations found.")
        # Still write empty file so downstream knows we checked
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        with open(OUTPUT_PATH, "w") as f:
            json.dump({"confirmations": [], "exported_at": datetime.now().astimezone().isoformat()}, f, indent=2)
        print(f"Written empty sync file to: {OUTPUT_PATH}")
        return

    confirmations = []
    for row in rows:
        name = row.get("artist_name", "")
        pg_id = find_pg_id(name)
        confirmations.append({
            "pg_id": pg_id,
            "display_name": name,
            "instagram_handle": row.get("instagram_handle", ""),
            "source": row.get("source", "nmf_curation"),
            "evidence_type": "human_verified_handle",
            "confirmed_at": row.get("confirmed_at"),
            "corrected_from": row.get("corrected_from"),
        })

    output = {
        "confirmations": confirmations,
        "exported_at": datetime.now().astimezone().isoformat(),
        "total": len(confirmations),
        "with_pg_id": sum(1 for c in confirmations if c["pg_id"]),
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    # Mark synced
    synced_ids = [row["id"] for row in rows]
    try:
        sb.from_("artist_handle_confirmations").update({"synced_to_nd": True}).in_("id", synced_ids).execute()
    except Exception as e:
        print(f"WARNING: Failed to mark synced: {e}")

    print(f"Exported {len(confirmations)} handle confirmations")
    print(f"  With pg_id match: {output['with_pg_id']}")
    print(f"  Without match: {len(confirmations) - output['with_pg_id']}")
    print(f"Written to: {OUTPUT_PATH}")
    print()
    print("THREAD C → THREAD A DATA FEED:")
    print(f"  Handle confirmations at: {OUTPUT_PATH}")
    print("  Thread A's cascade reads this to update ND profiles")


if __name__ == "__main__":
    main()
