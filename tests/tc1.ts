// ============================================================
//  tests/tc1.ts
//  Test Case 1 — D365: Create Batch Order
//               Ardia: Filters + Proceed + Produce + RAF verify + Stop
//
//  Authentication is centralized in tests/helpers/auth-flows.ts and
//  established once by tests/auth.setup.ts, so this test reuses the
//  saved D365/Ardia sessions instead of logging in.
//
//  Run via the suite:  npx playwright test
//  Run standalone:     npx ts-node tests/tc1.ts
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }    from '../config';
import { testData }  from '../test-data';
import { generateBatchOrderId, peekNextId } from '../utils/generate-id';
import { openAuthedD365, openAuthedArdia } from './helpers/auth-flows';

const data = testData.TC01;
const t    = config.timeouts;

export async function run(browser: Browser) {
  console.log(`Starting Test Case 1 — ${peekNextId()} (next ID to be generated)\n`);
  console.log('Test Data:');
  console.log(`  Item:      ${data.itemNumber}`);
  console.log(`  Site:      ${data.site}`);
  console.log(`  Warehouse: ${data.warehouse}`);
  console.log(`  Location:  ${data.location}`);
  console.log(`  Quantity:  ${data.quantity}`);
  console.log(`  Printer:   ${data.printer}\n`);

  let d365Context:  BrowserContext | undefined;
  let ardiaContext: BrowserContext | undefined;
  let ardiaErrPage: Page | undefined;   // referenced by the catch block for an error screenshot
  let batchOrderId = '';

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1 — OPEN D365 (reuses saved session; logs in if needed)
    // ══════════════════════════════════════════════════════════

    console.log('Step 1: Opening D365 (authenticated session)...');
    const d365 = await openAuthedD365(browser);
    d365Context = d365.context;
    const d365Page = d365.page;
    console.log('✓ D365 ready\n');


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
    await d365Page.screenshot({ path: 'screenshot-batch-order-created.png' });


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
    await d365Page.screenshot({ path: 'screenshot-batch-order-selected.png' });


    // ══════════════════════════════════════════════════════════
    //  PART 5 — START BATCH ORDER (COMMENTED OUT)
    //  Batch order left in Created state so it can be used in Ardia
    // ══════════════════════════════════════════════════════════

    // console.log('Step 23: Opening Production order menu...');
    // await d365Page.getByRole('button', { name: 'Production order', exact: true }).click();
    // await d365Page.waitForTimeout(1000);

    // console.log('Step 24: Clicking Process > Start...');
    // await d365Page.getByRole('group', { name: 'Process' }).waitFor({ timeout: t.element });
    // await d365Page.getByRole('button', { name: 'Start' }).click();
    // await d365Page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    // await d365Page.waitForTimeout(2000);

    // console.log('Step 25: Confirming Start dialog...');
    // await d365Page.getByText('Standard view - this is the default view Standard view Start').waitFor({ timeout: t.element });
    // await d365Page.getByRole('button', { name: 'OK' }).click();
    // await d365Page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    // await d365Page.waitForLoadState('networkidle', { timeout: t.action });
    // await d365Page.waitForTimeout(3000);


    // ══════════════════════════════════════════════════════════
    //  PART 6 — VERIFY STATUS (COMMENTED OUT)
    // ══════════════════════════════════════════════════════════

    // console.log('Step 26: Verifying batch order status...');
    // await d365Page.locator('#ProdTable_ProdStatus_3_0_header').waitFor({ timeout: t.element }).catch(() => {});
    // const status = await d365Page.getByRole('textbox', { name: 'Status', exact: true }).inputValue().catch(() => 'unknown');
    // if (!status.toLowerCase().includes('start')) {
    //   throw new Error(`Status assertion failed — expected "Started" but got "${status}"`);
    // }
    // console.log(`✓ Status verified: ${status}`);


    // ══════════════════════════════════════════════════════════
    //  PART 7 — OPEN ARDIA (reuses saved session; logs in if needed)
    // ══════════════════════════════════════════════════════════

    console.log('Opening Ardia (authenticated session)...');
    const ardia = await openAuthedArdia(browser);
    ardiaContext = ardia.context;
    const ardiaPage = ardia.page;
    ardiaErrPage = ardiaPage;
    console.log('✓ Ardia ready\n');
    await ardiaPage.screenshot({ path: 'screenshot-ardia-loggedin.png' });


    // ══════════════════════════════════════════════════════════
    //  PART 9 — ARDIA FILTER PANEL
    //  Select Process, Printer, Site, Warehouse, Location
    //  then click Proceed
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
    // Recording shows: open dropdown → scroll container → re-open → click item 25
    console.log(`Step 29: Selecting Warehouse = "${data.warehouse}"...`);
    await ardiaPage.locator('div:nth-of-type(4) textarea').click();
    await ardiaPage.waitForTimeout(800);
    // Scroll the dropdown container down so item 25 (Dixon - Stock) is visible
    await ardiaPage.locator('xpath=//html/body/app-root/app-batch-filters/main/div/div[2]/div/div[4]/app-input-grid-select/div[2]')
      .evaluate((el: Element) => { el.scrollTop = 1000; });
    await ardiaPage.waitForTimeout(500);
    // Re-click the textarea to keep the dropdown open after scrolling
    await ardiaPage.locator('div:nth-of-type(4) textarea').click();
    await ardiaPage.waitForTimeout(500);
    await ardiaPage.locator('xpath=//html/body/app-root/app-batch-filters/main/div/div[2]/div/div[4]/app-input-grid-select/div[2]/div[25]/div').click();
    await ardiaPage.waitForTimeout(1500);  // Wait for Location list to load
    console.log(`         ✓ Warehouse selected: ${data.warehouse}`);

    // ── Step 30: Select Location ───────────────────────────────
    console.log(`Step 30: Selecting Location = "${data.location}"...`);
    await ardiaPage.locator('div:nth-of-type(5) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('xpath=//html/body/app-root/app-batch-filters/main/div/div[2]/div/div[5]/app-input-grid-select/div[2]/div[2]/div').click();
    await ardiaPage.waitForTimeout(800);
    console.log(`         ✓ Location selected: ${data.location}`);

    await ardiaPage.screenshot({ path: 'screenshot-ardia-filters-selected.png' });

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
    await ardiaPage.screenshot({ path: 'screenshot-ardia-batch-orders.png' });



    // ══════════════════════════════════════════════════════════
    //  PART 10 — FIND AND OPEN THE PRODUCTION ORDER TILE
    // ══════════════════════════════════════════════════════════

    console.log(`Step 33: Searching for production order tile: ${batchOrderId}...`);
    await ardiaPage.waitForTimeout(2000);

    // Find the tile containing the batch order ID we just created
    const orderTile = ardiaPage.getByText(new RegExp(batchOrderId, 'i'));
    await orderTile.waitFor({ timeout: t.element });
    await orderTile.scrollIntoViewIfNeeded();
    console.log(`         ✓ Found tile for ${batchOrderId}`);

    await orderTile.click();
    await ardiaPage.waitForTimeout(2000);
    console.log('         ✓ Clicked on production order tile\n');
    await ardiaPage.screenshot({ path: 'screenshot-ardia-tile-selected.png' });


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


    // ══════════════════════════════════════════════════════════
    //  PART 12 — ENTER WEIGHT AND VERIFY RAF API CALL
    // ══════════════════════════════════════════════════════════

    console.log(`Step 36: Entering weight: ${config.ardia.weightInputProduce}...`);
    await weightInput.fill(config.ardia.weightInputProduce);
    await ardiaPage.waitForTimeout(500);
    await ardiaPage.screenshot({ path: 'screenshot-ardia-weight-entered.png' });

    // Set up API response listener BEFORE clicking Enter
    // Playwright intercepts the POST to /raf/v2/rafjournal triggered by Enter
    console.log('Step 37: Clicking Enter and verifying RAF API call...');
    const rafApiPromise = ardiaPage.waitForResponse(
      response =>
        response.url().includes('/raf/v2/rafjournal') &&
        response.request().method() === 'POST',
      { timeout: t.apiResponse }
    );

    await ardiaPage.getByRole('button', { name: 'Enter' }).click();

    // Wait for and assert the RAF API response
    try {
      const rafResponse = await rafApiPromise;
      const status      = rafResponse.status();

      if (status !== 200) {
        throw new Error(`RAF API returned unexpected status: ${status} (expected 200)`);
      }

      const responseBody = await rafResponse.json().catch(() => null);
      console.log(`         ✓ RAF API call verified`);
      console.log(`           URL:    ${rafResponse.url()}`);
      console.log(`           Method: POST`);
      console.log(`           Status: ${status} OK`);
      if (responseBody) {
        console.log(`           Response: ${JSON.stringify(responseBody).substring(0, 100)}...`);
      }
    } catch (err: any) {
      throw new Error(
        `RAF API verification failed: ${err.message}\n` +
        `Expected POST to ${config.ardia.rafApiUrl} with status 200`
      );
    }

    await ardiaPage.waitForTimeout(2000);
    await ardiaPage.screenshot({ path: 'screenshot-ardia-after-enter.png' });
    console.log('         ✓ Weight submitted successfully\n');


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
    await ardiaPage.screenshot({ path: 'screenshot-ardia-stopped.png' });


    // ══════════════════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════════════════

    console.log('\n✅ TEST CASE 1 PASSED');
    console.log(`   Batch Order:  ${batchOrderId}`);
    console.log(`   Weight Input: ${config.ardia.weightInput}`);
    console.log('   RAF API:      POST /raf/v2/rafjournal → 200 OK ✓');
    console.log('   Screenshots:');
    console.log('     screenshot-batch-order-created.png');
    console.log('     screenshot-batch-order-selected.png');
    console.log('     screenshot-ardia-loggedin.png');
    console.log('     screenshot-ardia-filters-selected.png');
    console.log('     screenshot-ardia-batch-orders.png');
    console.log('     screenshot-ardia-tile-selected.png');
    console.log('     screenshot-ardia-weight-entered.png');
    console.log('     screenshot-ardia-after-enter.png');
    console.log('     screenshot-ardia-stopped.png');

  } catch (err: any) {
    console.error(`\n❌ TEST CASE 1 FAILED: ${err.message}`);
    await ardiaErrPage?.screenshot({ path: 'screenshot-error.png' }).catch(() => {});
    console.log('   Error screenshot saved: screenshot-error.png');
    console.log('   Batch Order at failure:', batchOrderId || 'not yet created');
    throw err;   // surface failure to the Playwright Test Runner
  } finally {
    await d365Context?.close();
    await ardiaContext?.close();
  }
}

// Run standalone:  npx ts-node tests/tc1.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser); } finally { await browser.close(); }
  })();
}
