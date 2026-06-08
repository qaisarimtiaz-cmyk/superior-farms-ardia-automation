// ============================================================
//  tests/tc8.ts
//  Test Case 8 — D365: License Plate Deletion Workflow
//
//  Prerequisite:
//    TC2 must have run and produced a batch order. The batch
//    order ID is automatically read from shared-state.json.
//    You can also pass it explicitly as a CLI argument:
//
//      npx ts-node tests/tc8.ts AT-029-20C-001
//
//    Priority: CLI argument → shared-state.json (from TC2)
//
//  Workflow:
//    1.  Login to D365
//    2.  Navigate to CRT Report As Finished staging data
//    3.  Filter by batch order number (from TC2)
//    4.  Scan rows for a synced record; copy its License Plate ID
//    5.  Navigate to Tags or License Plates deletion form
//    6.  Enter LP, save, select all, Delete All
//    7.  Confirm success message
//    8.  Navigate to CRT Reversal staging data
//    9.  Filter by the same LP
//    10. Assert IsReversed = Yes  ← final verification
//
//  Run with:
//  npx ts-node tests/tc8.ts
//  npx ts-node tests/tc8.ts <batch-order-id>   ← overrides shared-state
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }                            from '../config';
import { readSharedState, writeSharedState } from '../utils/shared-state';
import { openAuthedD365 }                    from './helpers/auth-flows';

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

