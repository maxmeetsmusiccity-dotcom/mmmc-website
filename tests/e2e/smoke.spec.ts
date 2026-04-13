import { test, expect } from '@playwright/test';

// Helper: click through the AuthGate's "Get Started as a Guest" button to
// actually enter the app. Prior to Wave 7 this helper only set localStorage,
// which technically worked through a hard-navigation race but was structurally
// blind: the smoke tests were asserting against the AuthGate landing page
// (same "New Music Friday" heading as the app) and passed for 5 waves without
// ever reaching the real app surface. Click-through + in-app assertion is
// the only way to retire that class of ghost-green.
async function guestBypass(page: import('@playwright/test').Page) {
  await page.goto('/newmusicfriday');
  await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
}

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByText('Max Meets')).toBeVisible();
});

test('guest bypass actually reaches the Nashville source selector', async ({ page }) => {
  await guestBypass(page);
  // Marker that only exists inside the app, NOT on the AuthGate landing:
  // the Nashville releases scan surface renders a "Ready to Scan" / "Scan"
  // affordance once guest mode is active.
  const inAppMarker = page.getByText(/Ready to Scan|Nashville Releases|Scan Now/i).first();
  await expect(inAppMarker).toBeVisible({ timeout: 10_000 });
});

test('dashboard loads with guest mode', async ({ page }) => {
  await guestBypass(page);
  await page.goto('/dashboard');
  // Dashboard shows a heading regardless of role — page loaded
  const heading = page.getByRole('heading').first();
  await expect(heading).toBeVisible();
});

test('NMF page shows Nashville source by default for guests', async ({ page }) => {
  await guestBypass(page);
  const nashvilleVisible = page.getByText(/Nashville|Scan/i).first();
  await expect(nashvilleVisible).toBeVisible();
});

test('submission page loads', async ({ page }) => {
  await page.goto('/newmusicfriday/submit');
  await expect(page.getByRole('heading', { name: /Submit/ })).toBeVisible();
});

test('terms page loads', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: /Terms of Service/ })).toBeVisible();
});

test('privacy page loads', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: /Privacy Policy/ })).toBeVisible();
});

test('archive page loads', async ({ page }) => {
  await page.goto('/newmusicfriday/archive');
  await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();
});

test('this week page loads', async ({ page }) => {
  await page.goto('/newmusicfriday/thisweek');
  await expect(page.getByRole('heading', { name: /This Week/ })).toBeVisible();
});

