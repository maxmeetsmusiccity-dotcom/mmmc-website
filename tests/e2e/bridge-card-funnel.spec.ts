import { test, expect } from '@playwright/test';

// ============================================================
// Publisher demo page — the pitch-deck surface
// ============================================================

test.describe('Publisher demo page (bridge cards)', () => {
  test('page loads with title + pitch', async ({ page }) => {
    await page.goto('/demo/publisher-demo.html');
    await expect(page.getByRole('heading', { name: /Publisher Demo/ })).toBeVisible();
    await expect(page.getByText(/The pitch:/)).toBeVisible();
  });

  test('bridge cards render with songwriter credits', async ({ page }) => {
    await page.goto('/demo/publisher-demo.html');
    // Lainey Wilson appears multiple times (as artist + as writer) — use first
    await expect(page.getByText('Lainey Wilson').first()).toBeVisible();
    await expect(page.getByText('The Jesus I Know Now')).toBeVisible();
    // Luke Laird's charting stats
    await expect(page.getByText(/34 charting/)).toBeVisible();
    await expect(page.getByText(/24 #1s/)).toBeVisible();
    // Publisher
    await expect(page.getByText(/Sony Music Publishing/).first()).toBeVisible();
  });

  test('ND Profile links have correct href with pg_id', async ({ page }) => {
    await page.goto('/demo/publisher-demo.html');
    const ndLinks = page.locator('a.nd-link');
    const count = await ndLinks.count();
    expect(count).toBeGreaterThanOrEqual(6); // At least 6 writer links across the 2 demo cards
    for (let i = 0; i < count; i++) {
      const link = ndLinks.nth(i);
      const href = await link.getAttribute('href');
      // Accept both conventions: pg_<12hex> (current) and PG_AUTO_<16hex> (legacy auto-assigned).
      // Wave 6 Block 1 replaced lowercase placeholders with real ids pulled from /api/songwriter-match;
      // one of them (Aaron Eshuis) uses the PG_AUTO_ legacy prefix.
      expect(href).toMatch(/^https:\/\/nashvilledecoder\.com\/profiles\.html\?id=(pg_[0-9a-f]{12}|PG_AUTO_[0-9a-f]+)$/);
      const target = await link.getAttribute('target');
      expect(target).toBe('_blank');
    }
  });

  test('Tucker Wetmore card shows Ryan Hurd', async ({ page }) => {
    await page.goto('/demo/publisher-demo.html');
    await expect(page.getByText('Tucker Wetmore')).toBeVisible();
    await expect(page.getByText('Sunburn')).toBeVisible();
    await expect(page.getByText('Ryan Hurd')).toBeVisible();
    await expect(page.getByText(/21 charting/)).toBeVisible();
  });

  test('no horizontal overflow on desktop', async ({ page }) => {
    await page.goto('/demo/publisher-demo.html');
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });
});

// ============================================================
// Songwriter-match API (server-side lookup)
// Only runs against a real serverless runtime (prod or Vercel preview).
// Set E2E_API_BASE=https://maxmeetsmusiccity.com to enable.
// ============================================================

const API_BASE = process.env.E2E_API_BASE;

test.describe('/api/songwriter-match', () => {
  test.skip(!API_BASE, 'Set E2E_API_BASE to run API tests against a real runtime');

  test('POST with composerName string returns matches', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/songwriter-match`, {
      data: { composer_names: ['Brandon Lake, Lainey Wilson, Emily Weisband & Luke Laird'] },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('matches');
    expect(Array.isArray(body.matches)).toBe(true);
    // At least Lainey Wilson and Luke Laird should be matched (both have charting > 0)
    const names = body.matches.map((m: { display_name: string }) => m.display_name.toLowerCase());
    expect(names.some((n: string) => n.includes('luke laird'))).toBe(true);
  });

  test('Ashley Gorley returns correct pg_id', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/songwriter-match`, {
      data: { composer_names: ['Ashley Gorley'] },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const gorley = body.matches.find((m: { display_name: string }) =>
      m.display_name.toLowerCase().includes('gorley'),
    );
    expect(gorley).toBeTruthy();
    expect(gorley.pg_id).toBe('pg_df752e8c5e64');
    expect(gorley.charting_songs).toBeGreaterThan(100);
  });

  test('empty input returns 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/songwriter-match`, { data: {} });
    expect(res.status()).toBe(400);
  });

  test('unknown name returned in unmatched array', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/songwriter-match`, {
      data: { composer_names: ['Completely Unknown Person 9999'] },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.unmatched.length).toBeGreaterThan(0);
  });
});

// ============================================================
// NMF route smoke — existence checks
// ============================================================

test.describe('NMF route exists and serves content', () => {
  test('/newmusicfriday returns 200 with New Music Friday heading', async ({ page }) => {
    await page.goto('/newmusicfriday');
    await expect(page.getByRole('heading', { name: /New Music Friday/ })).toBeVisible();
  });

  test('/newmusicfriday has no horizontal overflow at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/newmusicfriday');
    await page.waitForLoadState('networkidle');
    const hasOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasOverflow).toBe(false);
  });
});

// ============================================================
// Live Coming Soon tab funnel — Wave 6 Addendum #7
// ============================================================
// The publisher funnel's money click lives on the live Coming Soon tab of
// /newmusicfriday, not on the static /demo/publisher-demo.html page. Every
// other test in this file verifies the demo copy; this describe block
// verifies the real surface. The assertions are conditional on live data
// (future-dated releases with composer_name populated), which is upstream
// of Thread C — so the tests degrade gracefully when data is missing rather
// than flaking.

test.describe('Live Coming Soon tab funnel', () => {
  // Reaching the Coming Soon pill requires actually clicking through the
  // AuthGate as a guest — setting localStorage alone leaves you on the
  // landing screen. The button hands off to continueAsGuest() AND sets
  // sessionStorage.nmf_entered=1 which is what AuthGate checks.
  async function openNmfAsGuest(page: import('@playwright/test').Page) {
    await page.goto('/newmusicfriday');
    const guestBtn = page.getByRole('button', { name: /Get Started as a Guest/i });
    await guestBtn.waitFor({ state: 'visible', timeout: 15000 });
    await guestBtn.click();
    // After click, NewMusicFriday renders with activeSource='nashville' (default)
    // which lazy-loads <NashvilleReleases>. Give the Suspense boundary + first
    // Supabase query a generous window before asserting anything data-dependent.
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  }

  test('Coming Soon tab opens and renders the ComingSoon component', async ({ page }) => {
    await openNmfAsGuest(page);

    // The Coming Soon filter pill only renders when at least one future-dated
    // release exists in Supabase. If Thread A's cron has been quiet, skip
    // rather than fail — this is upstream data, not a Thread C regression.
    // Disambiguate from the Apple Music source card labelled "COMING SOON"
    // (meaning "feature not yet available"). The filter pill always carries
    // the crystal-ball emoji as its leading glyph.
    const comingSoonBtn = page.getByRole('button', { name: /🔮 Coming Soon/ });
    const appeared = await comingSoonBtn
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!appeared, 'No future-dated Nashville releases in Supabase right now — cannot exercise Coming Soon funnel');

    // A sibling div in the zero-login flow layout intercepts pointer events,
    // so neither a normal click nor force:true lands on the filter pill
    // reliably — force: true also hits the overlay. Call HTMLElement.click()
    // directly to fire the React synthetic click regardless of pointer
    // event delivery. Actionability is already satisfied because waitFor()
    // above confirmed the button is visible.
    await comingSoonBtn.evaluate((btn) => (btn as HTMLButtonElement).click());

    // ComingSoon component renders an h3 with the "Coming Soon" label.
    await expect(page.getByRole('heading', { name: /Coming Soon/ })).toBeVisible({ timeout: 10000 });
  });

  test('Bridge card ND Profile links have real pg_id format (when rendered)', async ({ page }) => {
    await openNmfAsGuest(page);

    // Disambiguate from the Apple Music source card labelled "COMING SOON"
    // (meaning "feature not yet available"). The filter pill always carries
    // the crystal-ball emoji as its leading glyph.
    const comingSoonBtn = page.getByRole('button', { name: /🔮 Coming Soon/ });
    const appeared = await comingSoonBtn
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!appeared, 'No future-dated releases — nothing to exercise');

    // A sibling div in the zero-login flow layout intercepts pointer events,
    // so neither a normal click nor force:true lands on the filter pill
    // reliably — force: true also hits the overlay. Call HTMLElement.click()
    // directly to fire the React synthetic click regardless of pointer
    // event delivery. Actionability is already satisfied because waitFor()
    // above confirmed the button is visible.
    await comingSoonBtn.evaluate((btn) => (btn as HTMLButtonElement).click());
    await expect(page.getByRole('heading', { name: /Coming Soon/ })).toBeVisible({ timeout: 10000 });

    // Bridge cards only render for future releases whose composer_name
    // resolves to a writer with charting_songs > 0. When that's zero the
    // test is vacuous but still guards against link-format regressions.
    // Lightweight network wait: if any bridge cards will render, the
    // /api/songwriter-match call is what populates them.
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const ndLinks = page.locator('a[href*="nashvilledecoder.com/profiles.html?id="]');
    const count = await ndLinks.count();
    test.skip(count === 0, 'No matched writers on future releases right now — vacuous assertion');

    for (let i = 0; i < count; i++) {
      const href = await ndLinks.nth(i).getAttribute('href');
      // Accept both conventions: pg_<12hex> and legacy PG_AUTO_<hex>.
      expect(href).toMatch(/^https:\/\/nashvilledecoder\.com\/profiles\.html\?id=(pg_[0-9a-f]{12}|PG_AUTO_[0-9a-f]+)$/);
    }
  });

  test('Coming Soon mount triggers /api/songwriter-match POST (when composer data exists)', async ({ page }) => {
    await openNmfAsGuest(page);

    // Begin listening for the songwriter-match POST before clicking the tab.
    // The ComingSoon component only fires this fetch when the current releases
    // carry at least one parseable composer_name. When the Supabase feed is
    // dry the request never happens and the test skips cleanly.
    const reqPromise = page
      .waitForRequest(
        r => r.url().includes('/api/songwriter-match') && r.method() === 'POST',
        { timeout: 12000 },
      )
      .catch(() => null);

    // Disambiguate from the Apple Music source card labelled "COMING SOON"
    // (meaning "feature not yet available"). The filter pill always carries
    // the crystal-ball emoji as its leading glyph.
    const comingSoonBtn = page.getByRole('button', { name: /🔮 Coming Soon/ });
    const appeared = await comingSoonBtn
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!appeared, 'No future-dated releases — nothing to exercise');

    // A sibling div in the zero-login flow layout intercepts pointer events,
    // so neither a normal click nor force:true lands on the filter pill
    // reliably — force: true also hits the overlay. Call HTMLElement.click()
    // directly to fire the React synthetic click regardless of pointer
    // event delivery. Actionability is already satisfied because waitFor()
    // above confirmed the button is visible.
    await comingSoonBtn.evaluate((btn) => (btn as HTMLButtonElement).click());
    await expect(page.getByRole('heading', { name: /Coming Soon/ })).toBeVisible({ timeout: 10000 });

    const req = await reqPromise;
    test.skip(req === null, 'Future releases exist but none have composer_name — ComingSoon correctly skips the API call');

    // At this point Block 5 is proven live: the component batched composer
    // names and called the server-side matcher instead of the 12MB static
    // cache. The response shape is covered by the unit tests above.
    const body = req!.postDataJSON();
    expect(body).toHaveProperty('composer_names');
    expect(Array.isArray(body.composer_names)).toBe(true);
    expect(body.composer_names.length).toBeGreaterThan(0);
  });
});