export async function run(browser: Browser, batchOrderIdArg?: string) {

  console.log('Starting Test Case 8 — License Plate Deletion Workflow\n');

  // ── Resolve batch order: CLI argument wins, otherwise read from shared-state.json ──
  let batchOrderId: string;
  if (batchOrderIdArg?.trim()) {
    batchOrderId = batchOrderIdArg.trim();
    console.log(`  Batch Order : ${batchOrderId} (source: CLI argument)`);
  } else {
    const state  = readSharedState();   // throws clearly if TC2 never ran
    batchOrderId = state.batchOrderId;
    console.log(`  Batch Order : ${batchOrderId} (source: shared-state.json from TC2)`);
  }
  console.log();

  let d365Context: BrowserContext | undefined;
  let d365ErrPage: Page | undefined;
  let retrievedLP = '';

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1 — LOGIN TO D365
    // ══════════════════════════════════════════════════════════

    console.log('Step 1: Opening D365...');
    const d365 = await openAuthedD365(browser);
    d365Context = d365.context;
    const page = d365.page;
    d365ErrPage = page;
    console.log('✓ Logged in and dashboard loaded\n');

    /*

    // ══════════════════════════════════════════════════════════
    //  PART 2 — NAVIGATE TO CRT REPORT AS FINISHED STAGING DATA
    // ══════════════════════════════════════════════════════════

    console.log('Step 6: Searching for "CRT Report as finished"...');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(1000);

    const searchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await searchBox.waitFor({ timeout: t.element });
    await searchBox.fill('CRT report');
    await page.waitForTimeout(1500);

    await page.getByRole('option', { name: 'CRT Report as finished' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });

    // ── Wait for the grid filter row — not just networkidle ───
    // The filter comboboxes render in a second async pass after
    // the page shell. This is the real guard against the timeout.
    console.log('  Waiting for CRT grid filter row to render...');
    await waitForGridFilterRow(page, t.dashboard);
    await page.waitForTimeout(1000);
    console.log('✓ On CRT Report As Finished page — grid ready\n');

    // ══════════════════════════════════════════════════════════
    //  PART 3 — FILTER BY BATCH ORDER NUMBER
    //
    //  The codegen-captured aria-label is:
    //    "Filter field: Production,"   ← trailing comma is part of the label
    //  We use a locator that matches this exactly, with a broad
    //  fallback in case the label varies slightly per environment.
    // ══════════════════════════════════════════════════════════

    console.log(`Step 7: Filtering by Production (batch order) = "${batchOrderId}"...`);

    // Primary: exact match from codegen (trailing comma included)
    let productionFilter = page.getByRole('combobox', { name: 'Filter field: Production,' });
    const primaryVisible = await productionFilter.isVisible({ timeout: 5000 }).catch(() => false);

    if (!primaryVisible) {
      // Fallback: partial aria-label match — handles minor label differences
      console.log('  Primary locator not found — trying fallback locator...');
      productionFilter = page.locator('[role="combobox"][aria-label*="Production"]').first();
    }

    await productionFilter.waitFor({ state: 'visible', timeout: t.element });
    await productionFilter.click();
    await productionFilter.fill(batchOrderId);
    await page.waitForTimeout(500);

    console.log('Step 8: Applying Production filter...');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ Production filter applied\n');

    */
   // ══════════════════════════════════════════════════════════
    //  PART 2 — NAVIGATE TO CRT REPORT AS FINISHED STAGING DATA
    // ══════════════════════════════════════════════════════════

    console.log('Step 6: Searching for "CRT Report as finished"...');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(1000);

    const searchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await searchBox.waitFor({ timeout: t.element });
    await searchBox.fill('CRT report');
    await page.waitForTimeout(1500);

    await page.getByRole('option', { name: 'CRT Report as finished' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });

    // Wait for the grid body to appear — this is the reliable signal
    // that the page has fully rendered and column headers are clickable
    console.log('  Waiting for CRT grid to render...');
    await page.locator('.grid-body, [id*="MainGrid"]').first()
      .waitFor({ state: 'visible', timeout: t.dashboard });
    await page.waitForTimeout(1500);
    console.log('✓ On CRT Report As Finished page — grid ready\n');

    // ══════════════════════════════════════════════════════════
    //  PART 3 — FILTER BY BATCH ORDER NUMBER
    //
    //  Codegen approach: click the "Production" column header
    //  text first — this activates the inline column filter,
    //  then fill and Apply.
    // ══════════════════════════════════════════════════════════

    console.log(`Step 7: Filtering by Production (batch order) = "${batchOrderId}"...`);

    // Click the Production column header to activate its filter
    await page.getByText('Production', { exact: true }).click();
    await page.waitForTimeout(800);

    // Now the combobox for this column becomes active — use the
    // exact aria-label from codegen (trailing comma is intentional)
    const productionFilter = page.getByRole('combobox', { name: 'Filter field: Production,' });
    await productionFilter.waitFor({ state: 'visible', timeout: t.element });
    await productionFilter.fill(batchOrderId);
    await page.waitForTimeout(500);

    console.log('Step 8: Applying Production filter...');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ Production filter applied\n');

    // ══════════════════════════════════════════════════════════
    //  PART 4 — PICK FIRST SYNCED ROW AND COPY LICENSE PLATE ID
    //
    //  D365 CRT staging rows may not all be synced yet.
    //  A row is "synced" when IsSync = ✓ (visible in screenshot).
    //  Strategy: iterate rows 0, 1, 2 … read the LP cell title.
    //  If none of the first MAX_ROWS rows are synced we throw so
    //  the operator knows to re-run after the sync window.
    // ══════════════════════════════════════════════════════════

    console.log('Step 9: Scanning rows for a synced License Plate ID...');

    const MAX_ROWS = 5;

    for (let rowIndex = 0; rowIndex < MAX_ROWS; rowIndex++) {
      console.log(`  Checking row ${rowIndex}...`);

      // Select the row so D365 activates it (needed to render full cell values)
      const rowCheckbox = page.locator(`#MainGrid_203_0-row-${rowIndex}`).getByRole('checkbox', {
        name: 'Select or unselect row',
      });
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
      const titledEls = await page.locator(`#MainGrid_203_0-row-${rowIndex} [title]`).all();
      for (const el of titledEls) {
        const t2 = (await el.getAttribute('title') ?? '').trim();
        if (/^[A-Z0-9]{6,}$/i.test(t2)) {
          retrievedLP = t2;
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
        'Wait for CRT sync to complete and re-run.'
      );
    }

    console.log(`\n✓ Using License Plate ID: ${retrievedLP}\n`);

    // Persist LP back into shared-state so future TCs can chain off it
    writeSharedState({
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

    // ══════════════════════════════════════════════════════════
    //  PART 6 — ENTER LP AND DELETE
    // ══════════════════════════════════════════════════════════

    console.log('Step 11: Clicking Edit...');
    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log(`Step 12: Entering License Plate ID [${retrievedLP}]...`);
    const tagNumCtrl = page.locator('#f3prodappscanneddeletedbarcode_4_tagNumCtrl_input');
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

    // ── Confirm the success banner / message ──────────────────
    console.log('Step 16: Waiting for deletion success confirmation...');
    const successMsg = page.getByText('scanning process completed for tags deletion', { exact: true });
    const msgVisible = await successMsg.isVisible({ timeout: t.element }).catch(() => false);
    if (msgVisible) {
      console.log('✓ Deletion success message confirmed\n');
    } else {
      console.log('⚠ Success message not detected — continuing (check manually)\n');
    }

    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    // ── Wait for backend batch job to process the deletion ────
    // The IsReversed flag is set by a D365 batch job that runs
    // after the LP deletion completes. Without this wait the
    // CRT Reversal staging record exists but IsReversed = No.
    // 20 seconds is enough for the batch job to catch up.
    console.log('  Waiting 20 seconds for batch job to process LP deletion...');
    for (let i = 20; i > 0; i -= 5) {
      await page.waitForTimeout(5000);
      console.log(`  ... ${i - 5 > 0 ? i - 5 : 0}s remaining`);
    }
    console.log('  ✓ Wait complete — proceeding to CRT Reversal verification\n');

    /*

    // ══════════════════════════════════════════════════════════
    //  PART 7 — NAVIGATE TO CRT REVERSAL STAGING DATA
    // ══════════════════════════════════════════════════════════

    console.log('Step 17: Navigating to CRT Reversal staging data...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1000);

    const revSearchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await revSearchBox.waitFor({ timeout: t.element });
    await revSearchBox.fill('crt reversal');
    await page.waitForTimeout(1500);

    await page.getByRole('option', { name: /CRT Reversal/i }).first().click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });

    // ── Same grid readiness guard for the reversal page ───────
    console.log('  Waiting for CRT Reversal grid filter row to render...');
    await waitForGridFilterRow(page, t.dashboard);
    await page.waitForTimeout(1000);
    console.log('✓ On CRT Reversal staging data page — grid ready\n');

    // ══════════════════════════════════════════════════════════
    //  PART 8 — FILTER BY LICENSE PLATE
    //
    //  Same pattern as Production filter — use exact codegen
    //  label first, fallback to partial aria-label match.
    // ══════════════════════════════════════════════════════════

    console.log(`Step 18: Filtering CRT Reversal by License Plate = "${retrievedLP}"...`);

    // Primary: exact codegen label (trailing comma is part of D365 aria-label)
    let lpFilter = page.getByRole('combobox', { name: 'Filter field: License plate,' });
    const lpPrimaryVisible = await lpFilter.isVisible({ timeout: 5000 }).catch(() => false);

    if (!lpPrimaryVisible) {
      console.log('  Primary LP locator not found — trying fallback locator...');
      lpFilter = page.locator('[role="combobox"][aria-label*="License plate"]').first();
    }

    await lpFilter.waitFor({ state: 'visible', timeout: t.element });
    await lpFilter.click();
    await lpFilter.fill(retrievedLP);
    await page.waitForTimeout(500);

    console.log('Step 19: Applying License Plate filter...');
    await page.getByRole('button', { name: /Apply/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ License Plate filter applied\n');

    */
   // ══════════════════════════════════════════════════════════
    //  PART 7 — NAVIGATE TO CRT REVERSAL STAGING DATA
    // ══════════════════════════════════════════════════════════

    console.log('Step 17: Navigating to CRT Reversal staging data...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1000);

    const revSearchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await revSearchBox.waitFor({ timeout: t.element });
    await revSearchBox.fill('crt reversal');
    await page.waitForTimeout(1500);

    await page.getByRole('option', { name: /CRT Reversal/i }).first().click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });

    // Same grid body guard
    console.log('  Waiting for CRT Reversal grid to render...');
    await page.locator('.grid-body, [id*="MainGrid"]').first()
      .waitFor({ state: 'visible', timeout: t.dashboard });
    await page.waitForTimeout(1500);
    console.log('✓ On CRT Reversal staging data page — grid ready\n');

    // ══════════════════════════════════════════════════════════
    //  PART 8 — FILTER BY LICENSE PLATE
    // ══════════════════════════════════════════════════════════

    console.log(`Step 18: Filtering CRT Reversal by License Plate = "${retrievedLP}"...`);

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

    // ══════════════════════════════════════════════════════════
    //  PART 9 — VERIFY IsReversed = Yes
    //
    //  The codegen shows the IsReversed column renders as a
    //  checkbox (<input type="checkbox">). A checked checkbox
    //  means IsReversed = Yes (LP successfully deleted/reversed).
    // ══════════════════════════════════════════════════════════

    console.log('Step 20: Verifying IsReversed = Yes for the first matching row...');

    // First confirm at least one row is returned
    const firstRowCheckbox = page.locator('#MainGrid_203_0-row-0').getByRole('checkbox', {
      name: 'Select or unselect row',
    });
    const rowFound = await firstRowCheckbox.isVisible({ timeout: t.element }).catch(() => false);

    if (!rowFound) {
      throw new Error(
        `No rows found in CRT Reversal for License Plate "${retrievedLP}". ` +
        'The deletion may not have propagated yet — re-run after a sync cycle.'
      );
    }

    // Read the IsReversed checkbox state
    // D365 renders boolean columns as a read-only checkbox; we check aria-checked or .isChecked()
    const isReversedCheckbox = page.getByRole('checkbox', { name: 'IsReversed' }).first();
    await isReversedCheckbox.waitFor({ timeout: t.element });

    // Try aria-checked first (most reliable in D365 grids), then .isChecked()
    const ariaChecked = await isReversedCheckbox.getAttribute('aria-checked').catch(() => null);
    const domChecked  = await isReversedCheckbox.isChecked().catch(() => false);

    const isReversed = ariaChecked === 'true' || domChecked === true;

    if (isReversed) {
      console.log(`✓ IsReversed = Yes — License Plate [${retrievedLP}] confirmed deleted/reversed`);
    } else {
      console.log(`⚠ IsReversed = No — License Plate [${retrievedLP}] reversal NOT yet confirmed`);
      console.log('  This may indicate the deletion did not complete, or sync is still pending.');
    }

    // ══════════════════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════════════════

    console.log('\n' + (isReversed ? '✅' : '⚠') + ' Test Case 8 completed');
    console.log(`   Batch Order    : ${batchOrderId}`);
    console.log(`   License Plate  : ${retrievedLP}`);
    console.log(`   IsReversed     : ${isReversed ? 'Yes ✓' : 'No ✗'}\n`);

    if (!isReversed) {
      process.exitCode = 1;
    }

  } catch (error: any) {
    console.error('\n❌ Test Case 8 FAILED');
    console.error(`   Error         : ${error.message ?? error}`);
    console.error(`   Batch Order   : ${batchOrderId}`);
    console.error(`   LP at failure : ${retrievedLP || 'not yet retrieved'}\n`);
    throw error;
  } finally {
    await d365Context?.close();
  }
}

// Run standalone:  npx ts-node tests/tc8.ts <batch-order-id>
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser, process.argv[2]); } finally { await browser.close(); }
  })();
}