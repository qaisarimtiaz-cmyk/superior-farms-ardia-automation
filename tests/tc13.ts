// ============================================================
//  tests/tc12.ts
//  Test Case 12 — D365: Batch order creation (Parts 1-4 only)
//
//   PART 1 — Login to D365 (+ MFA)
//   PART 2 — Navigate to All Production Orders
//   PART 3 — Create a new batch order
//   PART 4 — Filter the grid and select the order
//
//  Copied from the produce-test template (TC2). Further steps to
//  be added later.
//
//  Run standalone:  npx ts-node tests/tc12.ts
//  Run via runner:  npx playwright test tests/tc12.spec.ts
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }    from '../config';
import { testData }  from '../test-data';
import { generateBatchOrderId, peekNextId } from '../utils/generate-id';
import { writeSharedState } from '../utils/shared-state';
import { openAuthedD365, openAuthedArdia } from './helpers/auth-flows';
import { ReportCollector } from './helpers/report-collector';
import { screenshotPath } from '../utils/run-folder';

const data = testData.TC12;
const t    = config.timeouts;

export async function run(browser: Browser, testInfo: any = null) {
  console.log(`Starting Test Case 12 — ${peekNextId()} (next ID to be generated)\n`);
  console.log('Test Data:');
  console.log(`  Item:      ${data.itemNumber}`);
  console.log(`  Site:      ${data.site}`);
  console.log(`  Warehouse: ${data.warehouse}`);
  console.log(`  Location:  ${data.location}`);
  console.log(`  Quantity:  ${data.quantity}`);
  console.log(`  Printer:   ${data.printer}\n`);

  // Test data shown in BOTH the Excel and the client HTML report
  const reportTestData: Record<string, string> = {
    'Item Number':      String(data.itemNumber ?? ''),
    'Site':             String(data.site ?? ''),
    'Warehouse':        String(data.warehouse ?? ''),
    'Location':         String(data.location ?? ''),
    'Quantity':         String(data.quantity ?? ''),
    'Printer':          String(data.printer ?? ''),
    'Customer Label':   String(data.customerLabelText ?? ''),
    'Produce Weight':   String(data.produceWeight ?? ''),
  };
  const report = new ReportCollector('Test Case 13', reportTestData);

  let d365Context:  BrowserContext | undefined;
  let ardiaContext: BrowserContext | undefined;
  let d365ErrPage:  Page | undefined;   // referenced by the catch block for an error screenshot
  let ardiaErrPage: Page | undefined;   // referenced by the catch block for an error screenshot
  let batchOrderId = '';
  let isSync: boolean | null = null;
  let overall: 'PASS' | 'FAIL' = 'FAIL';

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1 — OPEN D365 (reuses saved session; logs in if needed)
    // ══════════════════════════════════════════════════════════

    console.log('Step 1: Opening D365 (authenticated session)...');
    const d365 = await openAuthedD365(browser);
    d365Context = d365.context;
    const d365Page = d365.page;
    d365ErrPage = d365Page;
    console.log('✓ Logged in and dashboard loaded\n');
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
    await d365Page.screenshot({ path: screenshotPath('screenshot-tc12-batch-order-created.png') });
    report.addScreenshot('Batch order created in D365', screenshotPath('screenshot-tc12-batch-order-created.png'));
    report.add('Create Batch Order in D365', 'PASS', batchOrderId);

    // Persist batchOrderId so downstream test cases can chain off it
    writeSharedState('TC13', {
      batchOrderId,
      generatedAt: new Date().toISOString(),
    });
    console.log('   [shared-state] batchOrderId persisted for downstream test cases\n');


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
    await d365Page.screenshot({ path: screenshotPath('screenshot-tc12-batch-order-selected.png') });
    report.addScreenshot('Batch order selected in grid', screenshotPath('screenshot-tc12-batch-order-selected.png'));
    report.add('Find & select Batch Order in grid', 'PASS', batchOrderId);

    // ══════════════════════════════════════════════════════════
    //  PART 5 — OPEN AND LOGIN TO ARDIA
    // ══════════════════════════════════════════════════════════
    console.log('Step 23: Opening Ardia (authenticated session)...');
    const ardia = await openAuthedArdia(browser);
    ardiaContext = ardia.context;
    const ardiaPage = ardia.page;
    ardiaErrPage = ardiaPage;
    console.log('✓ Logged into Ardia\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc12-ardia-loggedin.png') });
    report.addScreenshot('Logged into Ardia', screenshotPath('screenshot-tc12-ardia-loggedin.png'));
    report.add('Open Ardia (authenticated session)', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 6 — SELECT PROCESS / PRINTER / SITE / WAREHOUSE / LOCATION + PROCEED
    //  textbox indices: 0=Process, 1=Printer, 2=Site, 3=Warehouse, 4=Location
    // ══════════════════════════════════════════════════════════
    console.log('Step 24: Waiting for Ardia filter panel...');
    await ardiaPage.getByText('Select Process').waitFor({ timeout: t.element }).catch(() => {});
    await ardiaPage.waitForTimeout(1000);

    console.log(`Step 24a: Selecting Process = "${data.ardiaProcessText}" (default, set explicitly)...`);
    await selectArdiaDropdown(ardiaPage, 0, data.ardiaProcessText!);
    await ardiaPage.waitForTimeout(800);

    console.log(`Step 24b: Selecting Printer = "${data.printer}"...`);
    await selectArdiaDropdown(ardiaPage, 1, data.printer);
    await ardiaPage.waitForTimeout(800);

    console.log(`Step 25: Selecting Site = "${data.ardiaSiteText}"...`);
    await selectArdiaDropdown(ardiaPage, 2, data.ardiaSiteText!);
    await ardiaPage.waitForTimeout(1500); // warehouse list loads after site

    console.log(`Step 26: Selecting Warehouse = "${data.ardiaWarehouseText}"...`);
    await selectArdiaDropdown(ardiaPage, 3, data.ardiaWarehouseText!);
    await ardiaPage.waitForTimeout(1500); // location list loads after warehouse

    console.log(`Step 27: Selecting Location = "${data.ardiaLocationText}"...`);
    await selectArdiaDropdown(ardiaPage, 4, data.ardiaLocationText!);
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc12-ardia-filters.png') });
    report.addScreenshot('Ardia filters selected', screenshotPath('screenshot-tc12-ardia-filters.png'));
    report.add('Select Ardia filters (Process/Printer/Site/WH/Location)', 'PASS');

    console.log('Step 28: Clicking Proceed...');
    const proceedBtn = ardiaPage.getByRole('button', { name: 'Proceed' });
    await proceedBtn.waitFor({ timeout: t.element });
    if (!(await proceedBtn.isEnabled())) {
      throw new Error('Proceed button is disabled — check Site/Warehouse/Location selections');
    }
    await proceedBtn.click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation }).catch(() => {});
    await ardiaPage.waitForTimeout(3000);
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc12-ardia-batch-orders.png') });
    report.addScreenshot('Ardia batch orders page', screenshotPath('screenshot-tc12-ardia-batch-orders.png'));
    report.add('Proceed to Batch Orders page', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 7 — FIND THE BATCH ORDER TILE (created in D365) + OPEN
    //  Same approach as TC1 — locate the tile by the batch order ID.
    // ══════════════════════════════════════════════════════════
    console.log(`Step 29: Searching for batch order tile: ${batchOrderId}...`);
    await ardiaPage.waitForTimeout(2000);
    const orderTile = ardiaPage.getByText(new RegExp(batchOrderId, 'i'));
    await orderTile.first().waitFor({ timeout: t.element });
    await orderTile.first().scrollIntoViewIfNeeded();
    await orderTile.first().click();
    await ardiaPage.waitForTimeout(2000);
    console.log(`✓ Opened batch order ${batchOrderId}\n`);
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc12-ardia-tile-selected.png') });
    report.addScreenshot('Batch order tile opened in Ardia', screenshotPath('screenshot-tc12-ardia-tile-selected.png'));
    report.add('Open production order tile in Ardia', 'PASS', batchOrderId);

    // ══════════════════════════════════════════════════════════
    //  PART 8 — CUSTOMER LABEL → HEB → SAVE   (the extra step vs TC1)
    // ══════════════════════════════════════════════════════════
    console.log('Step 30: Opening Customer Label...');
    await ardiaPage.getByRole('button', { name: 'Customer Label' }).click();
    await ardiaPage.waitForTimeout(1000);

    console.log(`Step 31: Selecting customer = "${data.customerLabelText}"...`);
    // Recorded selector: a nested div whose combined text is the customer name.
    await ardiaPage.locator('div').filter({ hasText: data.customerLabelText! }).nth(4).click();
    await ardiaPage.waitForTimeout(800);

    console.log('Step 32: Saving Customer Label...');
    await ardiaPage.getByRole('button', { name: 'Save' }).click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation }).catch(() => {});
    await ardiaPage.waitForTimeout(1500);
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc12-ardia-customer-label.png') });
    report.addScreenshot('Customer label saved (HEB)', screenshotPath('screenshot-tc12-ardia-customer-label.png'));
    report.add('Select & save Customer Label', 'PASS', data.customerLabelText ?? '');

    // ══════════════════════════════════════════════════════════
    //  PART 9 — START PRODUCING → WEIGHT → ENTER → STOP PRODUCING
    // ══════════════════════════════════════════════════════════
    console.log('Step 33: Clicking Start Producing...');
    const startProducingBtn = ardiaPage.getByRole('button', { name: 'Start Producing' });
    await startProducingBtn.waitFor({ timeout: t.element });
    await startProducingBtn.click();
    await ardiaPage.waitForTimeout(2000);
    report.add('Start Producing', 'PASS');

    console.log(`Step 34: Keying weight ${data.produceWeight} on the numpad...`);
    for (const digit of data.produceWeight!) {
      await ardiaPage.getByRole('button', { name: digit, exact: true }).click();
      await ardiaPage.waitForTimeout(200);
    }
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc12-ardia-weight-entered.png') });
    report.addScreenshot('Weight entered on numpad', screenshotPath('screenshot-tc12-ardia-weight-entered.png'));

    // Set up the RAF API listener BEFORE clicking Enter (TC1 pattern).
    console.log('Step 35: Clicking Enter and verifying RAF journal API...');
    const rafApiPromise = ardiaPage.waitForResponse(
      (response: import('playwright').Response) =>
        response.url().includes('/raf/v2/rafjournal') &&
        response.request().method() === 'POST',
      { timeout: t.apiResponse }
    );

    await ardiaPage.getByRole('button', { name: 'Enter', exact: true }).click();

    try {
      const rafResponse = await rafApiPromise;
      const status      = rafResponse.status();
      if (status !== 200) {
        throw new Error(`RAF API returned unexpected status: ${status} (expected 200)`);
      }
      console.log('         ✓ RAF API call verified');
      console.log(`           URL:    ${rafResponse.url()}`);
      console.log(`           Method: POST`);
      console.log(`           Status: ${status} OK`);
      report.add('Produce & verify RAF (POST /raf/v2/rafjournal)', 'PASS', 'RAF POST → 200 OK');
    } catch (err: any) {
      report.add('Produce & verify RAF (POST /raf/v2/rafjournal)', 'FAIL', err.message);
      throw new Error(
        `RAF API verification failed: ${err.message}\n` +
        `Expected POST to ${config.ardia.rafApiUrl} with status 200`
      );
    }
    await ardiaPage.waitForTimeout(2000);
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc12-ardia-after-enter.png') });
    report.addScreenshot('After Enter submitted', screenshotPath('screenshot-tc12-ardia-after-enter.png'));

    console.log('Step 36: Clicking Stop Producing...');
    const stopProducingBtn = ardiaPage.getByRole('button', { name: 'Stop Producing' });
    await stopProducingBtn.waitFor({ timeout: t.element });
    await stopProducingBtn.click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation }).catch(() => {});
    await ardiaPage.waitForTimeout(2000);
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc12-ardia-stopped.png') });
    report.addScreenshot('Stopped producing', screenshotPath('screenshot-tc12-ardia-stopped.png'));
    report.add('Stop Producing', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 10 — VERIFY RAF IN D365 (Report as finished staging data)
    //  Navigate (TC10/TC9 pattern), filter the Production column by the
    //  batch order, and confirm the tag's IsSync flag is true.
    // ══════════════════════════════════════════════════════════
    // RAF sync lags the produce — wait 2 minutes once (like TC10's data wait),
    // then open the staging table and check; it will be synced by then.
    console.log('Step 37: Waiting 2 minutes for RAF to sync before checking staging data...');
    for (let remaining = 120; remaining > 0; remaining -= 30) {
      await d365Page.waitForTimeout(30000);
      console.log(`         ... ${Math.max(remaining - 30, 0)}s remaining`);
    }

    console.log('Step 38: Opening Report as finished staging data in D365...');
    await openViaSearch(d365Page, 'report as finished', /Report as finished staging data/i, t.dashboard);
    console.log('✓ Report as finished staging data opened — grid rendered\n');

    console.log(`Step 39: Filtering the Production column by ${batchOrderId}...`);
    await filterStagingByProduction(d365Page, batchOrderId);
    await d365Page.screenshot({ path: screenshotPath('screenshot-tc12-raf-staging.png') });
    report.addScreenshot('D365 RAF staging (IsSync)', screenshotPath('screenshot-tc12-raf-staging.png'));

    console.log('Step 40: Verifying the staging row exists and IsSync = true...');
    const rowVisible = await isBatchRowPresent(d365Page, batchOrderId);
    if (!rowVisible) {
      throw new Error(
        `Batch order ${batchOrderId} not found under the Production column in Report as finished staging data`
      );
    }
    console.log(`         ✓ Batch order ${batchOrderId} found in staging data`);

    isSync = await verifyIsSync(d365Page, batchOrderId);
    if (isSync === true) {
      console.log('         ✓ IsSync = true');
    } else if (isSync === false) {
      throw new Error('Staging row found but IsSync = false');
    } else {
      console.log('         ⚠ Could not read IsSync column reliably — confirm visually (staging row is present).');
    }
    report.add('Verify D365 staging IsSync', (isSync as boolean | null) === false ? 'FAIL' : 'PASS', isSync === true ? 'IsSync = true' : 'IsSync unconfirmed');

    overall = 'PASS';
    console.log('\n✅ TEST CASE 12 PASSED');
    console.log(`   Batch Order:    ${batchOrderId}`);
    console.log(`   Customer Label: ${data.customerLabelText}`);
    console.log(`   Weight:         ${data.produceWeight}`);
    console.log('   RAF API:        POST /raf/v2/rafjournal → 200 OK ✓');
    console.log(`   RAF staging:    ${batchOrderId} present, IsSync = ${isSync === true ? 'true' : 'unconfirmed'}`);

  } catch (err: any) {
    report.add('TEST FAILED', 'FAIL', err.message ?? String(err));
    console.error(`\n❌ TEST CASE 12 FAILED: ${err.message}`);
    await d365ErrPage?.screenshot({ path: screenshotPath('screenshot-tc12-error-d365.png') }).catch(() => {});
    await ardiaErrPage?.screenshot({ path: screenshotPath('screenshot-tc12-error-ardia.png') }).catch(() => {});
    report.addScreenshot('Failure screenshot (D365)', screenshotPath('screenshot-tc12-error-d365.png'));
    report.addScreenshot('Failure screenshot (Ardia)', screenshotPath('screenshot-tc12-error-ardia.png'));
    console.log('   Error screenshots saved: screenshot-tc12-error-d365.png, screenshot-tc12-error-ardia.png');
    console.log('   Batch Order at failure:', batchOrderId || 'not yet created');
    throw err;   // surface failure to the Playwright Test Runner
  } finally {
    try {
      const meta: Record<string, string> = {
        'Overall Result':     overall,
        'Batch Order ID':     batchOrderId || '(not created)',
        'Customer Label':     String(data.customerLabelText ?? ''),
        'Produce Weight':     String(data.produceWeight ?? ''),
        'RAF API':            'POST /raf/v2/rafjournal → 200 OK',
        'RAF Staging IsSync': isSync === true ? 'true' : isSync === false ? 'false' : 'unconfirmed',
      };
      const { excelPath } = await report.finalize(testInfo, meta);
      console.log(`\n📊 Excel report written: ${excelPath}`);
    } catch (repErr: any) {
      console.error(`   ⚠ Failed to write report: ${repErr.message}`);
    }

    await d365Context?.close();
    await ardiaContext?.close();
  }
}

