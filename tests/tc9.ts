// ============================================================
//  tests/tc9.ts
//  Test Case 9 — D365: Hangbacks License Plate Deletion Workflow
//
//  Prerequisite:
//    TC3 must have run and produced a hangback batch order. The
//    batch order ID is automatically read from shared-state.json.
//    You can also pass it explicitly as a CLI argument:
//
//      npx ts-node tests/tc9.ts <batch-order-id>
//
//    Priority: CLI argument → shared-state.json (from TC3)
//
//  Workflow:
//    1.  Login to D365
//    2.  Navigate to Hangbacks Report as Finished (staging data)
//    3.  Filter by batch order number (from TC3)
//    4.  Scan rows for a synced record; copy its License Plate ID
//    5.  Navigate to Tags or License Plates deletion form
//    6.  Enter LP in tagNumCtrl, Save, Select All, Delete All
//    7.  Confirm success message: "scanning process completed for tags deletion"
//    8.  Navigate to Hangbacks Reversal staging data
//    9.  Filter by the same LP
//    10. Assert IsReversed = Yes  ← final verification
//
//  Run with:
//    npx ts-node tests/tc9.ts
//    npx ts-node tests/tc9.ts <batch-order-id>   ← overrides shared-state
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }                            from '../config';
import { readSharedState, writeSharedState } from '../utils/shared-state';
import { openAuthedD365 }                    from './helpers/auth-flows';
import { ReportCollector }                   from './helpers/report-collector';
import { screenshotPath }                    from '../utils/run-folder';

const t = config.timeouts;

// ── Helper: wait for the D365 grid filter row to be ready ───
//  D365 grids render in two async passes:
//    Pass 1 — page shell / nav bar (networkidle fires here)
//    Pass 2 — grid header + filter row (combobox inputs appear)
//  We wait for ANY combobox with "Filter field" in its name,
//  which confirms the filter row is fully painted before we
//  try to interact with a specific column filter.
async function waitForGridFilterRow(page: any, timeout: number): Promise<void> {
  await page.locator('[role="combobox"][aria-label*="Filter field"]')
    .first()
    .waitFor({ state: 'visible', timeout });
}

