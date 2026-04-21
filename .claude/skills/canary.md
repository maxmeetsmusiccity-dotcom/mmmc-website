---
name: canary
description: "After any data change — database writes, rec engine rebuilds, profile exports, demo bundle generation, cascade runs, JSON exports — inspect the ACTUAL VALUES, not just row counts. Use this skill after every INSERT, UPDATE, DELETE, or any script that modifies data. Triggers on: any SQL write operation, any Python script that modifies the database, any export/rebuild command, cascade runs, bundle regeneration, or any claim that 'the data looks right.' This skill exists because Thread A shipped a rec engine where Ava's top-5 recommendations included Eminem, John Lennon, and Woody Guthrie — technically the right row count, catastrophically wrong values. Row counts lie. Names don't."
---

# Data Quality Gate

## After ANY database write:

### Step 1: Count verification (necessary but NOT sufficient)
```python
c.execute('SELECT COUNT(*) FROM table_name')
```

### Step 2: Value inspection (THE ACTUAL GATE)
```python
c.execute('SELECT col1, col2, col3 FROM table_name ORDER BY sort_col DESC LIMIT 10')
for row in c.fetchall():
    print(row)
# Ask: Do these names make sense? Are the numbers plausible?
```

### Step 3: Canary checks (known-good entities)
```python
# Ashley Gorley (the canonical canary)
c.execute('SELECT total_credits, charting_songs, no1_songs FROM dim_writer_v2 WHERE person_group_id=?', ('pg_df752e8c5e64',))
r = c.fetchone()
assert r[0] >= 750 and r[1] >= 110 and r[2] >= 80, f'GORLEY GATE FAILED: {r}'
```

### Step 4: Impossible value checks
- No future dates (`last_credit_year > current_year`)
- No negative credit counts
- No empty display_names
- No deceased in active recommendation lists
- No genre mismatches in top-K for Nashville seeds

## After REC ENGINE changes:
Query Ava's actual rec NAMES (not counts). Read every name. Is Eminem there? Is John Lennon there? Are ≥4/5 WRITER recs in the same genre as the seed?

## The question that gates everything:
**"If a VP of A&R saw these exact values right now, would they write a $10K check, close the tab, or screenshot it with a laughing emoji?"**