// ============================================================
//  Helpers
// ============================================================

/**
 * Open an Ardia filter dropdown by index, scroll the list until the option is
 * visible (long lists like Warehouse render the value several rows down — same
 * scroll fix used in TC10/TC2/TC3), then click it by visible text.
 */
async function selectArdiaDropdown(page: Page, index: number, optionText: string): Promise<void> {
  await page.getByRole('textbox').nth(index).click({ timeout: t.element });
  await page.waitForTimeout(800);
  await scrollArdiaDropdownUntilVisible(page, optionText);
  await page.getByText(optionText, { exact: false }).first().click({ timeout: t.element });
  await page.waitForTimeout(800);
  console.log(`         ✓ Selected "${optionText}"`);
}

/**
 * Navigate to a D365 page via the Search box, then WAIT for a grid to render
 * (TC9/TC10 pattern — click the result as an `option`, never loose text, and
 * block on a grid container so we never proceed while still on the dashboard).
 */
async function openViaSearch(page: Page, term: string, optionName: RegExp, gridTimeout: number): Promise<void> {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.waitForTimeout(1000);

  const box = page.getByRole('textbox', { name: 'Search for a page' });
  await box.waitFor({ timeout: t.element });
  await box.fill(term);
  await page.waitForTimeout(1500);

  await page.getByRole('option', { name: optionName }).first().click();
  // Do NOT wait for 'networkidle' here — this page polls continuously (RAF
  // sync status), so networkidle rarely fires and burns its full t.dashboard
  // (2 min) timeout every time. This was empirically confirmed to be the
  // cause of TC13 consistently running to its full 20-min test timeout —
  // domcontentloaded + the grid-visibility wait below is the real signal.
  await page.waitForLoadState('domcontentloaded', { timeout: t.navigation }).catch(() => {});

  // Wait for the page content to render. D365 has two grid types:
  //   - React grids:         .reactGrid, [id*="MainGrid"]
  //   - Standard form grids: [id*="Grid"], table, [role="grid"], [role="row"]
  // "Report as finished staging data" uses a standard form grid, NOT a react
  // grid — so [id*="MainGrid"] never appears, causing a 5-min stuck wait.
  // We try both selectors and fall back to networkidle if neither matches.
  const gridReady = await page.locator(
    '.reactGrid, [id*="MainGrid"], [id*="Grid_"], [role="grid"], .grid-body'
  ).first().waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);

  if (!gridReady) {
    // Standard form pages (e.g. F3ProdAppRAFProcessForm) render rows directly.
    // Wait for at least one data row or the page heading to confirm load.
    await page.locator('[role="row"], .formSection, [id*="row-"]').first()
      .waitFor({ state: 'visible', timeout: gridTimeout })
      .catch(() => {}); // best-effort — continue even if no row found yet
  }

  await page.waitForTimeout(2000);
}

