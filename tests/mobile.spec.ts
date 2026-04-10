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
});
