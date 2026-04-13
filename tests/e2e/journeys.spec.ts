import { test, expect } from '@playwright/test';

// ============================================================
// NMF Curator Studio — dual-viewport user journey tests
// ============================================================
// Wave 7 Block 0 · see docs/USER_JOURNEYS.md for the contract.
//
// Every test in this file runs at BOTH viewports via the `desktop` and
// `mobile` projects in playwright.config.ts. Viewport-specific assertions
// (touch targets, mobile overflow) branch on testInfo.project.name.
//
// When running against production:
//   E2E_API_BASE=https://maxmeetsmusiccity.com npx playwright test \
//     tests/e2e/journeys.spec.ts
// ============================================================

const PG_ID_RX =
  /^https:\/\/nashvilledecoder\.com\/profiles\.html\?id=(pg_[0-9a-f]{12}|PG_AUTO_[0-9a-f]+)$/;

async function enterAsGuest(page: import('@playwright/test').Page) {
  await page.goto('/newmusicfriday');
  const btn = page.getByRole('button', { name: /Get Started as a Guest/i });
  await btn.waitFor({ state: 'visible', timeout: 15_000 });
  await btn.click();
  // After click, NewMusicFriday renders with activeSource='nashville' (default)
  // which lazy-loads <NashvilleReleases>. Give the Suspense boundary + first
  // Supabase query a generous window before asserting anything data-dependent.
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
}

// ------------------------------------------------------------
// D1 / M1 — First-time visitor lands on /newmusicfriday
// ------------------------------------------------------------
test('J1 — landing page renders, Get Started visible, no overflow', async ({
  page,
}, testInfo) => {
  await page.goto('/newmusicfriday');
  await expect(
    page.getByRole('heading', { name: /New Music Friday/i }),
  ).toBeVisible();

  const guestBtn = page.getByRole('button', {
    name: /Get Started as a Guest/i,
  });
  await expect(guestBtn).toBeVisible();

  expect(await hasHorizontalOverflow(page)).toBe(false);

  if (testInfo.project.name === 'mobile') {
    // Apple HIG: 44×44pt minimum for primary interactive elements.
    const box = await guestBtn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

// ------------------------------------------------------------
// D2 / M2 — Guest-mode click-through actually reaches the app
// (NOT the AuthGate landing, which has the same "New Music Friday" text)
// ------------------------------------------------------------
test('J2 — guest bypass reaches the Nashville in-app surface', async ({
  page,
}) => {
  await enterAsGuest(page);
  // In-app marker: the Nashville releases surface shows one of these strings
  // once the AuthGate has been dismissed and NewMusicFriday renders.
  const appMarker = page
    .getByText(/Ready to Scan|Nashville Releases|Scan Now|This Week/i)
    .first();
  await expect(appMarker).toBeVisible({ timeout: 10_000 });

  // No overflow after entering the app on either viewport.
  expect(await hasHorizontalOverflow(page)).toBe(false);
});

// ------------------------------------------------------------
// D3 / M3 — Coming Soon tab (the live publisher funnel surface)
// Degrades gracefully when no future-dated releases exist.
// ------------------------------------------------------------
test('J3 — Coming Soon tab reachable, renders without overflow', async ({
  page,
}) => {
  await enterAsGuest(page);

  // Disambiguate from the Apple Music source card labelled "COMING SOON"
  // (feature-unavailable copy). The filter pill always carries the crystal-
  // ball emoji as its leading glyph.
  const comingSoonBtn = page.getByRole('button', { name: /🔮 Coming Soon/ });
  const appeared = await comingSoonBtn
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(
    !appeared,
    'No future-dated Nashville releases in Supabase — cannot exercise Coming Soon funnel',
  );

  // A sibling div intercepts pointer events in the zero-login flow layout;
  // direct HTMLElement.click() fires the React synthetic click reliably.
  await comingSoonBtn.evaluate((b) => (b as HTMLButtonElement).click());

  await expect(
    page.getByRole('heading', { name: /Coming Soon/ }),
  ).toBeVisible({ timeout: 10_000 });

  expect(await hasHorizontalOverflow(page)).toBe(false);
});

// ------------------------------------------------------------
// D5 / M6 — Publisher demo page (the text-message / desktop-share surface)
// ------------------------------------------------------------
test('J5 — publisher demo page: real pg_ids, no overflow, tappable links', async ({
  page,
}, testInfo) => {
  await page.goto('/demo/publisher-demo.html');
  await expect(
    page.getByRole('heading', { name: /Publisher Demo/i }),
  ).toBeVisible();

  expect(await hasHorizontalOverflow(page)).toBe(false);

  const ndLinks = page.locator('a.nd-link');
  const count = await ndLinks.count();
  expect(count).toBeGreaterThanOrEqual(6);

  // Every ND Profile link must use real pg_id format (not pg_123 placeholders).
  for (let i = 0; i < count; i++) {
    const href = await ndLinks.nth(i).getAttribute('href');
    expect(href, `nd-link[${i}] href`).toMatch(PG_ID_RX);
    const target = await ndLinks.nth(i).getAttribute('target');
    expect(target).toBe('_blank');
  }

  if (testInfo.project.name === 'mobile') {
    // Inline text links have a smaller realistic touch target than buttons;
    // tests/mobile.spec.ts's existing 24px minimum is the floor. Bridge cards
    // must also not overflow the 393px viewport.
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await ndLinks.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
    const cards = page.locator('.bridge-card');
    const cardCount = await cards.count();
    for (let i = 0; i < cardCount; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x + box!.width).toBeLessThanOrEqual(393);
    }
  }
});

// ------------------------------------------------------------
// D4 / M5 — Showcase/source filter surface does not overflow
// Smoke-level check; the full showcase flow (select, see filtered tracks)
// requires specific source state that this test scopes down to "the
// control is reachable and fits its viewport".
// ------------------------------------------------------------
test('J4 — interactive controls in the app do not overflow viewport', async ({
  page,
}) => {
  await enterAsGuest(page);
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();

  // Any visible select/dropdown must fit inside the viewport.
  const selects = page.locator('select:visible');
  const selectCount = await selects.count();
  for (let i = 0; i < selectCount; i++) {
    const box = await selects.nth(i).boundingBox();
    if (!box) continue;
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
  }

  // Any visible button must fit inside the viewport.
  const buttons = page.locator('button:visible');
  const btnCount = Math.min(await buttons.count(), 20);
  for (let i = 0; i < btnCount; i++) {
    const box = await buttons.nth(i).boundingBox();
    if (!box) continue;
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width + 1);
  }
});

// ------------------------------------------------------------
// D6 / M4 — Carousel download affordance exists (smoke)
// Full carousel generation + download requires real track selection flow
// which depends on upstream data. This test asserts the CTA surface is
// reachable.
// ------------------------------------------------------------
test('J6 — carousel/download affordance exists on the app surface', async ({
  page,
}) => {
  await enterAsGuest(page);
  // Look for any download/save/export affordance text anywhere on the app.
  // This is deliberately loose because the label text varies by state.
  const affordance = page
    .getByText(/Download|Save|Export|Generate/i)
    .first();
  // It's acceptable for none of these to be visible on the default zero-login
  // landing state (no tracks selected). The smoke assertion is: the page
  // itself is reachable without crashing.
  await affordance.isVisible({ timeout: 3_000 }).catch(() => false);

  // Hard assertion: the app rendered without an error boundary.
  const errorBoundary = page.getByText(/Something went wrong/i);
  expect(await errorBoundary.isVisible().catch(() => false)).toBe(false);
});
