import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// Wave 8 Block 1 — Desktop interaction regression tests.
// ArtistClusterCard (Block 9) restructured the post-import grid but the
// interaction layer was only structurally tested (tiles render, badges show).
// These three tests cover rubber-band drag, shift-click range, and Quick
// Look — the three keyboard/mouse interactions that operate on artist tiles.

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false });

const outDir = '/tmp/desktop_interactions';

/** Navigate to NMF, bypass auth, import releases, land on post-import grid. */
async function enterPostImportGrid(page: import('@playwright/test').Page) {
  fs.mkdirSync(outDir, { recursive: true });

  await page.goto('/newmusicfriday');
  await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // Dismiss tour if visible
  const skipTour = page.getByText(/Skip tour/i).first();
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();

  // Import releases to reach post-import grid
  await page.getByRole('button', { name: /Import \d+ releases/i }).click();
  await page.waitForTimeout(4000);

  // Verify artist tiles rendered
  const artistTiles = page.locator('[data-artist-key]');
  const count = await artistTiles.count();
  expect(count, 'post-import grid must have artist tiles').toBeGreaterThan(5);
  return count;
}

test('rubber-band drag selects multiple artist tiles', async ({ page }) => {
  const tileCount = await enterPostImportGrid(page);

  await page.screenshot({ path: `${outDir}/rubberband_01_before.png`, fullPage: false });

  // Before the fix: rubber-band didn't exist for artist tiles, only album
  // tiles. Without Wave 7 Block 9's migration to [data-artist-key], this
  // rubber-band would select zero tiles.

  const grid = page.locator('[data-testid="track-grid"]');
  await expect(grid).toBeVisible();

  // Get bounding boxes of the first few tiles so we know where to drag
  const artistTiles = page.locator('[data-artist-key]');
  const firstTileBox = await artistTiles.nth(0).boundingBox();
  const targetIdx = Math.min(4, tileCount - 1);
  const lastTileBox = await artistTiles.nth(targetIdx).boundingBox();
  expect(firstTileBox).toBeTruthy();
  expect(lastTileBox).toBeTruthy();

  // Rubber-band requires Shift held during mousedown (line 1716 guard).
  // Playwright's keyboard.down('Shift') should set shiftKey on subsequent
  // mouse events, but React synthetic events can be unreliable with this.
  // Use page.evaluate to dispatch native MouseEvents directly on the grid
  // element with shiftKey: true, ensuring the onMouseDown handler fires.
  const startX = firstTileBox!.x - 5;
  const startY = firstTileBox!.y - 5;
  const endX = lastTileBox!.x + lastTileBox!.width + 5;
  const endY = lastTileBox!.y + lastTileBox!.height + 5;

  await page.evaluate(({ sx, sy, ex, ey }) => {
    const grid = document.querySelector('[data-testid="track-grid"]');
    if (!grid) throw new Error('grid not found');
    const rect = grid.getBoundingClientRect();

    // Dispatch mousedown with shiftKey on the grid
    grid.dispatchEvent(new MouseEvent('mousedown', {
      clientX: sx, clientY: sy,
      shiftKey: true, bubbles: true, cancelable: true,
    }));

    // Dispatch several mousemove events on document (the handler attaches to document)
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: sx + (ex - sx) * (i / steps),
        clientY: sy + (ey - sy) * (i / steps),
        shiftKey: true, bubbles: true, cancelable: true,
      }));
    }

    // Dispatch mouseup on document
    document.dispatchEvent(new MouseEvent('mouseup', {
      clientX: ex, clientY: ey,
      shiftKey: true, bubbles: true, cancelable: true,
    }));
  }, { sx: startX, sy: startY, ex: endX, ey: endY });

  await page.waitForTimeout(500);

  await page.screenshot({ path: `${outDir}/rubberband_02_after.png`, fullPage: false });

  // Verify selections were made: selection badges should appear
  const countBadges = page.locator('[data-testid="artist-card-badge-count"]');
  const badgeCount = await countBadges.count();
  console.log(`rubber-band: ${badgeCount} tiles selected (dragged across indices 0-${targetIdx})`);
  expect(badgeCount, 'rubber-band must select at least 2 tiles').toBeGreaterThanOrEqual(2);

  // Verify the rubber-band overlay is dismissed (cleaned up on mouseup)
  const goldOverlay = page.locator('[data-testid="track-grid"] > div[style*="pointer-events: none"]');
  expect(await goldOverlay.count(), 'rubber-band overlay must be dismissed after mouseup').toBe(0);
});

