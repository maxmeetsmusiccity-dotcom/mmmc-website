# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> home page loads with two product cards
- Location: tests/e2e/smoke.spec.ts:9:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('NMF Curator')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('NMF Curator')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "Max Meets Music City" [level=1] [ref=e5]:
    - text: Max Meets
    - text: Music City
  - paragraph [ref=e6]: Tools for the people who break new music every week.
  - paragraph [ref=e7]: Whether you run an Instagram page, a blog, a newsletter, or a playlist — if you're out here putting new artists in front of ears that need to hear them, this is for you.
  - link "New Music Friday Scan every new release from the artists you follow. Build a carousel in your style. Tag everyone. Push your playlist. All in one session, every Friday. Free for Curators" [ref=e8] [cursor=pointer]:
    - /url: /newmusicfriday
    - generic [ref=e9]:
      - heading "New Music Friday" [level=2] [ref=e10]
      - paragraph [ref=e11]: Scan every new release from the artists you follow. Build a carousel in your style. Tag everyone. Push your playlist. All in one session, every Friday.
      - generic [ref=e12]: Free for Curators
  - generic [ref=e13]:
    - link "This Week's Picks" [ref=e14] [cursor=pointer]:
      - /url: /newmusicfriday/thisweek
    - link "Archive" [ref=e15] [cursor=pointer]:
      - /url: /newmusicfriday/archive
    - link "Submit a Track" [ref=e16] [cursor=pointer]:
      - /url: /newmusicfriday/submit
  - generic [ref=e17]:
    - paragraph [ref=e18]: This platform is built with deep respect for the curators, bloggers, and music journalists who do the work of discovery every week — the indie playlist makers, the Instagram tastemakers, the newsletter writers, and the legacy publications that have been championing artists for decades. You are the bridge between the music and the people. Thank you.
    - paragraph [ref=e19]: — Max Blachman, @maxmeetsmusiccity
  - generic [ref=e20]:
    - link "Nashville Decoder" [ref=e21] [cursor=pointer]:
      - /url: https://nashvilledecoder.com
    - link "CoWrite Compass" [ref=e22] [cursor=pointer]:
      - /url: https://cowritecompass.com
  - generic [ref=e23]:
    - link "Terms" [ref=e24] [cursor=pointer]:
      - /url: /terms
    - link "Privacy" [ref=e25] [cursor=pointer]:
      - /url: /privacy
    - link "Instagram" [ref=e26] [cursor=pointer]:
      - /url: https://instagram.com/maxmeetsmusiccity
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | // Helper: enable guest mode before navigating to auth-gated pages
  4  | async function guestBypass(page: import('@playwright/test').Page) {
  5  |   await page.goto('/');
  6  |   await page.evaluate(() => localStorage.setItem('nmf_guest_mode', '1'));
  7  | }
  8  | 
  9  | test('home page loads with two product cards', async ({ page }) => {
  10 |   await page.goto('/');
> 11 |   await expect(page.getByText('NMF Curator')).toBeVisible();
     |                                               ^ Error: expect(locator).toBeVisible() failed
  12 |   await expect(page.getByText('NMF Intelligence')).toBeVisible();
  13 | });
  14 | 
  15 | test('NMF page loads with guest mode', async ({ page }) => {
  16 |   await guestBypass(page);
  17 |   await page.goto('/newmusicfriday');
  18 |   await expect(page.getByRole('heading', { name: /New Music Friday/ })).toBeVisible();
  19 | });
  20 | 
  21 | test('dashboard loads with guest mode', async ({ page }) => {
  22 |   await guestBypass(page);
  23 |   await page.goto('/dashboard');
  24 |   // Dashboard shows a heading regardless of role — page loaded
  25 |   const heading = page.getByRole('heading').first();
  26 |   await expect(heading).toBeVisible();
  27 | });
  28 | 
  29 | test('submission page loads', async ({ page }) => {
  30 |   await page.goto('/newmusicfriday/submit');
  31 |   await expect(page.getByRole('heading', { name: /Submit/ })).toBeVisible();
  32 | });
  33 | 
  34 | test('terms page loads', async ({ page }) => {
  35 |   await page.goto('/terms');
  36 |   await expect(page.getByRole('heading', { name: /Terms of Service/ })).toBeVisible();
  37 | });
  38 | 
  39 | test('privacy page loads', async ({ page }) => {
  40 |   await page.goto('/privacy');
  41 |   await expect(page.getByRole('heading', { name: /Privacy Policy/ })).toBeVisible();
  42 | });
  43 | 
  44 | test('archive page loads', async ({ page }) => {
  45 |   await page.goto('/newmusicfriday/archive');
  46 |   await expect(page.getByRole('heading', { name: 'Archive', exact: true })).toBeVisible();
  47 | });
  48 | 
  49 | test('this week page loads', async ({ page }) => {
  50 |   await page.goto('/newmusicfriday/thisweek');
  51 |   await expect(page.getByRole('heading', { name: /This Week/ })).toBeVisible();
  52 | });
  53 | 
  54 | test('NMF page shows connect options when no token', async ({ page }) => {
  55 |   await guestBypass(page);
  56 |   await page.goto('/newmusicfriday');
  57 |   // Without Spotify token, should show the Connect Spotify heading
  58 |   await expect(page.getByRole('heading', { name: /Connect.*Spotify/ })).toBeVisible();
  59 |   await expect(page.getByRole('button', { name: /Try Demo/ })).toBeVisible();
  60 | });
  61 | 
```