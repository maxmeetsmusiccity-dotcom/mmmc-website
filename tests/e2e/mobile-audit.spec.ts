import { test } from '@playwright/test';
import * as fs from 'fs';

// Wave 7 Block 5 — full mobile audit. Walks the production site end-to-end
// on a 393x852 iPhone 14 Pro emulation, touching every feature Max listed
// in the addendum plus the remaining flow below it. Captures numbered
// screenshots + a JSON report at /tmp/mobile_audit/*. This is not a
// regression guard — it's a diagnostic sweep run on demand. Results are
// summarized in the assistant response.

test.use({
  viewport: { width: 393, height: 852 },
  isMobile: true,
  hasTouch: true,
});

type Finding = { step: string; status: 'pass' | 'fail' | 'warn' | 'info'; note: string };

test('audit: full mobile walkthrough', async ({ page }) => {
  const outDir = '/tmp/mobile_audit';
  fs.mkdirSync(outDir, { recursive: true });

  const findings: Finding[] = [];
  const shot = async (id: string, label: string) => {
    await page.screenshot({ path: `${outDir}/${id}_${label}.png`, fullPage: false });
  };
  const record = (step: string, status: Finding['status'], note: string) => {
    findings.push({ step, status, note });
    console.log(`[${status.toUpperCase()}] ${step}: ${note}`);
  };

  // ---- STEP 1: Landing page ----
  try {
    await page.goto('/newmusicfriday');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    const hasHeading = await page.getByRole('heading', { name: /New Music Friday/ }).isVisible().catch(() => false);
    const hasGuestBtn = await page.getByRole('button', { name: /Get Started as a Guest/i }).isVisible().catch(() => false);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    await shot('01', 'landing');
    if (hasHeading && hasGuestBtn && !overflow) {
      record('1. Landing page', 'pass', 'New Music Friday heading + Get Started button visible, no overflow');
    } else {
      record('1. Landing page', 'fail', `heading=${hasHeading} guestBtn=${hasGuestBtn} overflow=${overflow}`);
    }
  } catch (e) {
    record('1. Landing page', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 2: Get Started as Guest ----
  try {
    await page.getByRole('button', { name: /Get Started as a Guest/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const skipTour = page.getByText(/Skip tour/i).first();
    if (await skipTour.isVisible().catch(() => false)) {
      await skipTour.click();
      await page.waitForTimeout(300);
      record('2. Onboarding tour', 'info', 'Tour appeared, skipped');
    }
    const readyToScan = await page.getByText(/Ready to Scan/i).isVisible().catch(() => false);
    await shot('02', 'post_guest');
    record('2. Guest bypass', readyToScan ? 'pass' : 'warn', readyToScan ? 'Reached "Ready to Scan"' : '"Ready to Scan" not visible (may be scrolled or layout varies)');
  } catch (e) {
    record('2. Guest bypass', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 3: Source selector ----
  try {
    const sources = ['Nashville', 'Spotify', 'Apple Music', 'Manual'];
    const seen: string[] = [];
    for (const s of sources) {
      const v = await page.getByText(new RegExp(`^${s}$`, 'i')).first().isVisible().catch(() => false);
      if (v) seen.push(s);
    }
    record('3. Source selector', seen.length >= 3 ? 'pass' : 'warn', `visible sources: ${seen.join(', ')}`);
  } catch (e) {
    record('3. Source selector', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 4: Import 134 releases ----
  let importedCount = 0;
  try {
    const importBtn = page.getByRole('button', { name: /Import \d+ releases/i });
    if (await importBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const label = await importBtn.textContent();
      const m = label?.match(/Import (\d+) releases/);
      importedCount = m ? parseInt(m[1], 10) : 0;
      await importBtn.click();
      await page.waitForTimeout(4000);
      await shot('04', 'post_import');
      record('4. Import releases', 'pass', `Imported ${importedCount} releases`);
    } else {
      record('4. Import releases', 'fail', 'Import button not visible');
    }
  } catch (e) {
    record('4. Import releases', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 5: Top toolbar — count, search, filter pills ----
  try {
    const countText = await page.locator('span.mono').first().textContent().catch(() => '');
    const hasSearch = await page.locator('input[placeholder*="Search" i]').isVisible().catch(() => false);
    const filterPills = await page.locator('button.filter-pill').count().catch(() => 0);
    await shot('05', 'toolbar');
    record('5. Top toolbar', 'pass', `count="${countText?.trim()}" searchBox=${hasSearch} filterPills=${filterPills}`);
  } catch (e) {
    record('5. Top toolbar', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 6: Artist grid (tiles, 2 columns, no overflow) ----
  try {
    const tiles = page.locator('[style*="grid-template-columns"] > div');
    const tileCount = await tiles.count();
    const gridInfo = await page.evaluate(() => {
      const g = document.querySelector('[style*="grid-template-columns"]') as HTMLElement | null;
      if (!g) return null;
      const cs = getComputedStyle(g);
      return { cols: cs.gridTemplateColumns, width: g.getBoundingClientRect().width, scrollWidth: g.scrollWidth };
    });
    await shot('06', 'artist_grid');
    record('6. Artist grid', tileCount >= 4 ? 'pass' : 'warn',
      `${tileCount} tiles, grid-template-columns="${gridInfo?.cols}", width=${Math.round(gridInfo?.width || 0)}, scrollWidth=${gridInfo?.scrollWidth}`);
  } catch (e) {
    record('6. Artist grid', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 7: Single-track selection (tap first tile) ----
  let singleSelected = false;
  try {
    const tiles = page.locator('[style*="grid-template-columns"] > div');
    const total = Math.min(await tiles.count(), 20);
    for (let i = 0; i < total; i++) {
      await tiles.nth(i).click();
      await page.waitForTimeout(200);
      const modalOpen = await page.getByRole('button', { name: /^Done$/ }).isVisible().catch(() => false);
      if (modalOpen) {
        await page.locator('[style*="rgba(0, 0, 0, 0.6)"]').first().click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
        continue;
      }
      singleSelected = true;
      break;
    }
    await shot('07', 'after_single_select');
    const countBadge = await page.locator('[data-testid="tile-badge-count"]').count();
    const ordinalBadge = await page.locator('[data-testid="tile-badge-ordinal"]').count();
    record('7. Single-track tap', singleSelected ? 'pass' : 'fail',
      `selected=${singleSelected} countBadges=${countBadge} ordinalBadges=${ordinalBadge}`);
  } catch (e) {
    record('7. Single-track tap', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 8: Multi-track modal (find and tap a multi-track tile) ----
  let modalOpened = false;
  try {
    const multiIdx = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('[style*="grid-template-columns"] > div'));
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i].textContent || '';
        const trackMatch = t.match(/(\d+)\s+tracks?/);
        const releasesMatch = t.match(/(\d+)\s+releases?/);
        if ((trackMatch && parseInt(trackMatch[1], 10) >= 2) || (releasesMatch && parseInt(releasesMatch[1], 10) >= 2)) {
          return i;
        }
      }
      return -1;
    });
    if (multiIdx >= 0) {
      const tiles = page.locator('[style*="grid-template-columns"] > div');
      await tiles.nth(multiIdx).scrollIntoViewIfNeeded();
      await tiles.nth(multiIdx).click();
      await page.waitForTimeout(500);
      modalOpened = await page.getByRole('button', { name: /^Done$/ }).isVisible().catch(() => false);
      await shot('08', 'modal_open');
      record('8. Multi-track modal open', modalOpened ? 'pass' : 'fail',
        `tile #${multiIdx} tapped, Done button visible=${modalOpened}`);
    } else {
      record('8. Multi-track modal open', 'warn', 'No multi-track artist found in grid (unusual — dataset should have several)');
    }
  } catch (e) {
    record('8. Multi-track modal open', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 9: Modal checkboxes and cover feature star ----
  if (modalOpened) {
    try {
      // Find the first track row inside the modal. Track rows have a
      // min-height of 44px per the Wave 7 Block 4 touch-target rule.
      const trackRows = page.locator('div[style*="min-height: 44px"]');
      const rowCount = await trackRows.count();
      if (rowCount > 0) {
        await trackRows.first().click();
        await page.waitForTimeout(200);
        // After selection, star should appear
        const starBtn = page.locator('button[title*="cover feature" i]').first();
        const starVisible = await starBtn.isVisible().catch(() => false);
        if (starVisible) {
          await starBtn.click();
          await page.waitForTimeout(200);
        }
        await shot('09', 'modal_track_selected');
        record('9. Modal track + cover', 'pass',
          `${rowCount} track rows, first toggled, cover star visible=${starVisible}`);
      } else {
        record('9. Modal track + cover', 'warn', 'No track rows found with min-height:44px');
      }
    } catch (e) {
      record('9. Modal track + cover', 'fail', `exception: ${(e as Error).message}`);
    }
  }

  // ---- STEP 10: Close modal via Done button ----
  if (modalOpened) {
    try {
      await page.getByRole('button', { name: /^Done$/ }).click();
      await page.waitForTimeout(400);
      const stillOpen = await page.getByRole('button', { name: /^Done$/ }).isVisible().catch(() => false);
      await shot('10', 'after_modal_close');
      record('10. Modal close via Done', !stillOpen ? 'pass' : 'fail',
        stillOpen ? 'Modal still open after Done click' : 'Modal closed');
    } catch (e) {
      record('10. Modal close via Done', 'fail', `exception: ${(e as Error).message}`);
    }
  }

  // ---- STEP 11: Selection badges after modal round-trip ----
  try {
    const countBadges = await page.locator('[data-testid="tile-badge-count"]').count();
    const ordinalBadges = await page.locator('[data-testid="tile-badge-ordinal"]').count();
    const pair = countBadges >= 1 && ordinalBadges >= 1;
    record('11. Split tile badges', pair ? 'pass' : 'warn',
      `countBadges=${countBadges} ordinalBadges=${ordinalBadges}`);
  } catch (e) {
    record('11. Split tile badges', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 12: Bottom bar — Builder button + Generate ----
  try {
    const builderBtn = page.getByRole('button', { name: /Builder/ });
    const builderVisible = await builderBtn.isVisible().catch(() => false);
    const generateBtn = page.getByRole('button', { name: /Generate/ });
    const generateVisible = await generateBtn.isVisible().catch(() => false);
    record('12. Bottom bar', builderVisible && generateVisible ? 'pass' : 'fail',
      `builder=${builderVisible} generate=${generateVisible}`);
  } catch (e) {
    record('12. Bottom bar', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 13: Open builder sheet ----
  try {
    await page.getByRole('button', { name: /Builder/ }).click();
    await page.waitForTimeout(500);
    await shot('13', 'builder_open');
    const heading = await page.getByText(/^Carousel Builder$/).isVisible().catch(() => false);
    const closeX = await page.getByRole('button', { name: /Close carousel builder/i }).isVisible().catch(() => false);
    record('13. Builder sheet', heading && closeX ? 'pass' : 'fail',
      `heading=${heading} closeX=${closeX}`);
  } catch (e) {
    record('13. Builder sheet', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 14: Builder section order ----
  try {
    const order = await page.evaluate(() => {
      const labels = ['Shape', 'Tracks per slide', 'Center Logo', 'Title Slide', 'Grid Slide'];
      const positions: Record<string, number> = {};
      for (const label of labels) {
        const el = Array.from(document.querySelectorAll('p'))
          .find(p => (p.textContent || '').trim() === label);
        positions[label] = el ? Math.round(el.getBoundingClientRect().top) : -1;
      }
      return positions;
    });
    const coverFeatureSet = order['Title Slide'] !== -1;
    const validOrder =
      order['Shape'] > 0 &&
      order['Tracks per slide'] > order['Shape'] &&
      order['Center Logo'] > order['Tracks per slide'] &&
      order['Grid Slide'] > order['Center Logo'];
    record('14. Builder section order',
      validOrder ? 'pass' : 'fail',
      `${JSON.stringify(order)}; Title Slide visible=${coverFeatureSet}`);
  } catch (e) {
    record('14. Builder section order', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 15: Live grid preview rendered ----
  try {
    const gridPreview = page.locator('[data-testid="builder-grid-preview"]');
    await gridPreview.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500); // debounce + canvas work
    const hasImg = await gridPreview.locator('img').count();
    await shot('15', 'builder_grid_preview');
    record('15. Live grid preview', hasImg > 0 ? 'pass' : 'fail', `grid preview <img> count=${hasImg}`);
  } catch (e) {
    record('15. Live grid preview', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 16: Close builder via X button ----
  try {
    await page.getByRole('button', { name: /Close carousel builder/i }).click();
    await page.waitForTimeout(400);
    const stillOpen = await page.getByText(/^Carousel Builder$/).isVisible().catch(() => false);
    await shot('16', 'after_builder_close');
    record('16. Builder close via X', !stillOpen ? 'pass' : 'fail',
      stillOpen ? 'Builder sheet still visible' : 'Builder dismissed');
  } catch (e) {
    record('16. Builder close via X', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 17: Persistent target counter (Block 5D) ----
  // After Block 5D the top toolbar shows "{selections.length}/{targetCount}"
  // via a data-testid-tagged span. Also verify the target <select> dropdown
  // exists and that a "New Scan" button is present.
  try {
    const counterText = (await page.locator('[data-testid="mobile-target-counter"]').textContent())?.trim() || '';
    const matches = /^(\d+)\s*\/\s*(\d+)\s*$/.test(counterText);
    const selectExists = await page.locator('[data-testid="mobile-target-select"]').isVisible().catch(() => false);
    const newScanExists = await page.getByRole('button', { name: /^New\s*(Scan)?$/ }).isVisible().catch(() => false);
    record('17. Persistent target counter',
      matches && selectExists && newScanExists ? 'pass' : 'fail',
      `counter="${counterText}" regexOk=${matches} select=${selectExists} newScan=${newScanExists}`);
  } catch (e) {
    record('17. Persistent target counter', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 18: Search filter ----
  try {
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('a');
      await page.waitForTimeout(400);
      const countAfter = await page.locator('[style*="grid-template-columns"] > div').count();
      await searchInput.fill('');
      await page.waitForTimeout(300);
      const countRestored = await page.locator('[style*="grid-template-columns"] > div').count();
      record('18. Search filter', countRestored > countAfter || countRestored > 0 ? 'pass' : 'warn',
        `after="a"=${countAfter} tiles, after clear=${countRestored} tiles`);
    } else {
      record('18. Search filter', 'warn', 'Search input not visible');
    }
  } catch (e) {
    record('18. Search filter', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 19: Sort toggle ----
  try {
    const sortPills = page.locator('button.filter-pill').filter({ hasText: /Artist|Date|Title/ });
    const sortCount = await sortPills.count();
    if (sortCount > 0) {
      await sortPills.nth(1).click();
      await page.waitForTimeout(200);
      record('19. Sort toggle', 'pass', `${sortCount} sort pills, tapped second`);
    } else {
      record('19. Sort toggle', 'warn', 'No sort pills found');
    }
  } catch (e) {
    record('19. Sort toggle', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 20: Generate carousel → slides view ----
  try {
    const generateBtn = page.getByRole('button', { name: /^\s*★?\s*Generate/ }).first();
    await generateBtn.scrollIntoViewIfNeeded();
    await generateBtn.click();
    // Generation takes a while — wait for either the Back button (slides view)
    // or an error.
    await page.waitForTimeout(6000);
    const backBtn = page.getByRole('button', { name: /Back to tracks/i });
    const backVisible = await backBtn.isVisible().catch(() => false);
    const hasSlideImg = await page.locator('img[alt*="Slide"]').count();
    await shot('20', 'slides_view');
    record('20. Generate → slides view', backVisible || hasSlideImg > 0 ? 'pass' : 'warn',
      `back=${backVisible} slideImgs=${hasSlideImg}`);
  } catch (e) {
    record('20. Generate → slides view', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 21: Save to Photos button ----
  try {
    const saveBtn = page.getByRole('button', { name: /Save to Photos|Download All/i });
    const saveVisible = await saveBtn.isVisible().catch(() => false);
    record('21. Save to Photos affordance', saveVisible ? 'pass' : 'warn',
      `visible=${saveVisible}`);
  } catch (e) {
    record('21. Save to Photos affordance', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 22: Back to tracks ----
  try {
    const backBtn = page.getByRole('button', { name: /Back to tracks/i });
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(500);
      const tilesBack = await page.locator('[style*="grid-template-columns"] > div').count();
      record('22. Back to tracks', tilesBack > 0 ? 'pass' : 'warn',
        `tiles restored=${tilesBack}`);
    } else {
      record('22. Back to tracks', 'warn', 'Back button not visible — maybe still generating');
    }
  } catch (e) {
    record('22. Back to tracks', 'fail', `exception: ${(e as Error).message}`);
  }

  // ---- STEP 23: Coming Soon filter pill (if present) ----
  try {
    const csBtn = page.getByRole('button', { name: /🔮 Coming Soon/ });
    const csVisible = await csBtn.isVisible().catch(() => false);
    if (csVisible) {
      await csBtn.evaluate(b => (b as HTMLButtonElement).click());
      await page.waitForTimeout(500);
      const csHeading = await page.getByRole('heading', { name: /Coming Soon/ }).isVisible().catch(() => false);
      await shot('23', 'coming_soon');
      record('23. Coming Soon tab', csHeading ? 'pass' : 'warn',
        `pillVisible=${csVisible} headingVisible=${csHeading}`);
    } else {
      record('23. Coming Soon tab', 'info', 'No Coming Soon pill (may require specific state)');
    }
  } catch (e) {
    record('23. Coming Soon tab', 'fail', `exception: ${(e as Error).message}`);
  }

  // Dump the report to disk for the assistant to read back.
  fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(findings, null, 2));
  console.log('\n=== AUDIT SUMMARY ===');
  for (const f of findings) console.log(`[${f.status.toUpperCase().padEnd(4)}] ${f.step}: ${f.note}`);
  console.log(`\nTotal: ${findings.length}, passes: ${findings.filter(f => f.status === 'pass').length}, warns: ${findings.filter(f => f.status === 'warn').length}, fails: ${findings.filter(f => f.status === 'fail').length}`);
});
