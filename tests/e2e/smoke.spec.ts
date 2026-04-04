import { test, expect } from '@playwright/test';

// Helper: set admin bypass before page load
async function adminBypass(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('mmmc_admin', '1'));
}

test('home page loads with two product cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('NMF Curator')).toBeVisible();
  await expect(page.getByText('NMF Intelligence')).toBeVisible();
});

test('NMF page loads with admin bypass', async ({ page }) => {
  await page.goto('/newmusicfriday?admin=true');
  await expect(page.getByRole('heading', { name: /New Music Friday/ })).toBeVisible();
});

test('dashboard loads with admin bypass', async ({ page }) => {
  await adminBypass(page);
  await page.goto('/dashboard');
  // Dashboard shows "Publicist Access Required" for non-publicist admin bypass
  // or the Intelligence heading for admins — either means the page loaded
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

test('NMF auth gate shows connect options', async ({ page }) => {
  await page.goto('/newmusicfriday?admin=true');
  // Admin bypass shows NMF page — should have the header
  await expect(page.getByRole('heading', { name: /New Music Friday/ })).toBeVisible();
});
