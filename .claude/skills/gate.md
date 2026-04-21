---
name: gate
description: "Mandatory verification checklist before any git commit. Use this skill EVERY TIME you are about to run git add or git commit. Triggers on: git add, git commit, 'ready to commit', 'ship this', 'push this', staging files, or any indication that code is about to be committed. This skill prevents the single largest class of bugs across MMMC threads: code that passes automated checks but ships broken because the author didn't look at it, didn't run the full test suite, or didn't verify the file actually changed on disk. ALWAYS run this checklist. No exceptions."
---

# Pre-Commit Gate

## Step 1: Verify files actually changed
```bash
git diff --stat
```
For EVERY file you intend to commit, confirm it appears in the diff. If a file you edited is NOT in the diff, your edit did not land. Re-do the edit. For Edit tool calls: `git diff <specific_file_path>` — empty diff means the edit failed silently.

## Step 2: Run the appropriate test suite
- ND: `python3 scripts/run_tests.py`
- NMF: `npx tsc -b && npx vitest run`
- Smart Archive: `npm run build && npx vitest run`
- CWC: `npm run build`
Do NOT substitute a weaker check. `compile()` is NOT a substitute for `run_tests.py`.

## Step 3: Syntax-validate every changed file
```bash
git diff --cached --name-only --diff-filter=ACM | grep '\.js$' | xargs -I{} node -c "{}"
git diff --cached --name-only --diff-filter=ACM | grep '\.json$' | xargs -I{} python3 -c "import json; json.load(open('{}'))"
git diff --cached --name-only --diff-filter=ACM | grep '\.py$' | xargs -I{} python3 -c "compile(open('{}').read(),'{}','exec')"
```

## Step 4: Visual verification (for UI-affecting files)
If commit touches .html, .css, .tsx, .jsx: take Playwright screenshots at BOTH viewports (1440×900 + 393×852). LOOK at them. Save to `/tmp/pre_commit_screenshots/[description]/`. Reference paths in commit message.

## Step 5: Construct commit message FROM evidence
Build from `git diff --stat` output, not from memory. Include what changed, how verified, screenshot paths for UI.

## Step 6: Stage specific files only
```bash
git add <file1> <file2>  # NEVER git add -A or git add .
```

## Step 7: Commit and push
```bash
git commit -m "[THREAD-WAVE-BLOCK] Description — verified: [test suite], [screenshot if UI]"
git push
```

## ABORT if: file not in diff, tests fail, syntax error, UI change with no screenshot, can't explain commit in one sentence.
