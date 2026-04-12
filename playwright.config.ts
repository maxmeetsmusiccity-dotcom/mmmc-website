import { defineConfig } from '@playwright/test';

// Wave 6 Block 4: E2E_API_BASE was documented as the way to run the suite
// against production, but prior to this config change it was only consumed
// by the /api/songwriter-match tests inside bridge-card-funnel.spec.ts. Page
// navigation still used the hardcoded localhost baseURL, so the claimed
// "30/30 against live prod" runs were actually split-brain: API tests hit
// prod, page tests hit localhost. Now when E2E_API_BASE is set we honor it
// for both baseURL and skip the local webServer.
const E2E_API_BASE = process.env.E2E_API_BASE;

export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/**/*.spec.ts', 'mobile.spec.ts'],
  timeout: 60000,
  use: {
    baseURL: E2E_API_BASE || 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: E2E_API_BASE
    ? undefined
    : {
        command: 'npx vite preview --port 4173',
        port: 4173,
        reuseExistingServer: true,
      },
});
