import { test, expect } from '@playwright/test';
import * as fs from 'fs';

// Wave 7 Block 3+4 — mobile regression guard.
//
// Block 3 (grid template): `repeat(2, 1fr)` without `minmax(0, 1fr)` let
// CSS grid cells size to min-content, and any child with `white-space:
// nowrap` (album title, artist name) pushed the column to the text's
// natural width. On /newmusicfriday results view this turned a 393px
// viewport's 2-col grid into a ~1509px horizontal wall where every album
// cover rendered at 1193x1193 — the screenshot Max shared on 2026-04-13.
// M-R1..M-R4 defend against any regression.
//
// Block 4 (artist grouping + modal): tiles now represent a primary artist
// (features bucketed under the first-listed artist), and multi-track
// artists open a fixed modal for track selection instead of the Block 3
// inline flex expansion that awkwardly pushed neighboring tiles down.
// M-R5 asserts the grid shows one tile per primary artist, not per album
// release. M-R6 exercises the modal open/select/close round-trip and
// asserts the main grid shows the "N/M" selection badge afterwards.

test.use({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
});

async function enterAndImport(page: import('@playwright/test').Page) {
  await page.goto('/newmusicfriday');
  await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const skipTour = page.getByText(/Skip tour/i).first();
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  await page.waitForTimeout(300);

  const importBtn = page.getByRole('button', { name: /Import \d+ releases/i });
  await importBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await importBtn.click();
  await page.waitForTimeout(3500);
}

test('M-R1: no image exceeds half the mobile viewport after import', async ({
  page,
}) => {
  await enterAndImport(page);
  const oversized = await page.evaluate(() => {
    const vw = window.innerWidth;
    return Array.from(document.querySelectorAll('img'))
      .map((img) => {
        const r = img.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), src: img.src.slice(0, 80) };
      })
      .filter((i) => i.w > vw / 2 + 20 || i.h > vw / 2 + 20);
  });
  expect(
    oversized,
    'No img element may render wider or taller than half the mobile viewport',
  ).toEqual([]);
});

test('M-R2: no grid container scrolls horizontally on mobile', async ({
  page,
}) => {
  await enterAndImport(page);
  const overflows = await page.evaluate(() => {
    const vw = window.innerWidth;
    return Array.from(document.querySelectorAll('[style*="grid-template-columns"]'))
      .map((g) => {
        const r = (g as HTMLElement).getBoundingClientRect();
        return {
          gridTemplateColumns: getComputedStyle(g).gridTemplateColumns,
          width: Math.round(r.width),
          scrollWidth: (g as HTMLElement).scrollWidth,
          overflowing: (g as HTMLElement).scrollWidth > vw + 2,
        };
      })
      .filter((g) => g.overflowing);
  });
  expect(overflows).toEqual([]);
});

test('M-R3: body scrollWidth does not exceed viewport width', async ({
  page,
}) => {
  await enterAndImport(page);
  const body = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth + 1);
});

test('M-R4: grid columns resolve to even halves (minmax(0, 1fr) pattern)', async ({
  page,
}) => {
  await enterAndImport(page);
  const grids = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[style*="grid-template-columns"]'))
      .map((g) => {
        const cs = getComputedStyle(g);
        const cols = cs.gridTemplateColumns.split(' ').map((v) => parseFloat(v));
        return {
          raw: cs.gridTemplateColumns,
          cols,
          childCount: g.children.length,
        };
      })
      .filter((g) => g.childCount > 4 && g.cols.length === 2);
  });
  for (const g of grids) {
    const [a, b] = g.cols;
    const ratio = Math.max(a, b) / Math.min(a, b);
    expect(ratio).toBeLessThan(1.2);
  }
});

test('M-R5: tiles are one per artist, not one per album release', async ({
  page,
}) => {
  await enterAndImport(page);
  // A duplicate artist name across tiles indicates we're still tile-per-album
  // instead of tile-per-artist.
  const artistNames = await page.evaluate(() => {
    const tiles = Array.from(
      document.querySelectorAll('[style*="grid-template-columns"] > div'),
    );
    // Artist name is the first line of text inside each tile's caption block.
    // Take the first non-empty bold-ish span.
    return tiles
      .map((t) => {
        const captions = t.querySelectorAll('div[style*="font-weight: 600"]');
        return captions[0]?.textContent?.trim() || '';
      })
      .filter((n) => n.length > 0);
  });
  const unique = new Set(artistNames);
  // If every tile has a unique artist name, grouping is correct. Allow a
  // small tolerance in case a single test dataset has an edge case.
  const duplicates = artistNames.length - unique.size;
  expect(duplicates, `Saw duplicate artist names across tiles: ${
    artistNames.filter((n, i) => artistNames.indexOf(n) !== i).slice(0, 5).join(', ')
  }`).toBeLessThanOrEqual(1);
});

test('M-R6: multi-track artist tap opens modal, selections persist on main grid', async ({
  page,
}) => {
  const outDir = '/tmp/mobile_probe';
  fs.mkdirSync(outDir, { recursive: true });
  await enterAndImport(page);
  await page.screenshot({ path: `${outDir}/block4_01_grid.png`, fullPage: false });

  // Find a tile whose caption text contains " releases" or ">1 tracks" — a
  // multi-track artist. We scan tile caption lines for that marker.
  const multiTrackTile = await page.evaluate(() => {
    const tiles = Array.from(
      document.querySelectorAll('[style*="grid-template-columns"] > div'),
    );
    for (let i = 0; i < tiles.length; i++) {
      const text = tiles[i].textContent || '';
      // "3 tracks", "5 tracks", "2 releases"... anything > 1
      const trackMatch = text.match(/(\d+)\s+tracks?/);
      const releaseMatch = text.match(/(\d+)\s+releases?/);
      const tracks = trackMatch ? parseInt(trackMatch[1], 10) : 0;
      const releases = releaseMatch ? parseInt(releaseMatch[1], 10) : 0;
      if (tracks >= 2 || releases >= 2) return i;
    }
    return -1;
  });
  expect(multiTrackTile, 'expected at least one multi-track artist in the grid').toBeGreaterThanOrEqual(0);

  const tile = page.locator('[style*="grid-template-columns"] > div').nth(multiTrackTile);
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: `${outDir}/block4_02_modal_open.png`, fullPage: false });

  // The modal has a Done button that doesn't exist on the main grid.
  const doneBtn = page.getByRole('button', { name: /^Done$/ });
  await expect(doneBtn).toBeVisible();

  // Tap the first track's row to select it. Track rows contain the text of
  // a track name alongside a checkbox div.
  const firstTrackRow = page.locator('div[style*="min-height: 44px"]').first();
  await firstTrackRow.click();
  await page.waitForTimeout(200);

  await page.screenshot({ path: `${outDir}/block4_03_track_selected.png`, fullPage: false });

  await doneBtn.click();
  await page.waitForTimeout(400);

  // Modal closed — Done button gone.
  await expect(doneBtn).toHaveCount(0);

  await page.screenshot({ path: `${outDir}/block4_04_after_close.png`, fullPage: false });

  // The selection badge "1/N" should be visible somewhere in the main grid.
  const badge = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('div'))
      .filter((d) => /^\d+\/\d+$/.test((d.textContent || '').trim()))
      .map((d) => d.textContent?.trim());
    return badges[0] || null;
  });
  expect(badge, 'expected a "N/M" selection badge on the main grid after closing the modal').toBeTruthy();
});
