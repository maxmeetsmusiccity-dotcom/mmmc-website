#!/usr/bin/env python3
"""
Songwriter cache staleness detector.

Compares the ND SQLite database modification time to the songwriter cache's
generated_at timestamp. Regenerates the cache if the DB is newer (Thread A
ran a cascade after the last cache build).

Usage:
    python3 scripts/regenerate_cache_if_stale.py [--force] [--dry-run]

Exit codes:
    0 = cache is fresh OR regeneration succeeded
    1 = regeneration needed and failed
    2 = DB or cache file missing
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.expanduser(
    "~/Projects/cowritecompass/ND_DB__PIN26C1X__POST_RUN26C59__WORKING.sqlite"
)
CACHE_PATH = os.path.join(PROJECT_DIR, "public", "data", "songwriter_cache.json")
UPDATE_SCRIPT = os.path.join(SCRIPT_DIR, "update_songwriter_cache.py")


def parse_iso(s: str) -> datetime | None:
    if not s:
        return None
    try:
        # Handle both Z-suffix and offset formats
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def main():
    force = "--force" in sys.argv
    dry_run = "--dry-run" in sys.argv

    # 1. Check inputs exist
    if not os.path.exists(DB_PATH):
        print(f"ERROR: ND DB not found at {DB_PATH}", file=sys.stderr)
        return 2
    if not os.path.exists(CACHE_PATH):
        print(f"WARN: cache file missing — will generate fresh")
        if dry_run:
            return 2
        return run_regen()

    # 2. Read DB mtime (wall clock)
    db_mtime = datetime.fromtimestamp(os.path.getmtime(DB_PATH), tz=timezone.utc)

    # 3. Read cache generated_at from meta
    try:
        with open(CACHE_PATH) as f:
            cache = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"WARN: cannot parse cache ({e}) — will regenerate")
        if dry_run:
            return 2
        return run_regen()

    cache_ts_raw = (cache.get("meta") or {}).get("generated_at", "")
    cache_ts = parse_iso(cache_ts_raw)
    if not cache_ts:
        print(f"WARN: cache has no parseable generated_at ({cache_ts_raw!r}) — will regenerate")
        if dry_run:
            return 0
        return run_regen()

    # Normalize both to UTC aware datetimes for comparison
    if cache_ts.tzinfo is None:
        cache_ts = cache_ts.replace(tzinfo=timezone.utc)

    # 4. Compare
    age_hours = (db_mtime - cache_ts).total_seconds() / 3600
    print(f"DB mtime:      {db_mtime.isoformat()}")
    print(f"Cache built:   {cache_ts.isoformat()}")
    print(f"Delta (h):     {age_hours:+.1f}")

    writers_count = len(cache.get("writers", {}))
    with_pub = sum(1 for w in cache.get("writers", {}).values() if w.get("publisher"))
    print(f"Cache size:    {writers_count} writers ({with_pub} with publisher)")

    if force:
        print("--force supplied — regenerating regardless of staleness")
    elif db_mtime <= cache_ts:
        print("Cache is fresh — DB has not been modified since last build")
        return 0
    else:
        print(f"Cache is STALE — DB is {age_hours:.1f}h newer than cache")

    if dry_run:
        print("--dry-run: would regenerate but not touching disk")
        return 0

    return run_regen()


def run_regen() -> int:
    print(f"Running {UPDATE_SCRIPT}...")
    try:
        result = subprocess.run(
            [sys.executable, UPDATE_SCRIPT],
            check=True,
            capture_output=True,
            text=True,
        )
        # Print the script's output
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        print("Regeneration succeeded.")
        return 0
    except subprocess.CalledProcessError as e:
        print(f"ERROR: update_songwriter_cache.py failed with exit {e.returncode}", file=sys.stderr)
        print(e.stdout, file=sys.stderr)
        print(e.stderr, file=sys.stderr)
        return 1
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
