---
name: debrief
description: "Session-end governance ritual producing 3 mandatory documents (accomplishment memo, exhaustion audit, top-10 recommendations) + continuity memo if health ≤ 6/10. Triggers on: approaching context limits, Max says 'wrap up' / 'checkpoint' / 'how are you doing', or context health drops to 6/10. Every session ends with this skill — no exceptions. Forensic, not summary. Count items, name failures, reference evidence."
---

# MMMC Session Governance & Continuity Management

## Overview
This skill automates the session-end governance ritual that Max requires of every Claude Code thread. It ensures consistent, honest, comprehensive handoff documentation regardless of thread fatigue level.

## When to use
- At the end of every Claude Code session (triggered by Max or by approaching context limits)
- When context health drops to 6/10 or below
- When Max says "wrap up", "checkpoint", "how are you doing", or "prepare for handoff"
- Automatically when the session has been running for 90+ minutes

## The Three Documents

Every session produces exactly three documents. No exceptions.

### Document 1: Accomplishment Memo
**Path:** `/tmp/thread_[ID]_wave[N]_accomplishment_memo.md`

Template:
```markdown
# Thread [ID] — Wave [N] Accomplishment Memo
## [Date] · [duration] session · [N] commits

## Commits (oldest → newest)
| # | Hash | Message | Files | Verified |
|---|------|---------|-------|----------|

## What shipped
[For each commit: what it does, why it matters, how it was verified]

## What's live on production
[URLs that changed, with HTTP status verification]

## Screenshots captured
[Path to every screenshot taken during the session, with description]

## Tests at session end
| Gate | Result | Notes |
|------|--------|-------|

## Before / After
| Metric | Before | After |
|--------|--------|-------|
```

### Document 2: Exhaustion Audit
**Path:** `/tmp/thread_[ID]_wave[N]_exhaustion_audit.md`

Template:
```markdown
# Thread [ID] — Wave [N] Exhaustion Audit
## [Date] · Honest self-assessment

## Context Health: [N] / 10

### Rubric applied:
- 9-10: Sharp, first-try edits, no mistakes. Safe for another wave.
- 7-8: Mostly clean, 1-2 loops. Small follow-ups OK.
- 5-6: 2+ caught mistakes, surgical edits without full reads, deferral creep. STOP.
- ≤4: Hazardous. End immediately.

### Technical execution: [N]/10
[Specific evidence]

### Creative/strategic alignment: [N]/10
[Specific evidence]

### Context pressure: [N]/10
[Specific evidence — how long are tool calls taking? Am I re-reading files I already read?]

### Focus / drift: [N]/10
[Am I still on the original mission or have I drifted?]

## What got missed
[Numbered list, each with: what, why it was missed, severity]

## What was partially completed
[Numbered list, each with: what, how far it got, what remains]

## What was deferred (with named blockers)
[Numbered list. If there's no named blocker, it wasn't really deferred — it was avoided.]

## Mistakes caught
[Every mistake, including ones caught before they shipped. Be ruthless.]

## Predecessor pattern analysis
[Did I repeat any failure pattern from the previous session's audit?]

## Honest call
[One paragraph: should this thread continue or hand off?]
```

### Document 3: Top 10 Recommendations
**Path:** `/tmp/thread_[ID]_wave[N]_top10_recommendations.md`

Template:
```markdown
# Thread [ID] — Wave [N] Top 10 Recommendations
## Risks to mitigate + opportunities to seize
## Ordered by impact × ease-of-implementation

## [1-10, each with:]

### [N]. [Title]

**Problem / Opportunity:**
[What happened or what's missing]

**Why it matters:**
[Business impact, not just technical concern]

**Permanent mitigation / seizure strategy:**
[The fix that survives infinite future sessions]

**Concrete first step:**
[Executable in under 15 minutes by a fresh thread]

**Cost estimate:**
[Minutes, with what's included]

---

## Summary table
| # | Recommendation | Cost | Impact | Category |
|---|---|---|---|---|

## If you can only do 3: [#X, #Y, #Z]
## If you want the biggest product win: [#W]
```

### Bonus Document 4: Continuity Memo (if health ≤ 6/10)
**Path:** `/tmp/thread_[ID]_wave[N+1]_continuity_memo.md`

This is a FULL session prompt for a fresh Claude Code thread. It must be comprehensive enough that the new thread:
- Knows exactly what state it's inheriting
- Has verification commands to confirm state
- Understands every design decision that was made (and why not to re-litigate them)
- Has the top-10 improvements baked in as standing rules
- Has enough mission detail to start working immediately
- Is MORE focused and MORE powerful than the outgoing thread

Include:
1. "WHO YOU ARE" section with repo, branch, file ownership
2. "FIRST 90 SECONDS" state verification block
3. "WHAT SHIPPED" summary from the accomplishment memo
4. "CARRIED-OVER DEBT" from the exhaustion audit
5. "DESIGN DECISIONS (don't re-litigate)" list
6. "RISK MITIGATIONS BAKED IN" from the top-10
7. "MISSION QUEUE" with expandable missions
8. "HARD RULES" (thread-specific + universal)
9. "PACING TARGET" with time allocations
10. "CONTEXT HEALTH TARGET" with specific strategies to stay above 7/10

## Automation Hooks

### Pre-commit verification
Before every commit, the thread should:
```bash
# 1. Verify files actually changed
git diff --stat  # confirm expected files are modified

# 2. Run relevant tests
# (thread-specific — Python tests for A, tsc+vitest for C, etc.)

# 3. Syntax validation
# For JS: find . -name "*.js" -newer .git/index | xargs -I{} node -c "{}"
# For JSON: find . -name "*.json" -newer .git/index | xargs -I{} python3 -c "import json; json.load(open('{}'))"
# For Python: find . -name "*.py" -newer .git/index | xargs -I{} python3 -c "compile(open('{}').read(),'{}','exec')"
```

### 30-minute checkpoint
Every 30 minutes, pause and assess:
- Am I still on the primary mission?
- Have I drifted into scope that wasn't assigned?
- What's my context health right now?
- Should I checkpoint and report to Max?

### Signal file check
Periodically check `~/Projects/cowritecompass/cross_thread/` for signals from other threads.

## Rules for the Governance Skill

1. **Honesty over optimism.** A 5/10 that's honest is infinitely more valuable than a 7/10 that's aspirational.
2. **Count items.** If the plan had 8 items and you completed 5, say "5/8" not "most items completed."
3. **Name the failures.** If something was deferred, name the blocker. If there is no blocker, say "I avoided this because [honest reason]."
4. **Reference evidence.** Every claim in the audit should reference a commit hash, a screenshot path, a test output, or a specific file:line.
5. **Don't summarize the session — forensic it.** The strategy thread reads these to make resource allocation decisions. Vague summaries are useless.