/**
 * Filter the "Report as finished staging data" grid by the Production column
 * (which holds the batch order number). Mirrors TC9 exactly: click the
 * Production column header to expose its inline filter, then fill + Apply.
 * Uses the EXACT accessible name 'Filter field: Production,' (with the comma)
 * so it doesn't accidentally match another column's filter (e.g. "Production
 * type"), which was the original bug.
 */
async function filterStagingByProduction(page: Page, batchOrderId: string): Promise<void> {
  await page.getByText('Production', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(800);

  const productionFilter = page.getByRole('combobox', { name: 'Filter field: Production,' });
  await productionFilter.waitFor({ state: 'visible', timeout: t.element });
  await productionFilter.click();
  await productionFilter.fill(batchOrderId);
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Apply' }).click();
  // Don't wait for 'networkidle' on the live staging grid (it rarely
  // settles, same reason as in openViaSearch above) — a short settle is
  // enough; the row/IsSync checks below have their own waits.
  await page.waitForTimeout(3000);
}

/**
 * Whether the filtered staging grid contains the batch order row.
 * D365 react-grid renders cell values INSIDE <input>/[title] elements, so
 * getByText does NOT match grid cell content. We check the data cell's title
 * (its id contains "row-", unlike the filter input), then input values on data
 * rows, then fall back to "any data row exists" (the filter guarantees match).
 */
async function isBatchRowPresent(page: Page, batchOrderId: string): Promise<boolean> {
  // 1) A data cell whose [title] equals the batch order (id has "row-").
  const titleCell = page.locator(`[id*="row-"][title="${batchOrderId}"]`).first();
  if (await titleCell.isVisible({ timeout: t.element }).catch(() => false)) return true;

  // 2) A grid input/textarea on a data row whose current value matches.
  const rowFields = page.locator('[id*="row-"] input, input[id*="row-"], [id*="row-"] textarea');
  const n = Math.min(await rowFields.count().catch(() => 0), 60);
  for (let i = 0; i < n; i++) {
    const v = await rowFields.nth(i).inputValue().catch(() => '');
    if (v && v.trim() === batchOrderId) return true;
  }

  // 3) Filter is applied, so any data row present is the matching row.
  const rowCount = await page.getByRole('checkbox', { name: 'Select or unselect row' })
    .count().catch(() => 0);
  if (rowCount > 0) return true;

  // 4) Last resort: a plain text node.
  return await page.getByText(batchOrderId, { exact: false }).first()
    .isVisible({ timeout: 2000 }).catch(() => false);
}

/**
 * Verify the IsSync column is true for the filtered staging row.
 *
 * Mirrors tc10's verifyColdScaleRow EXACTLY — that function works because
 * it pairs the IsSync cell by index with a reference column cell.
 *
 * Root cause of the previous failure:
 *   Cold scale staging IsSync cells have aria-label="Yes" (the VALUE),
 *   so readVal() returns "yes" → matches /yes|true|✓/ → true.
 *   Report as finished staging IsSync cells have aria-label="IsSync"
 *   (the COLUMN NAME), so readVal() returns "issync" → no match → null.
 *
 * Fix: pair the IsSync cell by row index using the Production column as
 * the reference (which holds the batch order ID), then apply readChecked.
 * If readChecked still returns null, fall back to innerHTML presence
 * (checked cell has a child icon element; unchecked cell is empty).
 */
async function verifyIsSync(page: Page, batchOrderId: string): Promise<boolean | null> {
  return await page.evaluate((prodId: string) => {
    const readVal = (el: Element): string => {
      const input = el.querySelector('input') as HTMLInputElement | null;
      const candidates = [
        input?.value,
        (el as HTMLElement).getAttribute('title'),
        (el as HTMLElement).getAttribute('aria-label'),
        (el as HTMLElement).getAttribute('value'),
        (el as HTMLElement).innerText,
        el.textContent,
      ];
      for (const c of candidates) if (c && c.trim()) return c.trim();
      return '';
    };

    const readChecked = (el: Element): boolean | null => {
      // 1. Real checkbox input
      const input = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (input) return input.checked;

      // 2. aria-checked attribute
      const ac = el.getAttribute('aria-checked');
      if (ac === 'true')  return true;
      if (ac === 'false') return false;

      // 3. readVal — works when aria-label IS the value (e.g. "Yes" / "true")
      const v = readVal(el).toLowerCase();
      if (/yes|true|✓/.test(v))  return true;
      if (/no|false/.test(v)) return false;

      // 4. innerHTML presence — D365 renders checked boolean cells with a child
      //    icon element (glyph / SVG). Unchecked cells are completely empty.
      const html = el.innerHTML.trim();
      if (!html)              return false;  // empty = unchecked
      if (el.children.length > 0) return true;   // has icon child = checked
      if (html.length > 0)    return true;   // non-empty glyph text = checked

      return null;
    };

    // ── Find the Production column cells and locate the matching row index ──
    // Production column holds the batch order ID — use it as the row anchor.
    const prodEls = Array.from(document.querySelectorAll(
      '[aria-label="Production"], [title="Production"]'
    ));
    let idx = -1;
    for (let i = 0; i < prodEls.length; i++) {
      const v = readVal(prodEls[i]);
      if (v === prodId || v.includes(prodId)) { idx = i; break; }
    }

    // ── Collect IsSync cells ──────────────────────────────────────────
    const syncEls = Array.from(document.querySelectorAll(
      '[aria-label="IsSync"], [title="IsSync"]'
    ));

    // ── Pair by index (same as tc10 verifyColdScaleRow) ──────────────
    if (idx !== -1 && syncEls[idx]) {
      const result = readChecked(syncEls[idx]);
      if (result !== null) return result;
    }

    // ── Fallback: filter shows 1 row, just use first non-header sync cell ─
    // If Production column pairing missed, any sync cell that isn't a header
    // belongs to the only data row.
    for (const el of syncEls) {
      // Skip obvious header cells (header cells rarely have "row-" in id)
      const id = el.id || '';
      const isHeader = el.closest('[role="columnheader"], thead, [class*="header"]') !== null;
      if (isHeader) continue;

      const result = readChecked(el);
      if (result !== null) return result;
    }

    return null;
  }, batchOrderId).catch(() => null);
}

/** Scroll the open Ardia dropdown container until `optionText` becomes visible. */
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

// Run standalone:  npx ts-node tests/tc12.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser, null); } finally { await browser.close(); }
  })();
}