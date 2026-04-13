import { test, expect } from '@playwright/test';

// Wave 7 Block 3 — mobile regression guard.
// The canonical bug this file exists to prevent: `grid-template-columns:
// repeat(2, 1fr)` without `minmax(0, 1fr)` lets CSS grid cells size to
// min-content, and any child with `white-space: nowrap` (album title,
// artist name) pushes the cell's min-content to the text's natural width.
// On /newmusicfriday results view this turned a 393px mobile viewport's
// 2-col grid into a ~1509px horizontal wall where every album cover
// rendered at 1193x1193 — the screenshot Max shared on 2026-04-13.
//
// This file runs the full post-import mobile flow and asserts no image
// is wider than the viewport. If a future change reintroduces a
// `min-content` blow-out in any grid on this page, these assertions fire.

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
  // Grid hydration + first images. Generous to avoid flakes on cold prod.
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
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          src: img.src.slice(0, 80),
        };
      })
      // Half viewport + a small tolerance — the real album covers at 2-col
      // land around 176px, well under 200.
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
  expect(
    overflows,
    'No grid may scroll wider than the viewport (indicates min-content blow-out)',
  ).toEqual([]);
});

test('M-R3: body scrollWidth does not exceed viewport width', async ({
  page,
}) => {
  await enterAndImport(page);
  const body = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // A 1px tolerance for sub-pixel rounding.
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
    expect(
      ratio,
      `grid-template-columns ${g.raw} is uneven (ratio ${ratio.toFixed(2)}) — likely a min-content blow-out`,
    ).toBeLessThan(1.2);
  }
});
