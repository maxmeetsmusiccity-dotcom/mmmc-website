import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// Wave 7 Block 5E — desktop ClusterCard split badge regression guard.
// After import, desktop renders a grid of ClusterCard instances (one per
// album/release). A selected card must show:
//   top-left : gold-fill "K/M" count badge
//   top-right: gold-outline "#X" ordinal badge with the max selectionNumber
//              among this card's selected tracks
// The pre-5E multi-circle ordinal cluster is removed.

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false });

test('desktop: ClusterCard split badges after import + selection', async ({ page }) => {
  const outDir = '/tmp/desktop_audit';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('/newmusicfriday');
  await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const skipTour = page.getByText(/Skip tour/i).first();
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();

  await page.getByRole('button', { name: /Import \d+ releases/i }).click();
  await page.waitForTimeout(3500);

  // ClusterCards have data-album-id. Click the first 3 cards to trigger
  // the split badges. Each click fires onSelectRelease which picks the
  // titleTrack from that cluster.
  const cards = page.locator('[data-album-id]');
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(3);
  for (let i = 0; i < 3; i++) {
    await cards.nth(i).click();
    await page.waitForTimeout(150);
  }

  await page.screenshot({ path: `${outDir}/cluster_badges.png`, fullPage: false });

  // Assert both badge types are on the page.
  const countBadges = page.locator('[data-testid="cluster-card-badge-count"]');
  const ordinalBadges = page.locator('[data-testid="cluster-card-badge-ordinal"]');
  const countCount = await countBadges.count();
  const ordinalCount = await ordinalBadges.count();
  expect(countCount, 'expected count badges on selected ClusterCards').toBeGreaterThanOrEqual(3);
  expect(ordinalCount, 'expected ordinal badges on selected ClusterCards').toBeGreaterThanOrEqual(3);

  // First count badge text must match "K/M"
  const countText = (await countBadges.first().textContent())?.trim() || '';
  expect(countText).toMatch(/^\d+\/\d+$/);

  // First ordinal badge text must match "#N"
  const ordinalText = (await ordinalBadges.first().textContent())?.trim() || '';
  expect(ordinalText).toMatch(/^#\d+$/);

  // Count badge must be top-LEFT of its card; ordinal badge must be top-RIGHT.
  // Both live inside the same card, so compare positions of the first pair.
  const countBox = await countBadges.first().boundingBox();
  const ordinalBox = await ordinalBadges.first().boundingBox();
  expect(countBox).toBeTruthy();
  expect(ordinalBox).toBeTruthy();
  // They should be vertically aligned (same top) and count should be to
  // the left of ordinal within the same card.
  expect(Math.abs(countBox!.y - ordinalBox!.y)).toBeLessThan(10);
  expect(countBox!.x + countBox!.width).toBeLessThanOrEqual(ordinalBox!.x);

  // The ordinal on the LAST selected card should be "#3" (we clicked 3 times).
  // Since ordinal order depends on which card was clicked last, pick the
  // card whose ordinal matches 3.
  const ordinalTexts = await ordinalBadges.allTextContents();
  const ordinals = ordinalTexts.map(t => parseInt((t || '').replace('#', ''), 10));
  expect(ordinals.some(n => n === 3), 'one badge should read #3').toBe(true);
});
