---
name: deploy
description: "Full deployment protocol for any production push. Use this skill BEFORE any vercel deploy --prod, wrangler deploy, branch merge to main, or production promote. Triggers on: deploy, publish, merge to main, promote, go live, push to production, or any action that changes what real users see. This skill exists because the demo-night disaster of April 13 was a deployment failure: CWC was promoted from preview to production but the preview bypass cookie expired mid-demo, leaving publishers staring at a 401. A proper deploy protocol with pre-deploy checks, post-deploy cold-visitor verification, and a rollback plan would have caught it in 30 seconds."
---

# Deploy Protocol

## The Failure This Prevents

**Demo-Night Disaster (Thread F, April 13, 10 PM):**
CWC was promoted from preview to production at 5 PM. At 10 PM, Max demoed to publishers. The preview bypass cookie had expired. Publishers hit a 401 auth wall. A post-deploy cold-visitor probe would have caught it immediately. Instead, nobody verified the production URL without cookies after the promote.

## Pre-Deploy Checklist (EVERY production deploy)

### 1. Tests pass on the EXACT artifact being deployed
```bash
npm run build  # or the repo-specific build command
# Run the FULL test suite, not a subset
```
The artifact you just built is the artifact you deploy. No rebuilds between test and deploy.

### 2. Git state is clean and pushed
```bash
git status -s  # must be empty
git log --oneline origin/$(git branch --show-current)..HEAD  # must be empty (everything pushed)
```

### 3. Document what you're deploying
Write down (in your response or a temp file):
- Current production state (what's live right now)
- What's changing (specific commits/features)
- Rollback plan (how to revert if it breaks)

### 4. Deploy
```bash
npx vercel deploy --prod  # or wrangler deploy, or git push to trigger CI
```

### 5. Post-Deploy Cold-Visitor Verification (NON-NEGOTIABLE)
Within 60 seconds of deploy completing:
```bash
# Hit EVERY user-facing URL with zero cookies
curl -s -o /dev/null -w "%{http_code}" "https://production-url.com"
# Must return 200. Not 301, not 302, not 401.
```
For UI deploys: take a Playwright screenshot of the production URL at BOTH viewports (1440×900 + 393×852). Look at it.

### 6. Verify the specific change you deployed
Don't just verify "the site loads." Verify that the SPECIFIC feature you deployed is working:
- If you deployed a data change: query the production API and inspect actual values
- If you deployed a UI change: screenshot the specific component that changed
- If you deployed an auth change: test both authenticated AND unauthenticated paths

### 7. Declare and document
Only after steps 1-6 pass:
```
DEPLOY VERIFIED: [url] at [timestamp]
- Cold-visitor: HTTP 200 ✅
- Feature verified: [specific check] ✅
- Screenshot: [path] ✅
- Rollback: [how to revert if issues surface later]
```

## Rollback Protocol

If post-deploy verification fails:
1. Do NOT debug in production
2. Revert immediately: `vercel rollback` or `git revert HEAD && git push`
3. Verify rollback succeeded (cold-visitor probe again)
4. THEN diagnose what went wrong in the local environment
5. Fix, re-test, re-deploy through the full protocol

## The Rule

**No deploy is complete until a cold-visitor hits the production URL and gets a 200.** No cookies. No bypass headers. No pre-authenticated state. The exact URL the user will click, from a clean browser.
