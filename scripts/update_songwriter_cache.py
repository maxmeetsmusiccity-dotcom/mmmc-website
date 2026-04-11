#!/usr/bin/env python3
"""
Regenerate songwriter_cache.json from Nashville Decoder's database.

IMPORTANT: Opens the ND database in READ-ONLY mode.
Thread A may be writing simultaneously — SQLite WAL mode handles this safely.

Output: public/data/songwriter_cache.json
Format: { writers: {lowercase_name: SongwriterInfo}, aliases: {alias: canonical}, meta: {...} }
"""

import json
import os
import sqlite3
import sys
from datetime import datetime

DB_PATH = os.path.expanduser(
    "~/Projects/cowritecompass/ND_DB__PIN26C1X__POST_RUN26C59__WORKING.sqlite"
)
OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "data", "songwriter_cache.json",
)

MIN_CREDITS = 5  # Only include writers with 5+ credits

def main():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        sys.exit(1)

    # Open read-only (WAL mode safe for concurrent reads)
    try:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    except sqlite3.OperationalError:
        print("ERROR: database is locked — Thread A may be doing a heavy write.")
        print("Wait 5 seconds and retry (max 3 attempts).")
        sys.exit(1)

    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Main query: join tier, credits, charting, publisher, handle
    cur.execute("""
        SELECT
            t.pg_id,
            t.canonical_name,
            t.tier,
            COALESCE(c.total_credits, 0) as total_credits,
            COALESCE(c.writer_credits, 0) as writer_credits,
            COALESCE(cs.total_charting_songs, 0) as charting_songs,
            COALESCE(cs.no1_songs, 0) as no1_songs,
            COALESCE(cs.top10_songs, 0) as top10_songs,
            pa.current_publisher,
            sl.handle as ig_handle
        FROM dim_artist_tier_v1 t
        LEFT JOIN _mat_credit_count_deduped c ON c.person_group_id = t.pg_id
        LEFT JOIN _mat_writer_charting_songs_breakdown cs ON cs.pg_id = t.pg_id
        LEFT JOIN dim_publisher_affiliation_v1 pa ON pa.person_group_id = t.pg_id
        LEFT JOIN dim_social_links_v1 sl ON sl.pg_id = t.pg_id AND sl.platform = 'instagram'
        WHERE COALESCE(c.total_credits, 0) >= ?
    """, (MIN_CREDITS,))

    writers = {}
    aliases = {}
    pg_id_to_canonical = {}

    for row in cur.fetchall():
        pg_id = row["pg_id"]
        canonical = row["canonical_name"] or ""
        key = canonical.lower().strip()

        if not key or len(key) < 2:
            continue

        entry = {
            "pg_id": pg_id,
            "display_name": canonical,
            "charting_songs": row["charting_songs"],
            "no1_songs": row["no1_songs"],
            "top10_songs": row["top10_songs"],
            "total_credits": row["total_credits"],
            "publisher": row["current_publisher"],
            "tier": row["tier"],
            "ig_handle": row["ig_handle"],
        }

        # Dedup: keep the entry with more credits
        if key in writers:
            if entry["total_credits"] > writers[key]["total_credits"]:
                writers[key] = entry
        else:
            writers[key] = entry

        pg_id_to_canonical[pg_id] = key

    # Build alias map from publisher affiliations (songwriter_name → canonical)
    cur.execute("""
        SELECT songwriter_name, person_group_id
        FROM dim_publisher_affiliation_v1
    """)
    for row in cur.fetchall():
        alias_key = (row["songwriter_name"] or "").lower().strip()
        pg_id = row["person_group_id"]
        canonical = pg_id_to_canonical.get(pg_id)
        if canonical and alias_key and alias_key != canonical:
            aliases[alias_key] = canonical

    # Also add aliases from identity bridge (alternate names for the same person)
    try:
        cur.execute("""
            SELECT bm.person_group_id, t.canonical_name as member_name
            FROM bridge_identity_member_v2 bm
            JOIN dim_artist_tier_v1 t ON t.pg_id = bm.person_group_id
            WHERE bm.person_group_id IN (SELECT pg_id FROM _mat_writer_charting_songs_breakdown)
        """)
        for row in cur.fetchall():
            name = (row["member_name"] or "").lower().strip()
            canonical = pg_id_to_canonical.get(row["person_group_id"])
            if canonical and name and name != canonical and name not in writers:
                aliases[name] = canonical
    except Exception:
        pass  # Table might not exist in all DB versions

    conn.close()

    # Stats
    total = len(writers)
    with_publisher = sum(1 for w in writers.values() if w.get("publisher"))
    with_charting = sum(1 for w in writers.values() if w["charting_songs"] > 0)
    with_no1 = sum(1 for w in writers.values() if w["no1_songs"] > 0)
    marquee = sum(1 for w in writers.values() if w["tier"] == "marquee")

    meta = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "source_db": os.path.basename(DB_PATH),
        "min_credits": MIN_CREDITS,
        "total_writers": total,
        "with_publisher": with_publisher,
        "with_charting_songs": with_charting,
        "with_no1": with_no1,
        "marquee_tier": marquee,
        "aliases": len(aliases),
    }

    output = {"writers": writers, "aliases": aliases, "meta": meta}

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    print(f"Songwriter cache: {total} entries")
    print(f"  With publisher: {with_publisher} ({100*with_publisher/max(total,1):.1f}%)")
    print(f"  With charting songs: {with_charting}")
    print(f"  With #1 hits: {with_no1}")
    print(f"  Marquee tier: {marquee}")
    print(f"  Aliases: {len(aliases)}")
    if with_publisher < total * 0.05:
        print(f"  ⚠️  Publisher coverage very low ({with_publisher}/{total})")
        print(f"  Thread B's publisher enrichment SQL hasn't been applied yet")
        print(f"  REGENERATE this cache after Max confirms Thread A has applied publisher SQL")
    print(f"\nWritten to: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.1f} MB")

    # Spot check: Ashley Gorley
    gorley = writers.get("ashley glenn gorley") or writers.get("ashley gorley")
    if gorley:
        print(f"\nSpot check — Ashley Gorley:")
        print(f"  pg_id: {gorley['pg_id']}")
        print(f"  Credits: {gorley['total_credits']}")
        print(f"  Charting: {gorley['charting_songs']}")
        print(f"  #1 hits: {gorley['no1_songs']}")
        print(f"  Publisher: {gorley['publisher']}")
        print(f"  Tier: {gorley['tier']}")


if __name__ == "__main__":
    main()
