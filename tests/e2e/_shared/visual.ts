import * as fs from 'fs';
import type { Page } from '@playwright/test';

/**
 * Visual ground truth helper for Wave 8+.
 *
 * Every UI commit should screenshot at both viewports.  This helper
 * standardizes screenshot paths, creates the output directory, and
 * provides a dual-viewport capture function for test files that need
 * both desktop and mobile shots in a single run.
 */

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 393, height: 852 };

export interface ScreenshotOptions {
  /** Base output directory (default: /tmp/visual_ground_truth) */
  outDir?: string;
  /** Filename prefix (e.g. "rubberband", "builder") */
  prefix: string;
  /** Step label (e.g. "01_before", "02_after") */
  step: string;
  /** Whether to capture fullPage (default: false) */
  fullPage?: boolean;
}

/** Ensure the output directory exists and return it. */
function ensureDir(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Take a screenshot with a standardized path.
 *  Returns the path to the saved screenshot. */
export async function screenshot(page: Page, opts: ScreenshotOptions): Promise<string> {
  const dir = ensureDir(opts.outDir || '/tmp/visual_ground_truth');
  const viewport = page.viewportSize();
  const suffix = viewport && viewport.width <= 500 ? 'mobile' : 'desktop';
  const path = `${dir}/${opts.prefix}_${opts.step}_${suffix}.png`;
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  return path;
}

/** Capture at both viewports in sequence.
 *  Restores the original viewport after both captures.
 *  Returns [desktopPath, mobilePath]. */
export async function dualViewportScreenshot(
  page: Page,
  opts: Omit<ScreenshotOptions, 'step'> & { step: string },
): Promise<[string, string]> {
  const original = page.viewportSize();
  const dir = ensureDir(opts.outDir || '/tmp/visual_ground_truth');

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.waitForTimeout(300); // layout settle
  const desktopPath = `${dir}/${opts.prefix}_${opts.step}_desktop.png`;
  await page.screenshot({ path: desktopPath, fullPage: opts.fullPage ?? false });

  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.waitForTimeout(300);
  const mobilePath = `${dir}/${opts.prefix}_${opts.step}_mobile.png`;
  await page.screenshot({ path: mobilePath, fullPage: opts.fullPage ?? false });

  // Restore original viewport
  if (original) {
    await page.setViewportSize(original);
  }

  return [desktopPath, mobilePath];
}

/** Navigate to NMF, bypass auth gate, and wait for app surface. */
export async function guestBypass(page: Page): Promise<void> {
  await page.goto('/newmusicfriday');
  await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const skipTour = page.getByText(/Skip tour/i).first();
  if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
}

/** Import releases and wait for the post-import grid to render. */
export async function importAndWait(page: Page): Promise<number> {
  await page.getByRole('button', { name: /Import \d+ releases/i }).click();
  await page.waitForTimeout(4000);
  const count = await page.locator('[data-artist-key]').count();
  return count;
}
