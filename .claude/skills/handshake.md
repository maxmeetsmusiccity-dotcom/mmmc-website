---
name: handshake
description: "Cross-thread conflict prevention. Use this skill before touching any file that another thread might also touch, before reading cross-thread signal files, before any merge, or whenever you're unsure whether another thread is working in the same area. Triggers on: editing shared files (nd-components.js, middleware.js, nav.css), reading cross_thread/ signals, merge operations, or any moment of uncertainty about file ownership. This skill exists because 6 parallel threads on overlapping repos create a constant collision risk. Thread A owns main but Thread UI's branch will merge into main. Thread G reads from the same DB Thread A writes to. Clear handshake protocols prevent silent conflicts."
---

# Cross-Thread Handshake

## The Thread Ownership Map

| Thread | Repo | Branch | Writes to |
|--------|------|--------|-----------|
| A (Data) | cowritecompass | main | scripts/*.py, workers/src/, SQLite DB, cross_thread/ |
| UI (Frontend) | cowritecompass-thread-ui | thread-ui/presentation-layer | *.html, nd-components.*, middleware.js, docs/ |
| F (CWC) | cowrite-compass | main | CWC frontend, demo bundle, verify scripts |
| G (Pitch) | cowritecompass | thread-g/pitch-deck | visualizations/, docs/ on own branch |
| C (NMF) | mmmc-website | main | Entire repo (separate from ND) |
| D (Archive) | truth-smart-archive | main | Entire repo (separate from ND) |

## Before Editing ANY File

### 1. Check ownership
Is this file in your thread's write zone? If not, STOP. You don't touch it.

### 2. Check recent activity
```bash
git log --oneline -5 -- path/to/file
```
If another thread committed to this file in the last 24 hours, proceed with extra caution.

### 3. Check for active signals
```bash
ls ~/Projects/cowritecompass/cross_thread/ 2>/dev/null
```
If there's a signal addressed to you, read it before proceeding — it may change your plan.

## Before Consuming a Cross-Thread Signal

1. Read the signal file completely
2. Verify the signal's claims (e.g., if Thread A says "bundle rebuilt," check that the file exists and has recent timestamps)
3. Act on the signal
4. Delete the signal file and commit the deletion:
```bash
rm cross_thread/from_X_to_Y__topic.md
git add cross_thread/
git commit -m "[THREAD-Y] Consumed signal from Thread X: topic"
git push
```

## Before Any Merge Operation

1. Verify you're on the correct branch
2. `git fetch origin` to get latest state
3. Check for conflicts: `git merge --no-commit --no-ff origin/target` then inspect
4. If conflicts exist: resolve carefully, verify each resolution makes sense
5. After merge: run the FULL test suite, not a subset

## The Shared Files That Need Extra Care

These files are touched by multiple threads or affect multiple surfaces:
- `nd-components.js` / `nd-components.css` — shared UI library
- `middleware.js` — auth bypass affects all pages
- `nav.css` — navigation affects all pages (Max owns this)
- `cross_thread/` — signal directory
- The SQLite database — Thread A writes, everyone reads

**If you need to modify a shared file that's outside your write zone:** don't. Write a signal file requesting the owning thread to make the change.
