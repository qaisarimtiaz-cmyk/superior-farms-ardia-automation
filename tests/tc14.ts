// ============================================================
//  tests/tc1-multibox.ts
//  Test Case 1 (Multi-Box) — D365: Create Batch Order
//               Ardia: Filters + Proceed + Produce N boxes + RAF verify + Stop
//
//  Based on tc1.ts. Differences:
//    1. Produces MULTIPLE boxes (configurable) instead of just one.
//       The count comes from testData.TC01.boxCount (falls back to
//       config.ardia.boxCount, then 10). Each box: enter weight → Enter
//       → verify the RAF API POST returns 200.
//    2. Writes an Excel report (test data + per-step status + overall
//       pass/fail) to ./reports/TC1_MultiBox_Report_<timestamp>.xlsx
//
//  Requires the 'exceljs' package:  npm i exceljs
//
//  Run via the suite:  npx playwright test
//  Run standalone:     npx ts-node tests/tc1-multibox.ts
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }    from '../config';
import { testData }  from '../test-data';
import { generateBatchOrderId, peekNextId } from '../utils/generate-id';
import { writeSharedState } from '../utils/shared-state';
import { openAuthedD365, openAuthedArdia } from './helpers/auth-flows';
import { ReportCollector } from './helpers/report-collector';
import { screenshotPath } from '../utils/run-folder';

const data = testData.TC01;
const t    = config.timeouts;

/** Scroll the open Ardia dropdown container until `optionText` becomes visible.
 *  Ardia renders option rows as plain divs (not a virtual-scroll viewport), so
 *  we bump scrollTop incrementally and re-check — a fixed one-shot scroll +
 *  hardcoded item index breaks whenever the target isn't at that exact index.
 *  Ported from the proven implementation in tc12.ts / tc10.ts / tc3.ts. */
async function scrollArdiaDropdownUntilVisible(page: Page, optionText: string): Promise<void> {
  await page.waitForTimeout(400); // let the dropdown finish opening
  const maxScrolls = 30;
  const container = page
    .locator('app-input-grid-select > div:nth-child(2), div.dropdownContainer')
    .last();

  for (let i = 0; i < maxScrolls; i++) {
    const option = page.getByText(optionText, { exact: false }).first();
    if (await option.isVisible({ timeout: 400 }).catch(() => false)) {
      if (i > 0) console.log(`         (found "${optionText}" after ${i} scroll(s))`);
      return;
    }
    const scrolled = await container
      .evaluate((el: Element) => { (el as HTMLElement).scrollTop += 150; return true; })
      .catch(() => false);
    if (!scrolled) {
      await page.keyboard.press('ArrowDown'); // fallback if container not found
    }
    await page.waitForTimeout(200);
  }
}

// ── How many boxes to produce ──────────────────────────────
// Priority: testData.TC01.boxCount → config.ardia.boxCount → default 10.
// Change it in test-data.ts (TC01.boxCount) or config.ts (ardia.boxCount)
// without touching this file.
const BOX_COUNT: number =
  (data as any).boxCount ??
  (config.ardia as any).boxCount ??
  10;

// ── Per-box weight ─────────────────────────────────────────
// Uses the existing produce weight value for every box.
const BOX_WEIGHT: string = config.ardia.weightInputProduce;

