import { test, expect } from '@playwright/test';

test('home page loads with two product cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=NMF Curator')).toBeVisible();
  await expect(page.locator('text=NMF Intelligence')).toBeVisible();
});

test('NMF page loads with admin bypass', async ({ page }) => {
  await page.goto('/newmusicfriday?admin=true');
  await expect(page.locator('text=New Music Friday')).toBeVisible();
});

test('dashboard loads with admin bypass', async ({ page }) => {
  await page.goto('/dashboard?admin=true');
  await expect(page.locator('text=Intelligence')).toBeVisible();
});

test('submission page loads', async ({ page }) => {
  await page.goto('/newmusicfriday/submit');
  await expect(page.locator('text=Submit')).toBeVisible();
});

test('terms page loads', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.locator('text=Terms')).toBeVisible();
});

test('privacy page loads', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.locator('text=Privacy')).toBeVisible();
});

test('archive page loads', async ({ page }) => {
  await page.goto('/newmusicfriday/archive');
  await expect(page.locator('text=Archive')).toBeVisible();
});

test('this week page loads', async ({ page }) => {
  await page.goto('/newmusicfriday/thisweek');
  await expect(page.locator('text=This Week')).toBeVisible();
});
