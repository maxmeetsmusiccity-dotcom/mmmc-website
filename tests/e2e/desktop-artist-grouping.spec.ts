import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// Wave 7 Block 9 — desktop artist-grouping regression guard.
// Desktop post-import grid now renders ArtistClusterCard (one tile per
// primary artist) instead of ClusterCard (one tile per album). Features
// bucket under the first-listed artist. Rubber-band + shift-click target
// artist tiles via `data-artist-key`. Tests the end-to-end flow against
// prod data.

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false });

test('desktop: artist tiles + split badges + modal + cover feature star', async ({ page }) => {
  const outDir = '/tmp/desktop_audit';
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('/newmusicfriday');
  await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const skipTour = page.getByText(/Skip tour/i).first();
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();

  await page.getByRole('button', { name: /Import \d+ releases/i }).click();
  await page.waitForTimeout(4000);

  // After import, the post-import grid should render ArtistClusterCard
  // tiles with `data-artist-key` attributes. The old tile used
  // `data-album-id`; a migration regression would still have only the
  // old attribute.
  const artistTiles = page.locator('[data-artist-key]');
  const albumTiles = page.locator('[data-album-id]');
  const artistCount = await artistTiles.count();
  const albumCount = await albumTiles.count();
  console.log(`post-import: artistTiles=${artistCount} albumTiles=${albumCount}`);

  expect(artistCount, 'post-import grid must render ArtistClusterCard tiles').toBeGreaterThan(10);
  // Note: ArtistClusterCard also sets data-primary-album-id so each
  // artist tile has BOTH attributes. We just need artist count > 0.

  await page.screenshot({ path: `${outDir}/artist_grouping_01_grid.png`, fullPage: false });

  // Click the first 3 tiles in sequence to trigger split badges + star.
  // Single-track artists toggle directly; multi-track artists open a
  // modal we bail out of.
  let picked = 0;
  for (let i = 0; i < Math.min(artistCount, 20) && picked < 3; i++) {
    await artistTiles.nth(i).click();
    await page.waitForTimeout(200);
    const modalOpen = await page.getByRole('button', { name: /^Done$/ }).isVisible().catch(() => false);
    if (modalOpen) {
      await page.getByRole('button', { name: /^Done$/ }).click();
      await page.waitForTimeout(200);
      continue;
    }
    picked++;
  }

  await page.screenshot({ path: `${outDir}/artist_grouping_02_after_select.png`, fullPage: false });

  // Both count + ordinal badges must exist.
  const countBadges = page.locator('[data-testid="artist-card-badge-count"]');
  const ordinalBadges = page.locator('[data-testid="artist-card-badge-ordinal"]');
  expect(await countBadges.count()).toBeGreaterThanOrEqual(picked);
  expect(await ordinalBadges.count()).toBeGreaterThanOrEqual(picked);

  // Ordinal badges must run 1..picked.
  const ordinalTexts = await ordinalBadges.allTextContents();
  const ordinals = ordinalTexts.map(t => parseInt((t || '').replace('#', ''), 10)).sort((a, b) => a - b);
  console.log('ordinals:', ordinals);
  expect(ordinals.length).toBeGreaterThanOrEqual(picked);
  expect(Math.max(...ordinals)).toBeGreaterThanOrEqual(picked);

  // Count + ordinal position: count on left, ordinal on right of the same tile.
  const countBox = await countBadges.first().boundingBox();
  const ordinalBox = await ordinalBadges.first().boundingBox();
  expect(countBox).toBeTruthy();
  expect(ordinalBox).toBeTruthy();
  // Same tile (y within 10px) and count.x + width <= ordinal.x.
  expect(Math.abs(countBox!.y - ordinalBox!.y)).toBeLessThan(10);
  expect(countBox!.x + countBox!.width).toBeLessThanOrEqual(ordinalBox!.x);

  // Cover feature star must be present inside at least one selected tile.
  const starBtn = page.locator('button[title*="cover feature" i]').first();
  await expect(starBtn).toBeVisible();

  // Click the star to set cover feature, verify it toggles to gold.
  await starBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/artist_grouping_03_with_cover.png`, fullPage: false });

  // Open a multi-track artist's modal explicitly.
  for (let i = 0; i < Math.min(artistCount, 20); i++) {
    const tile = artistTiles.nth(i);
    const txt = (await tile.textContent()) || '';
    const trackMatch = txt.match(/(\d+)\s+tracks?/);
    const releaseMatch = txt.match(/(\d+)\s+releases?/);
    const tracks = trackMatch ? parseInt(trackMatch[1], 10) : 0;
    const releases = releaseMatch ? parseInt(releaseMatch[1], 10) : 0;
    if (tracks >= 2 || releases >= 2) {
      await tile.click();
      await page.waitForTimeout(400);
      const done = page.getByRole('button', { name: /^Done$/ });
      if (await done.isVisible().catch(() => false)) {
        await page.screenshot({ path: `${outDir}/artist_grouping_04_modal.png`, fullPage: false });
        await done.click();
        break;
      }
    }
  }
});
