---
name: investigate
description: "Structured investigation protocol for when Max reports a bug, shows a screenshot of something wrong, or says 'this is broken.' Use this skill BEFORE writing any fix code. Triggers on: bug reports, error screenshots, 'this is broken', 'this doesn't work', 'look at this', or any evidence of unexpected behavior. This skill exists because when Max shows evidence of a problem, the instinct is to jump to explaining or fixing. But the right first move is always to REPRODUCE the bug from Max's exact perspective. Thread A's anti-gaslighting rule says: 'When Max shows evidence, never dismiss with technical explanations.' This skill operationalizes that rule."
---

# Investigate Protocol

## The Rule This Operationalizes

**Anti-gaslighting (Constitutional Rule #21):** When Max shows evidence of a problem, never dismiss it with technical explanations. Investigate. Ask "is this a symptom of something bigger?"

## The Protocol (in order, no skipping)

### Step 1: REPRODUCE (before anything else)
Reproduce the exact bug from Max's perspective:
- If Max showed a screenshot: navigate to the same URL, same viewport, same state
- If Max showed a data issue: run the same query, look at the same rows
- If Max showed an error: trigger the same action that caused it
- If you CANNOT reproduce: say so explicitly. "I cannot reproduce this from [what I tried]. Can you show me the exact steps?"

Do NOT write a single line of fix code until you've seen the bug with your own eyes.

### Step 2: TRACE the root cause
Once reproduced:
- Where does the bad data come from? Trace upstream.
- Which code path produces this output? Find the exact file:line.
- Is this an isolated bug or a symptom of something systemic?
- When was this introduced? `git log` the relevant files.

### Step 3: ASSESS the blast radius
- How many users/seeds/pages are affected? Not just the one Max showed you.
- Is there a class of similar bugs hiding behind this one?
- What's the worst-case impact if this goes unfixed?

### Step 4: PROPOSE the fix (don't implement yet)
Tell Max:
- What you found (root cause, with evidence)
- What the fix is (specific, with file:line)
- What the blast radius is (who else is affected)
- What the risk of the fix is (could it break something else?)
- How you'll verify the fix worked

### Step 5: GET APPROVAL, then implement
Max approves → implement → run the `canary` and `eyeball` skills to verify.

## What NOT To Do

- "That's probably just a caching issue" (dismissal without evidence)
- "Let me fix that real quick" (fixing without understanding)
- "That shouldn't be happening, the tests pass" (gaslighting)
- "I'll add a special case for that" (band-aid without root cause)

## What TO Do

- "Let me reproduce that from your exact path"
- "I can see it. The root cause is [X] at [file:line]. Here's why..."
- "This affects [N] other cases. Here's the full blast radius."
- "Here's the fix. Want me to proceed?"