export async function run(browser: Browser, batchOrderIdArg?: string, testInfo: any = null) {

  console.log('Starting Test Case 9 — Hangbacks License Plate Deletion Workflow\n');

  // ── Resolve batch order: CLI argument wins, otherwise read from shared-state.json ──
  let batchOrderId: string;
  if (batchOrderIdArg?.trim()) {
    batchOrderId = batchOrderIdArg.trim();
    console.log(`  Batch Order : ${batchOrderId} (source: CLI argument)`);
  } else {
    const state  = readSharedState('TC03');   // throws clearly if TC3 never ran
    batchOrderId = state.batchOrderId;
    console.log(`  Batch Order : ${batchOrderId} (source: shared-state.json from TC3)`);
  }
  console.log();

  let d365Context: BrowserContext | undefined;
  let d365ErrPage: Page | undefined;

  let retrievedLP = '';
  let isReversed: boolean | null = null;

  const reportTestData: Record<string, string> = { 'Workflow': 'Hangback License Plate Deletion', 'Process': 'Reversal', 'Batch Order': batchOrderId };
  const report = new ReportCollector('Test Case 9', reportTestData);

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1 — LOGIN TO D365
    // ══════════════════════════════════════════════════════════

    console.log('Step 1: Opening D365 (authenticated session)...');
    const d365 = await openAuthedD365(browser);
    d365Context = d365.context;
    const page = d365.page;
    d365ErrPage = page;
    console.log('✓ Logged in and dashboard loaded\n');
    report.add('Login to D365', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 2 — NAVIGATE TO HANGBACKS REPORT AS FINISHED STAGING
    // ══════════════════════════════════════════════════════════

    console.log('Step 6: Searching for "Hangbacks Report as finished"...');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(1000);

    const searchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await searchBox.waitFor({ timeout: t.element });
    await searchBox.fill('hangbacks');
    await page.waitForTimeout(1500);

    await page.getByRole('option', { name: 'Hangbacks Report as finished' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });

    // Wait for the grid body to appear — reliable signal that
    // column headers and filter row are fully rendered
    console.log('  Waiting for Hangbacks staging grid to render...');
    await page.locator('.grid-body, [id*="MainGrid"]').first()
      .waitFor({ state: 'visible', timeout: t.dashboard });
    await page.waitForTimeout(1500);
    console.log('✓ On Hangbacks Report as Finished staging page — grid ready\n');
    report.add('Navigate to Hangbacks Report as Finished staging', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 3 — FILTER BY BATCH ORDER NUMBER (Production column)
    //
    //  Same pattern as TC8: click the "Production" column header
    //  to activate its inline filter, then fill and Apply.
    // ══════════════════════════════════════════════════════════

    console.log(`Step 7: Filtering by Production (batch order) = "${batchOrderId}"...`);

    // Click the Production column header to activate its filter
    await page.getByText('Production', { exact: true }).click();
    await page.waitForTimeout(800);

    const productionFilter = page.getByRole('combobox', { name: 'Filter field: Production,' });
    await productionFilter.waitFor({ state: 'visible', timeout: t.element });
    await productionFilter.fill(batchOrderId);
    await page.waitForTimeout(500);

    console.log('Step 8: Applying Production filter...');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ Production filter applied\n');
    report.add('Filter Hangbacks staging by batch order (Production)', 'PASS', batchOrderId);

    // ══════════════════════════════════════════════════════════
    //  PART 4 — PICK FIRST SYNCED ROW AND COPY LICENSE PLATE ID
    //
    //  Hangbacks staging rows may not all be synced yet.
    //  Strategy: iterate rows 0, 1, 2 … read the LP cell title.
    //  If none of the first MAX_ROWS rows are synced we throw so
    //  the operator knows to re-run after the sync window.
    // ══════════════════════════════════════════════════════════

    console.log('Step 9: Scanning rows for a synced License Plate ID...');

    const MAX_ROWS = 5;

    for (let rowIndex = 0; rowIndex < MAX_ROWS; rowIndex++) {
      console.log(`  Checking row ${rowIndex}...`);

      // Select the row so D365 activates it (needed to render full cell values)
      // #MainGrid_203_0-row-N is a stale form-instance ID (confirmed while
      // fixing TC6/TC7/TC8 — that "_203_0_" prefix no longer resolves
      // anywhere in the current D365 UI). Use the same ID-independent
      // role/name selector proven reliable elsewhere, indexed by row.
      const rowCheckbox = page.getByRole('checkbox', { name: 'Select or unselect row' }).nth(rowIndex);
      const rowExists = await rowCheckbox.isVisible({ timeout: 5000 }).catch(() => false);
      if (!rowExists) {
        console.log(`  Row ${rowIndex} does not exist — stopping scan`);
        break;
      }
      await rowCheckbox.click();
      await page.waitForTimeout(500);

      // Try to read the LicensePlateid cell — D365 puts the value in [title]
      const lpCell = page.locator(
        `[id*="LicensePlateid"][id*="row-${rowIndex}"], ` +
        `[id*="licensePlateid"][id*="row-${rowIndex}"], ` +
        `[id*="LicensePlateId"][id*="row-${rowIndex}"]`
      ).first();

      const cellTitle = await lpCell.getAttribute('title').catch(() => null);

      if (cellTitle && cellTitle.trim() !== '') {
        retrievedLP = cellTitle.trim();
        console.log(`  ✓ Row ${rowIndex} is synced — License Plate ID: ${retrievedLP}`);
        break;
      }

      // Fallback: scan every [title] element in the row for something that
      // looks like a D365 license plate (numeric or alphanumeric, 6+ chars)
      const titledEls = await page.locator(`[id*="row-${rowIndex}"] [title]`).all();
      for (const el of titledEls) {
        const titleVal = (await el.getAttribute('title') ?? '').trim();
        if (/^[A-Z0-9]{6,}$/i.test(titleVal)) {
          retrievedLP = titleVal;
          console.log(`  ✓ Row ${rowIndex} fallback scan — License Plate ID: ${retrievedLP}`);
          break;
        }
      }

      if (retrievedLP) break;

      // Deselect this row before trying the next
      await rowCheckbox.click();
      await page.waitForTimeout(300);
      console.log(`  Row ${rowIndex} not synced — trying next row...`);
    }

    if (!retrievedLP) {
      throw new Error(
        `No synced License Plate found in the first ${MAX_ROWS} rows for batch order "${batchOrderId}". ` +
        'Wait for Hangbacks sync to complete and re-run.'
      );
    }

    console.log(`\n✓ Using License Plate ID: ${retrievedLP}\n`);
    report.add('Scan rows & retrieve synced License Plate ID', 'PASS', retrievedLP);
    await page.screenshot({ path: screenshotPath('screenshot-tc9-lp-retrieved.png') });
    report.addScreenshot('License Plate retrieved', screenshotPath('screenshot-tc9-lp-retrieved.png'));

    // Persist LP into shared-state under TC9's own key (not TC3's — this is
    // TC9's own result) so downstream TCs can chain off it if needed.
    writeSharedState('TC09', {
      batchOrderId,
      licensePlateId: retrievedLP,
      generatedAt:    new Date().toISOString(),
    });

    // ══════════════════════════════════════════════════════════
    //  PART 5 — NAVIGATE TO TAGS OR LICENSE PLATES DELETION FORM
    // ══════════════════════════════════════════════════════════

    console.log('Step 10: Navigating to Tags or license plates deletion form...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1000);

    const delSearchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await delSearchBox.waitFor({ timeout: t.element });
    await delSearchBox.fill('tag');
    await page.waitForTimeout(1500);

    await page.getByRole('option', {
      name: 'Tags or license plates deletion form',
    }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ On Tags or license plates deletion form\n');
    report.add('Navigate to Tags or License Plates deletion form', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 6 — ENTER LP AND DELETE
    //
    //  Pattern mirrors TC8 Part 6:
    //    Edit → fill tagNumCtrl → Save → Select All → Delete All
    //  The tagNumCtrl row index varies per session, so we use a
    //  partial ID match targeting the first available input.
    // ══════════════════════════════════════════════════════════

    console.log('Step 11: Clicking Edit...');
    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log(`Step 12: Entering License Plate ID [${retrievedLP}] in tagNumCtrl...`);
    // Partial ID match — the middle row-index segment varies per session
    const tagNumCtrl = page.locator('[id*="tagNumCtrl_input"]').first();
    await tagNumCtrl.waitFor({ timeout: t.element });
    await tagNumCtrl.click();
    await tagNumCtrl.fill(retrievedLP);
    await page.waitForTimeout(1000);

    console.log('Step 13: Saving the form...');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log('Step 14: Selecting all rows...');
    await page.getByRole('checkbox', { name: 'Select or unselect all rows' }).click();
    await page.waitForTimeout(500);

    console.log('Step 15: Clicking Delete All...');
    await page.getByRole('button', { name: /Delete All/i }).click();
    await page.waitForTimeout(2000);

    // ── Confirmation 1: success banner ────────────────────────
    console.log('Step 16: Waiting for deletion success confirmation...');
    const successMsg = page.getByText('scanning process completed for tags deletion', { exact: true });
    const msgVisible = await successMsg.isVisible({ timeout: t.element }).catch(() => false);
    if (msgVisible) {
      console.log('✓ CONFIRMATION 1 — Deletion success message confirmed\n');
      report.add('Delete License Plate — confirmation message', 'PASS', 'scanning process completed for tags deletion');
    } else {
      console.log('⚠ CONFIRMATION 1 — Success message not detected (check manually)\n');
      report.add('Delete License Plate — confirmation message', 'FAIL', 'Success message not detected');
    }
    await page.screenshot({ path: screenshotPath('screenshot-tc9-deletion-confirmed.png') });
    report.addScreenshot('Deletion confirmation', screenshotPath('screenshot-tc9-deletion-confirmed.png'));

    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    // ── Wait for backend batch job to process the deletion ────
    // The IsReversed flag is set by a D365 batch job that runs
    // after the LP deletion completes. 20 seconds is enough for
    // the batch job to catch up before we check the reversal page.
    console.log('  Waiting 20 seconds for batch job to process LP deletion...');
    for (let i = 20; i > 0; i -= 5) {
      await page.waitForTimeout(5000);
      console.log(`  ... ${i - 5 > 0 ? i - 5 : 0}s remaining`);
    }
    console.log('  ✓ Wait complete — proceeding to Hangbacks Reversal verification\n');
    report.add('Wait for batch job to process LP deletion', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 7 — NAVIGATE TO HANGBACKS REVERSAL STAGING DATA
    // ══════════════════════════════════════════════════════════

    console.log('Step 17: Navigating to Hangbacks Reversal staging data...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1000);

    const revSearchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await revSearchBox.waitFor({ timeout: t.element });
    await revSearchBox.fill('hangbacks');
    await page.waitForTimeout(1500);

    await page.getByRole('option', { name: /Hangbacks reversal/i }).first().click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });

    // Wait for the grid body to be visible before interacting
    console.log('  Waiting for Hangbacks Reversal grid to render...');
    await page.locator('.grid-body, [id*="MainGrid"]').first()
      .waitFor({ state: 'visible', timeout: t.dashboard });
    await page.waitForTimeout(1500);
    console.log('✓ On Hangbacks Reversal staging data page — grid ready\n');
    report.add('Navigate to Hangbacks Reversal staging data', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 8 — FILTER BY LICENSE PLATE
    //
    //  Click the "License plate" column header to activate the
    //  inline filter, fill with our LP, then Apply.
    // ══════════════════════════════════════════════════════════

    console.log(`Step 18: Filtering Hangbacks Reversal by License Plate = "${retrievedLP}"...`);

    // Click the License plate column header to activate its filter
    await page.getByText('License plate', { exact: true }).click();
    await page.waitForTimeout(800);

    const lpFilter = page.getByRole('combobox', { name: 'Filter field: License plate,' });
    await lpFilter.waitFor({ state: 'visible', timeout: t.element });
    await lpFilter.fill(retrievedLP);
    await page.waitForTimeout(500);

    console.log('Step 19: Applying License Plate filter...');
    await page.getByRole('button', { name: /Apply/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ License Plate filter applied\n');
    report.add('Filter Hangbacks Reversal by License Plate', 'PASS', retrievedLP);

    // ══════════════════════════════════════════════════════════
    //  PART 9 — VERIFY IsReversed = Yes  ← CONFIRMATION 2
    //
    //  D365 renders boolean columns as read-only checkboxes.
    //  A checked checkbox = IsReversed = Yes (LP deleted/reversed).
    //  We check aria-checked first (most reliable in D365 grids),
    //  then fall back to .isChecked().
    // ══════════════════════════════════════════════════════════

    console.log('Step 20: Verifying IsReversed = Yes for the first matching row...');

    // Confirm at least one row exists in the filtered result
    // (#MainGrid_203_0-row-0 is stale — see the note near Step 9 above)
    const firstRowCheckbox = page.getByRole('checkbox', { name: 'Select or unselect row' }).first();
    const rowFound = await firstRowCheckbox.isVisible({ timeout: t.element }).catch(() => false);

    if (!rowFound) {
      throw new Error(
        `No rows found in Hangbacks Reversal for License Plate "${retrievedLP}". ` +
        'The deletion may not have propagated yet — re-run after a sync cycle.'
      );
    }

    // Read the IsReversed checkbox state
    const isReversedCheckbox = page.getByRole('checkbox', { name: 'IsReversed' }).first();
    await isReversedCheckbox.waitFor({ timeout: t.element });

    const ariaChecked = await isReversedCheckbox.getAttribute('aria-checked').catch(() => null);
    const domChecked  = await isReversedCheckbox.isChecked().catch(() => false);

    isReversed = ariaChecked === 'true' || domChecked === true;

    if (isReversed) {
      console.log(`✓ CONFIRMATION 2 — IsReversed = Yes — License Plate [${retrievedLP}] confirmed deleted/reversed`);
      report.add('Verify IsReversed = Yes', 'PASS', retrievedLP);
    } else {
      console.log(`⚠ CONFIRMATION 2 — IsReversed = No — License Plate [${retrievedLP}] reversal NOT yet confirmed`);
      console.log('  This may indicate the deletion did not complete, or sync is still pending.');
      report.add('Verify IsReversed = Yes', 'FAIL', `IsReversed = No for LP ${retrievedLP}`);
    }
    await page.screenshot({ path: screenshotPath('screenshot-tc9-isreversed.png') });
    report.addScreenshot('IsReversed verification', screenshotPath('screenshot-tc9-isreversed.png'));

    // ══════════════════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════════════════

    const overallPass = msgVisible && isReversed;

    console.log('\n' + (overallPass ? '✅' : '⚠') + ' Test Case 9 completed');
    console.log(`   Batch Order           : ${batchOrderId}`);
    console.log(`   License Plate         : ${retrievedLP}`);
    console.log(`   Deletion Message      : ${msgVisible  ? 'Confirmed ✓' : 'Not detected ✗'}`);
    console.log(`   IsReversed            : ${isReversed  ? 'Yes ✓'        : 'No ✗'}\n`);

    if (!overallPass) {
      process.exitCode = 1;
    }

  } catch (error: any) {
    report.add('TEST FAILED', 'FAIL', error?.message ?? String(error));
    await d365ErrPage?.screenshot({ path: screenshotPath('screenshot-tc9-error.png') }).catch(() => {});
    report.addScreenshot('Failure screenshot', screenshotPath('screenshot-tc9-error.png'));
    console.error('\n❌ Test Case 9 FAILED');
    console.error(`   Error         : ${error.message ?? error}`);
    console.error(`   Batch Order   : ${batchOrderId}`);
    console.error(`   LP at failure : ${retrievedLP || 'not yet retrieved'}\n`);
    throw error;
  } finally {
    try {
      const meta: Record<string, string> = {
        'Batch Order': batchOrderId,
        'License Plate': retrievedLP || '(not retrieved)',
        'IsReversed': isReversed === null ? 'unconfirmed' : (isReversed ? 'Yes' : 'No'),
      };
      const { excelPath } = await report.finalize(testInfo, meta);
      console.log(`\n📊 Excel report written: ${excelPath}`);
    } catch (repErr: any) {
      console.error(`   ⚠ Failed to write report: ${repErr.message}`);
    }

    await d365Context?.close();
  }
}

// Run standalone:  npx ts-node tests/tc9.ts <batch-order-id>
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser, process.argv[2], null); } finally { await browser.close(); }
  })();
}