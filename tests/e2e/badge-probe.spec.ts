import { test } from '@playwright/test';
import * as fs from 'fs';

test.use({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
});

test('visual: split badges after selecting 3 tracks', async ({ page }) => {
  const outDir = '/tmp/mobile_probe';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('/newmusicfriday');
  await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const skipTour = page.getByText(/Skip tour/i).first();
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  const importBtn = page.getByRole('button', { name: /Import \d+ releases/i });
  await importBtn.click();
  await page.waitForTimeout(3000);

  // Pick a few singles so we get a few tiles with badges.
  const tiles = page.locator('[style*="grid-template-columns"] > div');
  let picked = 0;
  const total = await tiles.count();
  for (let i = 0; i < Math.min(total, 25) && picked < 3; i++) {
    await tiles.nth(i).click();
    await page.waitForTimeout(150);
    const modalOpen = await page.getByRole('button', { name: /^Done$/ }).isVisible().catch(() => false);
    if (modalOpen) {
      await page.locator('[style*="rgba(0, 0, 0, 0.6)"]').first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(150);
      continue;
    }
    picked++;
  }

  // Scroll to the top of the grid so selected tiles are visible
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/block5B_01_split_badges.png`, fullPage: false });
});