export async function run(browser: Browser, testInfo: any = null) {
  console.log(`Starting Test Case 1 (Multi-Box) — ${peekNextId()} (next ID to be generated)\n`);
  console.log('Test Data:');
  console.log(`  Item:      ${data.itemNumber}`);
  console.log(`  Site:      ${data.site}`);
  console.log(`  Warehouse: ${data.warehouse}`);
  console.log(`  Location:  ${data.location}`);
  console.log(`  Quantity:  ${data.quantity}`);
  console.log(`  Printer:   ${data.printer}`);
  console.log(`  Boxes:     ${BOX_COUNT} (weight ${BOX_WEIGHT} each)\n`);

  // Test data shown in BOTH the Excel and the client HTML report
  const reportTestData: Record<string, string> = {
    'Item Number':   String(data.itemNumber ?? ''),
    'Configuration': String(data.configuration ?? ''),
    'Site':          String(data.site ?? ''),
    'Warehouse':     String(data.warehouse ?? ''),
    'Location':      String(data.location ?? ''),
    'Quantity':      String(data.quantity ?? ''),
    'Formula Number':String(data.formulaNumber ?? ''),
    'Pool':          String(data.pool ?? ''),
    'Printer':       String(data.printer ?? ''),
    'Process':       'Produce',
  };
  const report = new ReportCollector('Test Case 1 (Multi-Box)', reportTestData);

  let d365Context:  BrowserContext | undefined;
  let ardiaContext: BrowserContext | undefined;
  let ardiaErrPage: Page | undefined;   // referenced by the catch block for an error screenshot
  let batchOrderId = '';
  let boxesProduced = 0;
  let overall: 'PASS' | 'FAIL' = 'FAIL';
  let deferredError: any = null;

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1 — OPEN D365 (reuses saved session; logs in if needed)
    // ══════════════════════════════════════════════════════════

    console.log('Step 1: Opening D365 (authenticated session)...');
    const d365 = await openAuthedD365(browser);
    d365Context = d365.context;
    const d365Page = d365.page;
    console.log('✓ D365 ready\n');
    report.add('Open D365 (authenticated session)', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 2 — NAVIGATE TO ALL PRODUCTION ORDERS
    // ══════════════════════════════════════════════════════════

    console.log('Step 6 & 7: Navigating to All Production Orders via search...');
    await d365Page.keyboard.press('Control+/');
    await d365Page.waitForTimeout(2000);
    await d365Page.keyboard.type('All production orders', { delay: 150 });
    await d365Page.waitForTimeout(2000);
    await d365Page.getByText('All production orders').first().click();
    await d365Page.waitForLoadState('networkidle', { timeout: t.navigation });
    await d365Page.waitForTimeout(2000);
    console.log('✓ On All Production Orders page\n');
    report.add('Navigate to All Production Orders', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 3 — CREATE NEW BATCH ORDER
    // ══════════════════════════════════════════════════════════

    console.log('Step 8: Clicking New batch order...');
    await d365Page.getByRole('button', { name: 'New batch order' }).click();
    await d365Page.waitForLoadState('networkidle', { timeout: t.navigation });
    await d365Page.waitForTimeout(2000);

    console.log('Step 9: Filling batch order number...');
    const batchOrderInput = d365Page.getByRole('textbox', { name: 'Batch order' });
    await batchOrderInput.waitFor({ timeout: t.element });
    batchOrderId = generateBatchOrderId();
    console.log(`         Generated Batch Order ID: ${batchOrderId}`);
    await batchOrderInput.fill(batchOrderId);

    console.log('Step 10: Filling Item number...');
    await d365Page.getByRole('combobox', { name: 'Item number' }).fill(data.itemNumber);
    await d365Page.keyboard.press('Tab');
    await d365Page.waitForTimeout(2000);

    if (data.configuration) {
      console.log('Step 11: Filling Configuration...');
      await d365Page.getByRole('combobox', { name: 'Configuration' }).fill(data.configuration);
      await d365Page.keyboard.press('Tab');
      await d365Page.waitForTimeout(1000);
    } else {
      console.log('Step 11: Configuration — skipped');
    }

    console.log('Step 12: Filling Site...');
    await d365Page.getByRole('combobox', { name: 'Site' }).fill(data.site);
    await d365Page.keyboard.press('Tab');
    await d365Page.waitForTimeout(1000);

    console.log('Step 13: Filling Warehouse...');
    await d365Page.getByRole('combobox', { name: 'Warehouse', exact: true }).fill(data.warehouse);
    await d365Page.keyboard.press('Tab');
    await d365Page.waitForTimeout(1000);

    console.log('Step 14: Filling Location...');
    await d365Page.getByRole('combobox', { name: 'Location' }).fill(data.location);
    await d365Page.keyboard.press('Tab');
    await d365Page.waitForTimeout(1000);

    console.log('Step 15: Filling Quantity...');
    await d365Page.locator('#ProdTableCreate_4_Production_QtySched_input').fill(data.quantity);
    await d365Page.keyboard.press('Tab');
    await d365Page.waitForTimeout(1000);

    console.log('Step 16: Checking for "Insert active versions" dialog...');
    const dialogVisible = await d365Page.getByRole('heading', { name: 'Insert the active versions' }).isVisible({ timeout: 8000 }).catch(() => false);
    if (dialogVisible) {
      console.log('         Dialog found — clicking Yes...');
      await d365Page.getByRole('button', { name: 'Yes' }).click();
      await d365Page.waitForTimeout(2000);
    } else {
      console.log('         Dialog not shown — continuing');
    }

    if (data.formulaNumber) {
      console.log('Step 17: Filling Formula number...');
      await d365Page.getByRole('combobox', { name: 'Formula number' }).fill(data.formulaNumber);
      await d365Page.keyboard.press('Tab');
      await d365Page.waitForTimeout(1000);
    } else {
      console.log('Step 17: Formula number — skipped');
    }

    if (data.pool) {
      console.log('Step 18: Filling Pool...');
      await d365Page.getByRole('combobox', { name: 'Pool' }).fill(data.pool);
      await d365Page.keyboard.press('Tab');
      await d365Page.waitForTimeout(1000);
    } else {
      console.log('Step 18: Pool — skipped');
    }

    console.log('Step 19: Clicking Create...');
    await d365Page.locator('#ProdTableCreate_4_Ok').click();
    await d365Page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await d365Page.waitForLoadState('networkidle', { timeout: t.action });
    await d365Page.waitForTimeout(3000);
    console.log(`✓ Batch Order ${batchOrderId} created\n`);
    await d365Page.screenshot({ path: screenshotPath('screenshot-batch-order-created.png') });
    writeSharedState('TC14', { batchOrderId, generatedAt: new Date().toISOString() });
    report.addScreenshot('Batch order created in D365', screenshotPath('screenshot-batch-order-created.png'));
    report.add('Create Batch Order in D365', 'PASS', batchOrderId);


    // ══════════════════════════════════════════════════════════
    //  PART 4 — FILTER GRID AND SELECT THE ORDER
    // ══════════════════════════════════════════════════════════

    console.log('Step 20: Selecting Production orders tab...');
    await d365Page.getByLabel('Production orders', { exact: true }).getByText('Production', { exact: true }).click();
    await d365Page.waitForTimeout(2000);

    console.log(`Step 21: Filtering grid for ${batchOrderId}...`);
    const filterField = d365Page.locator('#__FilterField_ProdTable_ProdId_ProdId_Input_0_0_input');
    await filterField.waitFor({ timeout: t.element });
    await filterField.fill(batchOrderId);
    await d365Page.keyboard.press('Enter');
    await d365Page.waitForLoadState('networkidle', { timeout: t.navigation });
    await d365Page.waitForTimeout(2000);
    await d365Page.getByRole('button', { name: 'Apply' }).click().catch(() => {
      console.log('         Apply button not found — filter already applied via Enter');
    });
    await d365Page.waitForLoadState('networkidle', { timeout: t.navigation });
    await d365Page.waitForTimeout(2000);

    console.log('Step 22: Selecting the order row...');
    await d365Page.getByRole('checkbox', { name: 'Select or unselect row' }).first().check();
    await d365Page.waitForTimeout(1000);
    console.log(`✓ Batch Order ${batchOrderId} found and selected\n`);
    await d365Page.screenshot({ path: screenshotPath('screenshot-batch-order-selected.png') });
    report.addScreenshot('Batch order selected in grid', screenshotPath('screenshot-batch-order-selected.png'));
    report.add('Find & select Batch Order in grid', 'PASS', batchOrderId);


    // ══════════════════════════════════════════════════════════
    //  PART 7 — OPEN ARDIA (reuses saved session; logs in if needed)
    // ══════════════════════════════════════════════════════════

    console.log('Opening Ardia (authenticated session)...');
    const ardia = await openAuthedArdia(browser);
    ardiaContext = ardia.context;
    const ardiaPage = ardia.page;
    ardiaErrPage = ardiaPage;
    console.log('✓ Ardia ready\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-ardia-loggedin.png') });
    report.add('Open Ardia (authenticated session)', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 9 — ARDIA FILTER PANEL
    //  Select Process, Printer, Site, Warehouse, Location, then Proceed
    // ══════════════════════════════════════════════════════════

    console.log('Step 25: Waiting for Ardia filter panel...');
    await ardiaPage.getByText('Select Process').waitFor({ timeout: t.element });
    await ardiaPage.waitForTimeout(1000);

    // ── Step 26: Select Process ────────────────────────────────
    console.log('Step 26: Selecting Process = "Produce"...');
    await ardiaPage.locator('div.col-5 > div > div:nth-of-type(1) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('div.dropdownContainer > div:nth-of-type(1) > div').click();
    await ardiaPage.waitForTimeout(800);
    console.log('         ✓ Process selected: Produce');

    // ── Step 27: Select Printer ────────────────────────────────
    console.log(`Step 27: Selecting Printer = "${data.printer}"...`);
    await ardiaPage.locator('div.col-5 > div > div:nth-of-type(2) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('div.dropdownContainer > div:nth-of-type(2) > div').click();
    await ardiaPage.waitForTimeout(800);
    console.log(`         ✓ Printer selected: ${data.printer}`);

    // ── Step 28: Select Site ───────────────────────────────────
    console.log(`Step 28: Selecting Site = "${data.site}"...`);
    await ardiaPage.locator('div:nth-of-type(3) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('div.col-5 div:nth-of-type(3) > div').click();
    await ardiaPage.waitForTimeout(1500);  // Wait for Warehouse list to load
    console.log(`         ✓ Site selected: ${data.site}`);

    // ── Step 29: Select Warehouse ──────────────────────────────
    // Scroll incrementally and match by visible text instead of a hardcoded
    // item index — the index-based approach broke whenever the warehouse
    // wasn't at the assumed position. Same fix already proven in TC3/TC10/TC12.
    console.log(`Step 29: Selecting Warehouse = "${data.warehouseDisplayText || data.warehouse}"...`);
    await ardiaPage.locator('div:nth-of-type(4) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await scrollArdiaDropdownUntilVisible(ardiaPage, data.warehouseDisplayText || data.warehouse);
    await ardiaPage.getByText(data.warehouseDisplayText || data.warehouse, { exact: !!data.warehouseDisplayText }).first().click();
    await ardiaPage.waitForTimeout(1500);  // Wait for Location list to load
    console.log(`         ✓ Warehouse selected: ${data.warehouseDisplayText || data.warehouse}`);

    // ── Step 30: Select Location ───────────────────────────────
    console.log(`Step 30: Selecting Location = "${data.location}"...`);
    await ardiaPage.locator('div:nth-of-type(5) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('xpath=//html/body/app-root/app-batch-filters/main/div/div[2]/div/div[5]/app-input-grid-select/div[2]/div[2]/div').click();
    await ardiaPage.waitForTimeout(800);
    console.log(`         ✓ Location selected: ${data.location}`);

    await ardiaPage.screenshot({ path: screenshotPath('screenshot-ardia-filters-selected.png') });
    report.addScreenshot('Ardia filters selected', screenshotPath('screenshot-ardia-filters-selected.png'));
    report.add('Select Ardia filters (Process/Printer/Site/WH/Location)', 'PASS');

    // Verify Proceed button is enabled before clicking
    console.log('Step 31: Checking Proceed button is enabled...');
    const proceedButton = ardiaPage.locator('button.btn.btn-secondary');
    await proceedButton.waitFor({ timeout: t.element });
    const isEnabled = await proceedButton.isEnabled();
    if (!isEnabled) {
      throw new Error('Proceed button is still disabled — check all dropdowns were selected correctly');
    }
    console.log('         ✓ Proceed button is enabled');

    console.log('Step 32: Clicking Proceed...');
    await ardiaPage.locator('div:nth-of-type(6) > button').click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation });
    await ardiaPage.waitForTimeout(3000);
    console.log('✓ Proceeded to Batch Orders page\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-ardia-batch-orders.png') });
    report.add('Proceed to Batch Orders page', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 10 — FIND AND OPEN THE PRODUCTION ORDER TILE
    // ══════════════════════════════════════════════════════════

    console.log(`Step 33: Searching for production order tile: ${batchOrderId}...`);
    await ardiaPage.waitForTimeout(2000);

    const orderTile = ardiaPage.getByText(new RegExp(batchOrderId, 'i'));
    await orderTile.waitFor({ timeout: t.element });
    await orderTile.scrollIntoViewIfNeeded();
    console.log(`         ✓ Found tile for ${batchOrderId}`);

    await orderTile.click();
    await ardiaPage.waitForTimeout(2000);
    console.log('         ✓ Clicked on production order tile\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-ardia-tile-selected.png') });
    report.add('Open production order tile in Ardia', 'PASS', batchOrderId);


    // ══════════════════════════════════════════════════════════
    //  PART 11 — START PRODUCING
    // ══════════════════════════════════════════════════════════

    console.log('Step 34: Waiting for Start Producing button...');
    const startProducingBtn = ardiaPage.getByRole('button', { name: 'Start Producing' });
    await startProducingBtn.waitFor({ timeout: t.element });
    console.log('         ✓ Start Producing button visible in popup');

    await startProducingBtn.click();
    await ardiaPage.waitForTimeout(2000);
    console.log('         ✓ Clicked Start Producing\n');

    // Verify numpad is now enabled
    console.log('Step 35: Verifying weight input (numpad) is enabled...');
    const weightInput = ardiaPage.locator('#weightInput');
    await weightInput.waitFor({ timeout: t.element });
    const isWeightEnabled = await weightInput.isEnabled();
    if (!isWeightEnabled) {
      throw new Error('Weight input is not enabled after clicking Start Producing');
    }
    console.log('         ✓ Numpad is enabled\n');
    report.add('Start Producing (numpad enabled)', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 12 — PRODUCE N BOXES (loop): enter weight → Enter → verify RAF
    // ══════════════════════════════════════════════════════════

    console.log(`Step 36: Producing ${BOX_COUNT} box(es), weight ${BOX_WEIGHT} each...\n`);

    for (let box = 1; box <= BOX_COUNT; box++) {
      console.log(`   ── Box ${box} of ${BOX_COUNT} ──`);

      // Enter the weight for this box
      await weightInput.waitFor({ timeout: t.element });
      await weightInput.click().catch(() => {});
      await weightInput.fill(BOX_WEIGHT);
      await ardiaPage.waitForTimeout(400);

      // Listen for the RAF API POST that fires when Enter is clicked
      const rafApiPromise = ardiaPage.waitForResponse(
        (response: any) =>
          response.url().includes('/raf/v2/rafjournal') &&
          response.request().method() === 'POST',
        { timeout: t.apiResponse }
      );

      await ardiaPage.getByRole('button', { name: 'Enter' }).click();

      try {
        const rafResponse = await rafApiPromise;
        const status = rafResponse.status();
        if (status !== 200) {
          throw new Error(`RAF API returned ${status} (expected 200) for box ${box}`);
        }
        boxesProduced++;
        console.log(`      ✓ Box ${box}: RAF POST → 200 OK`);
        report.add(`Produce box ${box}/${BOX_COUNT} (weight ${BOX_WEIGHT})`, 'PASS', 'RAF POST → 200 OK');
      } catch (err: any) {
        report.add(`Produce box ${box}/${BOX_COUNT} (weight ${BOX_WEIGHT})`, 'FAIL', err.message);
        throw new Error(`RAF verification failed on box ${box}: ${err.message}`);
      }

      // Small settle between boxes so the numpad resets for the next entry
      await ardiaPage.waitForTimeout(1200);
    }

    await ardiaPage.screenshot({ path: screenshotPath('screenshot-ardia-all-boxes-produced.png') });
    report.addScreenshot('All boxes produced', screenshotPath('screenshot-ardia-all-boxes-produced.png'));
    console.log(`\n✓ Produced ${boxesProduced} of ${BOX_COUNT} boxes — all RAF calls verified\n`);
    report.add('All boxes produced & RAF verified', 'PASS', `${boxesProduced}/${BOX_COUNT}`);


    // ══════════════════════════════════════════════════════════
    //  PART 13 — STOP PRODUCING
    // ══════════════════════════════════════════════════════════

    console.log('Step 38: Clicking Stop Producing...');
    const stopProducingBtn = ardiaPage.getByRole('button', { name: 'Stop Producing' });
    await stopProducingBtn.waitFor({ timeout: t.element });
    await stopProducingBtn.click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation });
    await ardiaPage.waitForTimeout(2000);
    console.log('         ✓ Stopped Producing\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-ardia-stopped.png') });
    report.addScreenshot('Stopped producing', screenshotPath('screenshot-ardia-stopped.png'));
    report.add('Stop Producing', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════════════════

    overall = 'PASS';
    console.log('\n✅ TEST CASE 1 (Multi-Box) PASSED');
    console.log(`   Batch Order:    ${batchOrderId}`);
    console.log(`   Boxes Produced: ${boxesProduced}/${BOX_COUNT}`);
    console.log(`   Box Weight:     ${BOX_WEIGHT}`);
    console.log('   RAF API:        POST /raf/v2/rafjournal → 200 OK (per box) ✓');

  } catch (err: any) {
    overall = 'FAIL';
    console.error(`\n❌ TEST CASE 1 (Multi-Box) FAILED: ${err.message}`);
    report.add('TEST FAILED', 'FAIL', err.message);
    await ardiaErrPage?.screenshot({ path: screenshotPath('screenshot-error.png') }).catch(() => {});
    report.addScreenshot('Failure screenshot', screenshotPath('screenshot-error.png'));
    console.log('   Error screenshot saved: screenshot-error.png');
    console.log('   Batch Order at failure:', batchOrderId || 'not yet created');
    deferredError = err;
  } finally {
    // ── Finalize: attach data for the client HTML report + write Excel ──
    try {
      const meta: Record<string, string> = {
        'Overall Result':   overall,
        'Batch Order ID':   batchOrderId || '(not created)',
        'Boxes Requested':  String(BOX_COUNT),
        'Boxes Produced':   String(boxesProduced),
        'Box Weight (each)': BOX_WEIGHT,
      };
      const { excelPath } = await report.finalize(testInfo, meta);
      console.log(`\n📊 Excel report written: ${excelPath}`);
    } catch (repErr: any) {
      console.error(`   ⚠ Failed to write report: ${repErr.message}`);
    }

    await d365Context?.close();
    await ardiaContext?.close();
  }

  // Surface failure to the Playwright Test Runner AFTER the report is written.
  if (deferredError) throw deferredError;
}

// Run standalone:  npx ts-node tests/tc1-multibox.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser, null); } finally { await browser.close(); }
  })();
}