import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.use({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
});

// Visual + structural probe for the Wave 7 Block 5 Carousel Builder sheet.
// Opens the builder on mobile, asserts the rename, the section order, and
// that the two live canvas-backed previews render within a reasonable
// debounce window. Not a permanent guard — this file is a probe, keep it
// lean.
test('builder sheet: rename, order, live previews', async ({ page }) => {
  const outDir = '/tmp/mobile_probe';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('/newmusicfriday');
  await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const skipTour = page.getByText(/Skip tour/i).first();
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();

  const importBtn = page.getByRole('button', { name: /Import \d+ releases/i });
  await importBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await importBtn.click();
  await page.waitForTimeout(3000);

  // Select ~4 tracks so the grid preview has real content. Tap the first
  // four single-track tiles (singles auto-select without opening the modal).
  const tiles = page.locator('[style*="grid-template-columns"] > div');
  let selected = 0;
  const total = await tiles.count();
  for (let i = 0; i < total && selected < 4; i++) {
    await tiles.nth(i).click();
    await page.waitForTimeout(150);
    // If a Done button appeared, the modal opened for a multi-track artist —
    // bail out and pick a different tile.
    const doneVisible = await page.getByRole('button', { name: /^Done$/ }).isVisible().catch(() => false);
    if (doneVisible) {
      await page.keyboard.press('Escape').catch(() => {});
      // Tap the backdrop to close
      await page.locator('[style*="rgba(0, 0, 0, 0.6)"]').first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
      continue;
    }
    selected++;
  }
  expect(selected).toBeGreaterThan(0);

  // Tap the "🎨 Builder" button (renamed from ⚙ Settings).
  const builderBtn = page.getByRole('button', { name: /Builder/ });
  await expect(builderBtn).toBeVisible();
  await builderBtn.click();
  await page.waitForTimeout(300);

  // Sheet heading is renamed.
  await expect(page.getByText(/^Carousel Builder$/)).toBeVisible();

  // Explicit close X button must exist and be ≥ 44px tappable.
  const closeBtn = page.getByRole('button', { name: /Close carousel builder/i });
  await expect(closeBtn).toBeVisible();
  const closeBox = await closeBtn.boundingBox();
  expect(closeBox).toBeTruthy();
  expect(closeBox!.width).toBeGreaterThanOrEqual(44);
  expect(closeBox!.height).toBeGreaterThanOrEqual(44);

  // Wave 7 Block 5C section order: Shape → Tracks per slide → Center Logo
  // → (Title Slide if cover feature set, else skipped) → Grid Slide.
  // No cover feature in this probe, so Title Slide must NOT appear.
  const sectionOrder = await page.evaluate(() => {
    const labels = ['Shape', 'Tracks per slide', 'Center Logo', 'Title Slide', 'Grid Slide'];
    const positions: Record<string, number> = {};
    for (const label of labels) {
      const el = Array.from(document.querySelectorAll('p'))
        .find(p => (p.textContent || '').trim() === label);
      positions[label] = el ? el.getBoundingClientRect().top : -1;
    }
    return positions;
  });
  expect(sectionOrder['Shape']).toBeGreaterThan(0);
  expect(sectionOrder['Tracks per slide']).toBeGreaterThan(sectionOrder['Shape']);
  expect(sectionOrder['Center Logo']).toBeGreaterThan(sectionOrder['Tracks per slide']);
  expect(sectionOrder['Grid Slide']).toBeGreaterThan(sectionOrder['Center Logo']);
  // Title Slide section is hidden when no cover feature is set.
  expect(sectionOrder['Title Slide']).toBe(-1);

  // Live previews: wait for the grid preview to have an <img> (the debounced
  // generateGridSlide should resolve in ~300ms cold).
  const gridPreview = page.locator('[data-testid="builder-grid-preview"]');
  await expect(gridPreview).toBeVisible();
  // Scroll the preview container into view inside the sheet.
  await gridPreview.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200); // debounce + canvas work
  const hasGridImg = await gridPreview.locator('img').count();
  expect(hasGridImg, 'grid preview must render an <img> after selection + open').toBeGreaterThan(0);

  await page.screenshot({ path: `${outDir}/block5A_01_builder_sheet_top.png`, fullPage: false });

  // Scroll inside the sheet to show more
  await page.evaluate(() => {
    const sheet = document.querySelector('[style*="position: fixed"][style*="bottom:"]');
    if (sheet) (sheet as HTMLElement).scrollTop = 9999;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/block5A_02_builder_sheet_bottom.png`, fullPage: false });

  // Full-sheet screenshot for manual review: take a long screenshot by
  // temporarily removing max-height.
  await page.evaluate(() => {
    const sheet = document.querySelector('[style*="border-radius: 16px 16px"]');
    if (sheet) (sheet as HTMLElement).style.maxHeight = 'none';
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/block5A_03_builder_full.png`, fullPage: true });
});
