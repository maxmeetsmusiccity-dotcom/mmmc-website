---
name: recon
description: "Verify what you're actually looking at before modifying it. Use this skill BEFORE editing any file, component, database table, API route, or configuration. Triggers on: any Edit/Write/str_replace operation, any SQL UPDATE/DELETE/ALTER, any file modification, or when planning changes to code you haven't read in this session. This skill prevents the class of bugs where a thread edits the wrong file, modifies a component that isn't rendered in the target state, uses a stale reference as ground truth, or deletes code without checking for downstream references. Thread C lost 25 minutes editing a component that wasn't even mounted. Thread D used a stale schema file and produced a broken bootstrap. Always verify before you modify."
---

# Pre-Edit Reconnaissance

## Before editing a UI COMPONENT:
1. Run a Playwright diagnostic to confirm which component is actually rendered in the target state
2. `document.querySelectorAll('[data-testid],[data-component]')` — if your target doesn't appear, you're editing the wrong file
3. Trace the render path: `grep -rn "phase.*results\|state.*ready" src/`

## Before editing a DATABASE TABLE:
1. Check the LIVE schema, not a file: `PRAGMA table_info(table_name)`
2. Sample the data you're about to change: `SELECT * FROM table WHERE [condition] LIMIT 5`
3. For DELETE: count rows BEFORE executing. Is the count expected?

## Before editing an API ROUTE:
1. Find ALL code paths: `grep -rn "endpoint_pattern" workers/src/ api/`
2. Identify fallback/alternate paths — your fix must cover ALL of them
3. Capture current behavior: `curl -s "https://api/endpoint" | head -30`

## Before DELETING any code:
1. Grep for ALL references: `grep -rn "function_name" . --include="*.js" --include="*.py" --include="*.html"`
2. Check for dynamic references (string concatenation, eval, template literals)
3. If deleting a file, check imports/requires

## Before using ANY reference file as input:
1. Check the file's age: `stat -f "%Sm" file`
2. If it describes a live system, verify against the live system
3. If older than 48 hours and describes something that changes, treat as SUSPECT

**The one-line summary: Before you change anything, answer "Am I looking at what I think I'm looking at?" If you can't prove it, probe first.**
