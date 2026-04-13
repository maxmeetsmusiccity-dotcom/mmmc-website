import { defineConfig } from '@playwright/test';

// Wave 6 Block 4: E2E_API_BASE was documented as the way to run the suite
// against production, but prior to this config change it was only consumed
// by the /api/songwriter-match tests inside bridge-card-funnel.spec.ts. Page
// navigation still used the hardcoded localhost baseURL, so the claimed
// "30/30 against live prod" runs were actually split-brain: API tests hit
// prod, page tests hit localhost. Now when E2E_API_BASE is set we honor it
// for both baseURL and skip the local webServer.
const E2E_API_BASE = process.env.E2E_API_BASE;

// Wave 7 Block 0: dual-viewport enforcement. The publisher funnel starts on
// a phone — if a test passes on desktop but fails on mobile, the funnel is
// broken. The `desktop` project runs everything under tests/e2e at 1440×900.
// The `mobile` project runs the journey spec + existing mobile.spec.ts at
// 393×852 with touch events enabled. Existing e2e specs were written for
// desktop, so we deliberately do NOT run them at mobile — that would produce
// noise instead of signal. New viewport-agnostic journeys go in
// tests/e2e/journeys.spec.ts and are exercised at BOTH viewports.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: E2E_API_BASE || 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: ['e2e/**/*.spec.ts'],
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      testMatch: ['e2e/journeys.spec.ts', 'mobile.spec.ts'],
      use: {
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // Wave 7 Block 0: force a fresh `vite build` before the preview server
  // starts, and disable `reuseExistingServer` so Playwright can never run
  // against a stale `dist/`. The Wave 6 Block 4 "30/30 passing" false-green
  // was caused by exactly that combination — dist/ held Wave 5 placeholder
  // pg_ids and a preview server was already listening on :4173, so the
  // tests passed against out-of-date code.
  webServer: E2E_API_BASE
    ? undefined
    : {
        command: 'npx vite build && npx vite preview --port 4173',
        port: 4173,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
