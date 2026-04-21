import { test, expect } from '@playwright/test';

/**
 * Writer-claim flow end-to-end spec.
 *
 * Red-zone discipline: this test NEVER causes a real email to leave Resend.
 * It intercepts the magic-link URL from the POST /api/claim/send response
 * (which is always included in the JSON regardless of the feature flag) and
 * navigates directly to it. The feature flag REAL_WRITER_SENDS_AUTHORIZED
 * MUST default OFF for this to be safe in CI.
 *
 * Requires:
 *   - Dev server running at baseURL (localhost:4173 or E2E_API_BASE in prod)
 *   - MAGIC_LINK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env
 *   - A real pg_id that exists in instagram_handles.nd_pg_id for `ndExistingPgId`
 *
 * If E2E_API_BASE is unset (local dev), this spec is skipped to avoid
 * running against a server that may not have the necessary env vars.
 */

const pgIdEnv = process.env.E2E_CLAIM_PG_ID;

test.describe('Writer claim flow', () => {
  test.skip(!pgIdEnv, 'E2E_CLAIM_PG_ID not set — skipping (run this spec against a live env)');
  const pgId = pgIdEnv!;

  test('happy path: send → verify → submit renders done state', async ({ page, request }) => {
    // 1. Request a magic link (defaults to Max's inbox; feature flag off = no email sent)
    const sendResp = await request.post('/api/claim/send', {
      data: { pg_id: pgId },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(sendResp.status(), await sendResp.text()).toBe(200);
    const sendBody = await sendResp.json();
    expect(sendBody.ok).toBe(true);
    expect(sendBody.url).toContain('/claim/');
    expect(sendBody.feature_flags.real_writer_sends_authorized).toBe(false);

    // 2. Navigate to the claim URL directly (never actually opens an email)
    const url = sendBody.url.replace(/^https?:\/\/[^/]+/, ''); // strip host; let baseURL apply
    await page.goto(url);

    // 3. Verify state transitions to 'ready' with writer context
    const form = page.getByTestId('claim-form');
    await expect(form).toBeVisible();
    await expect(page.getByTestId('claim-artist-name')).toBeVisible();

    // 4. Fill + submit
    const confirmed = page.getByTestId('claim-confirmed-handle');
    await confirmed.fill('@playwright_test_handle');
    await page.getByTestId('claim-notes').fill('Playwright e2e — test submission');
    await page.getByTestId('claim-submit').click();

    // 5. Done state appears
    const done = page.getByTestId('claim-done');
    await expect(done).toBeVisible({ timeout: 10_000 });
    await expect(done).toContainText('Submission received');
  });

  test('tampered token fails HMAC check', async ({ page, request }) => {
    const sendResp = await request.post('/api/claim/send', {
      data: { pg_id: pgId },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(sendResp.status()).toBe(200);
    const { url } = await sendResp.json();
    // Replace the last character of the signature segment to break HMAC.
    const tampered = url.replace(/.$/, 'X');
    const pathOnly = tampered.replace(/^https?:\/\/[^/]+/, '');
    await page.goto(pathOnly);
    const err = page.getByTestId('claim-error');
    await expect(err).toBeVisible({ timeout: 5_000 });
    await expect(err).toContainText(/Invalid token|bad_signature|malformed/i);
  });

  test('reusing the same token returns single-use error', async ({ page, request }) => {
    const sendResp = await request.post('/api/claim/send', {
      data: { pg_id: pgId },
      headers: { 'Content-Type': 'application/json' },
    });
    const { url } = await sendResp.json();
    const pathOnly = url.replace(/^https?:\/\/[^/]+/, '');

    // First use — submit successfully
    await page.goto(pathOnly);
    await page.getByTestId('claim-confirmed-handle').fill('@test_single_use');
    await page.getByTestId('claim-submit').click();
    await expect(page.getByTestId('claim-done')).toBeVisible({ timeout: 10_000 });

    // Second use — single-use error
    await page.goto(pathOnly);
    const err = page.getByTestId('claim-error');
    await expect(err).toBeVisible({ timeout: 5_000 });
    await expect(err).toContainText(/already used|single_use/i);
  });

  test('submit endpoint rejects wrong pg_id', async ({ request }) => {
    const sendResp = await request.post('/api/claim/send', {
      data: { pg_id: pgId },
      headers: { 'Content-Type': 'application/json' },
    });
    const { url } = await sendResp.json();
    const match = url.match(/\/claim\/([^/]+)\/([^/?#]+)/);
    expect(match).not.toBeNull();
    const token = decodeURIComponent(match![2]);

    const resp = await request.post('/api/claim/submit', {
      data: {
        pg_id: 'not-the-original-pg_id-xyz',
        token,
        confirmed_instagram_handle: '@attempted_bypass',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 429]).toContain(resp.status());
    if (resp.status() === 400) {
      const body = await resp.json();
      expect(body.reason).toMatch(/pg_id_mismatch|bad_signature/);
    }
  });
});
