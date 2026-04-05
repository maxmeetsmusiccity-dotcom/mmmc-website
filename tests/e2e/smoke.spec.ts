import { test, expect } from '@playwright/test';

// Helper: enable guest mode before navigating to auth-gated pages
async function guestBypass(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('nmf_guest_mode', '1'));
}

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByText('Max Meets')).toBeVisible();
});

test('NMF page loads with guest mode', async ({ page }) => {
  await guestBypass(page);
  await page.goto('/newmusicfriday');
  await expect(page.getByRole('heading', { name: /New Music Friday/ })).toBeVisible();
});

test('dashboard loads with guest mode', async ({ page }) => {
  await guestBypass(page);
  await page.goto('/dashboard');
  // Dashboard shows a heading regardless of role — page loaded
  const heading = page.getByRole('heading').first();
  await expect(heading).toBeVisible();
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

test('NMF page shows connect options when no token', async ({ page }) => {
  await guestBypass(page);
  await page.goto('/newmusicfriday');
  // Without Spotify token, should show the Connect Spotify heading
  await expect(page.getByRole('heading', { name: /Connect.*Spotify/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Try Demo/ })).toBeVisible();
});
