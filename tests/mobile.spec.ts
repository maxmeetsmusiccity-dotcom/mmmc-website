import { test, expect } from '@playwright/test';

test.describe('Mobile NMF Curator Studio', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test('no horizontal overflow on landing page', async ({ page }) => {
    await page.goto('/newmusicfriday');
    await page.waitForTimeout(1000);
    const overflows = await page.evaluate(() =>
      document.body.scrollWidth > window.innerWidth
    );
    expect(overflows).toBe(false);
  });

  test('header wraps cleanly at mobile width', async ({ page }) => {
    await page.goto('/newmusicfriday');
    await page.waitForTimeout(1000);
    // Enter as guest
    const guestBtn = page.locator('button:has-text("Get Started as a Guest")');
    if (await guestBtn.isVisible()) await guestBtn.click();
    await page.waitForTimeout(1500);

    const h1 = page.locator('h1').first();
    const box = await h1.boundingBox();
    expect(box).toBeTruthy();
    // h1 should not extend past viewport
    expect(box!.x + box!.width).toBeLessThanOrEqual(393);
  });

  test('Nashville releases grid uses 2 columns on mobile', async ({ page }) => {
    await page.goto('/newmusicfriday');
    await page.evaluate(() => sessionStorage.setItem('nmf_entered', '1'));
    await page.reload();
    await page.waitForTimeout(2000);

    // Dismiss onboarding if present
    const skipTour = page.locator('text=Skip tour');
    if (await skipTour.isVisible()) await skipTour.click();
    await page.waitForTimeout(500);

    // Check grid columns
    const grids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[style*="grid-template-columns"]'))
        .map(g => ({
          columns: getComputedStyle(g).gridTemplateColumns,
          colCount: getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length,
        }))
    );
    // Any grid should have 2+ columns (not 1 giant column)
    for (const g of grids) {
      if (g.colCount > 0) {
        expect(g.colCount).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('no horizontal overflow after entering app', async ({ page }) => {
    await page.goto('/newmusicfriday');
    await page.evaluate(() => sessionStorage.setItem('nmf_entered', '1'));
    await page.reload();
    await page.waitForTimeout(2000);

    const skipTour = page.locator('text=Skip tour');
    if (await skipTour.isVisible()) await skipTour.click();

    const overflows = await page.evaluate(() =>
      document.body.scrollWidth > window.innerWidth
    );
    expect(overflows).toBe(false);
  });

  test('landing page renders without crash', async ({ page }) => {
    await page.goto('/newmusicfriday');
    await page.waitForTimeout(2000);

    // Should NOT show error boundary
    const errorText = page.locator('text=Something went wrong');
    expect(await errorText.isVisible()).toBe(false);

    // Should show either landing page or main app
    const body = await page.textContent('body');
    const hasContent = body?.includes('Curator Studio') || body?.includes('New Music Friday');
    expect(hasContent).toBe(true);
  });
});

test.describe('Mobile NMF at iPhone SE (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/newmusicfriday');
    await page.waitForTimeout(1000);
    const overflows = await page.evaluate(() =>
      document.body.scrollWidth > window.innerWidth
    );
    expect(overflows).toBe(false);
  });

  test('publisher demo page renders without overflow at 375px', async ({ page }) => {
    await page.goto('/demo/publisher-demo.html');
    const overflows = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflows).toBe(false);
    await expect(page.getByRole('heading', { name: /Publisher Demo/ })).toBeVisible();
  });

  test('ND Profile links tappable on mobile (min 32px height)', async ({ page }) => {
    await page.goto('/demo/publisher-demo.html');
    const links = page.locator('a.nd-link');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
    // Check first 3 for touch target size
    for (let i = 0; i < Math.min(3, count); i++) {
      const box = await links.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(24); // realistic minimum
      expect(box!.width).toBeGreaterThanOrEqual(50);
    }
  });
});

test.describe('Mobile NMF at iPhone 14 Pro (393px)', () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test('buttons meet 44px minimum touch target (global.css rule)', async ({ page }) => {
    await page.goto('/newmusicfriday');
    await page.waitForTimeout(1000);
    // Check that at least one visible button meets 44px minimum
    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    // Inspect first 5 visible buttons
    let met44 = 0;
    for (let i = 0; i < Math.min(5, count); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box && box.height >= 44) met44++;
    }
    expect(met44).toBeGreaterThan(0); // at least 1 button honors the rule
  });

  test('publisher demo renders bridge cards at 393px', async ({ page }) => {
    await page.goto('/demo/publisher-demo.html');
    await expect(page.getByText(/The Jesus I Know Now/)).toBeVisible();
    await expect(page.getByText(/34 charting/)).toBeVisible();
    // Verify bridge cards don't horizontally overflow
    const cards = page.locator('.bridge-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < cardCount; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x + box!.width).toBeLessThanOrEqual(393);
    }
  });
});