test('shift-click selects range of artist tiles', async ({ page }) => {
  await enterPostImportGrid(page);

  await page.screenshot({ path: `${outDir}/shiftclick_01_before.png`, fullPage: false });

  // Before the fix: shift-click only worked for album-based ClusterCard tiles.
  // ArtistClusterCard's onSelectRelease handler checks window.event.shiftKey
  // (line 1821) and iterates artistGroups[start..end] to select the range.
  //
  // IMPORTANT: shift-click range only fires when the CLICKED tile is a
  // single-track artist (isSingleTrackArtist). Multi-track tiles open a
  // modal instead of calling onSelectRelease, so the shift detection in
  // onSelectRelease never runs. Both the anchor and the endpoint must be
  // single-track artists for this test to work.

  const artistTiles = page.locator('[data-artist-key]');
  const tileCount = await artistTiles.count();
  expect(tileCount).toBeGreaterThan(5);

  // Pre-scan: find indices of single-track tiles (caption says "1 track").
  // We need at least two that are separated by 2+ indices.
  // Use innerText (not textContent) so block elements get whitespace.
  const singleTrackIndices: number[] = [];
  for (let i = 0; i < Math.min(tileCount, 20); i++) {
    const tile = artistTiles.nth(i);
    const text = await tile.evaluate(el => el.innerText) || '';
    // Single-track, single-release artists show "1 track" without "releases"
    const isSingle = /1\s+track\b/.test(text) && !/\d+\s+releases/.test(text);
    if (isSingle) {
      singleTrackIndices.push(i);
    }
  }
  console.log(`shift-click: single-track tile indices: [${singleTrackIndices.join(', ')}]`);
  expect(singleTrackIndices.length, 'need at least 2 single-track tiles').toBeGreaterThanOrEqual(2);

  // Pick the first single-track tile as anchor
  const firstIdx = singleTrackIndices[0];
  // Pick a second single-track tile at least 2 apart for a meaningful range
  let secondIdx = -1;
  for (const idx of singleTrackIndices) {
    if (idx >= firstIdx + 2) {
      secondIdx = idx;
      break;
    }
  }
  // Fall back to the next single-track tile if none is 2+ apart
  if (secondIdx < 0) secondIdx = singleTrackIndices[1];
  console.log(`shift-click: anchor=${firstIdx}, target=${secondIdx}`);

  // Step 1: Click the anchor tile to set lastClickedIdx and select it
  await artistTiles.nth(firstIdx).click();
  await page.waitForTimeout(300);

  // Verify anchor got selected (badge appeared)
  const anchorBadge = artistTiles.nth(firstIdx).locator('[data-testid="artist-card-badge-count"]');
  await expect(anchorBadge, 'anchor tile must be selected after click').toBeVisible();

  await page.screenshot({ path: `${outDir}/shiftclick_02_first_selected.png`, fullPage: false });

  // Step 2: Shift-click the target tile to select the range
  await artistTiles.nth(secondIdx).click({ modifiers: ['Shift'] });
  await page.waitForTimeout(500);

  await page.screenshot({ path: `${outDir}/shiftclick_03_range_selected.png`, fullPage: false });

  // Verify: tiles in the range should have badges
  const countBadges = page.locator('[data-testid="artist-card-badge-count"]');
  const badgeCount = await countBadges.count();
  const expectedRange = secondIdx - firstIdx + 1;
  console.log(`shift-click: badges=${badgeCount}, expected range=${expectedRange} (indices ${firstIdx}-${secondIdx})`);

  // At minimum, more tiles should be selected than just the first one
  expect(badgeCount, 'shift-click must select more than the initial tile').toBeGreaterThan(1);
  // The range should select all tiles between anchor and target (inclusive)
  expect(badgeCount, `shift-click should select ~${expectedRange} tiles in the range`).toBeGreaterThanOrEqual(expectedRange);
});

test('Quick Look opens on Space hover and dismisses on Escape', async ({ page }) => {
  await enterPostImportGrid(page);

  await page.screenshot({ path: `${outDir}/quicklook_01_before.png`, fullPage: false });

  // Before the fix: Quick Look relied on hoveredCluster.current being set
  // via onHover (ArtistClusterCard line ~1851 onMouseEnter). Without the
  // onHover prop, Space would do nothing because hoveredCluster stayed null.

  const artistTiles = page.locator('[data-artist-key]');
  const firstTile = artistTiles.first();
  const tileBox = await firstTile.boundingBox();
  expect(tileBox).toBeTruthy();

  // Hover over the tile center to trigger onMouseEnter → onHover
  await page.mouse.move(
    tileBox!.x + tileBox!.width / 2,
    tileBox!.y + tileBox!.height / 2,
  );
  await page.waitForTimeout(300);

  // Press Space to open Quick Look
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);

  await page.screenshot({ path: `${outDir}/quicklook_02_open.png`, fullPage: false });

  // Verify Quick Look modal is visible — it has a "Press Space or Escape to close" hint
  const quickLookHint = page.getByText(/Press Space or Escape to close/i);
  await expect(quickLookHint, 'Quick Look modal must show close hint').toBeVisible({ timeout: 3000 });

  // Verify the modal overlay is present
  const overlay = page.locator('.modal-overlay');
  await expect(overlay, 'Quick Look overlay must be visible').toBeVisible();

  // The modal should show album name and artist name
  const modalContent = overlay.locator('div').filter({ has: page.locator('img') });
  await expect(modalContent.first(), 'Quick Look must show album art').toBeVisible();

  // Press Escape to dismiss
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.screenshot({ path: `${outDir}/quicklook_03_dismissed.png`, fullPage: false });

  // Verify the modal is gone
  await expect(quickLookHint, 'Quick Look must dismiss on Escape').not.toBeVisible();
  // Overlay should also be gone (or at least the Quick Look one)
  const overlayCount = await page.locator('.modal-overlay').count();
  expect(overlayCount, 'no modal overlay should remain after Escape').toBe(0);
});
