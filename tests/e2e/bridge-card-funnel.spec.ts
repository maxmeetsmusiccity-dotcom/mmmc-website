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
