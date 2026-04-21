---
name: cascade
description: "Safety protocol for bulk data operations: cascade runs, engine rebuilds, R2 uploads, weekly rotations, demo bundle exports, migration applies, or any operation that touches more than 1000 rows. Use this skill BEFORE running any long-running data script or any operation that modifies data in bulk. Triggers on: cascade_runner.py, cwc_weekly_rotate.py, cwc_v3_engine.py, cwc_export_demo_recs.py, build_catalog_analysis.py, any SQL that affects 1000+ rows, R2 upload scripts, or any command expected to run longer than 60 seconds. This skill prevents: foreground-blocked terminals, missed Gorley gates after bulk writes, silent data corruption, and the 'I didn't realize it was still running' class of failures."
---

# Cascade & Bulk Operation Safety

## Pre-Run Checklist

### 1. Snapshot the current state
Before any bulk operation, capture the state you might need to roll back to:
```python
# Record canary values BEFORE the operation
python3 -c "
import sqlite3
c = sqlite3.connect('YOUR_DB.sqlite').cursor()
c.execute('SELECT total_credits, charting_songs, no1_songs FROM dim_writer_v2 WHERE person_group_id=\"pg_df752e8c5e64\"')
print('Gorley BEFORE:', c.fetchone())
c.execute('SELECT COUNT(*) FROM cwc_weekly_recs_current')
print('Weekly recs BEFORE:', c.fetchone()[0])
"
```

### 2. Background the operation
NEVER run a 60+ second operation in the foreground.
```bash
nohup python3 scripts/your_script.py > /tmp/operation_log.txt 2>&1 &
echo $! > /tmp/operation_pid.txt
tail -f /tmp/operation_log.txt
```

### 3. Monitor without blocking
```bash
# Check progress
tail -20 /tmp/operation_log.txt

# Check if still running
kill -0 $(cat /tmp/operation_pid.txt) 2>/dev/null && echo "Still running" || echo "Finished"
```

## Post-Run Checklist

### 4. Run the canary gate
```python
# Gorley gate — MUST pass after every cascade-modifying write
python3 -c "
import sqlite3
c = sqlite3.connect('YOUR_DB.sqlite').cursor()
c.execute('SELECT total_credits, charting_songs, no1_songs FROM dim_writer_v2 WHERE person_group_id=\"pg_df752e8c5e64\"')
r = c.fetchone()
print(f'Gorley AFTER: credits={r[0]} charting={r[1]} no1={r[2]}')
assert r[0] >= 750 and r[1] >= 110 and r[2] >= 80, 'GORLEY GATE FAILED — INVESTIGATE IMMEDIATELY'
"
```

### 5. Run the data quality gate (`canary` skill)
Don't just check Gorley. Inspect actual values from whatever tables the operation modified.

### 6. Verify row counts are in expected range
If a cascade run drops profiles by >10%, STOP. That's the profile count gate — refuse R2 upload on >10% profile drop.

### 7. Check for impossible values
Future dates, negative counts, NULL display names, deceased in active lists.

## The Rules
- **Never foreground-block on a 60+ second operation.** Always `nohup` + tail.
- **Gorley gate after every cascade-modifying write.** No exceptions.
- **Profile count gate before R2 upload.** >10% drop = refuse upload, investigate.
- **Snapshot before, verify after.** Every bulk operation is a before/after comparison.
