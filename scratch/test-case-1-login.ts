// ============================================================
//  tests/test-case-1-login.ts
//  Test Case 1 — D365: Login + Create Batch Order + Start
//
//  Run with:
//  npx ts-node tests/test-case-1-login.ts
// ============================================================

import { chromium }          from 'playwright';
import { config }            from '../config';
import { testData }          from '../test-data';

// ── Pick the data for this test case ──────────────────────────
const data = testData.TC01;
const t    = config.timeouts;   // shorthand so lines stay readable

(async () => {
  console.log(`Starting Test Case 1 — ${data.description}\n`);
  console.log('Test Data:');
  console.log(`  Item:      ${data.itemNumber}`);
  console.log(`  Site:      ${data.site}`);
  console.log(`  Warehouse: ${data.warehouse}`);
  console.log(`  Location:  ${data.location}`);
  console.log(`  Quantity:  ${data.quantity}\n`);

  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  let batchOrderId = '';

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1 — LOGIN
    // ══════════════════════════════════════════════════════════

    console.log('Step 1: Opening D365...');
    await page.goto(config.d365.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('Step 2: Entering username...');
    await page.getByRole('textbox', { name: 'Enter your email, phone, or' }).waitFor({ timeout: 30000 });
    await page.getByRole('textbox', { name: 'Enter your email, phone, or' }).fill(config.d365.username);
    await page.getByRole('button', { name: 'Next' }).click();

    console.log('Step 3: Entering password...');
    await page.getByRole('textbox', { name: /Enter the password for/ }).waitFor({ timeout: 30000 });
    await page.getByRole('textbox', { name: /Enter the password for/ }).fill(config.d365.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    console.log('Step 4: Waiting for MFA — approve on your authenticator app...');
    await page.getByRole('heading', { name: 'Approve sign in request' }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Yes' }).click();

    console.log('Step 5: Waiting for D365 dashboard...');
    await page.waitForURL('**cmp=THCI**', { timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 90000 });
    console.log('✓ Logged in successfully\n');


    // ══════════════════════════════════════════════════════════
    //  PART 2 — NAVIGATE TO ALL PRODUCTION ORDERS
    // ══════════════════════════════════════════════════════════

    console.log('Step 6 & 7: Navigating to All Production Orders via search...');

  // Open D365 navigation search with Ctrl+/
  await page.keyboard.press('Control+/');
  await page.waitForTimeout(2000);

  // Type the page name
  await page.keyboard.type('All production orders', { delay: 150 });
  await page.waitForTimeout(2000);

  // Click the first matching result
  await page.getByText('All production orders').first().click();
  await page.waitForLoadState('networkidle', { timeout: t.navigation });
  await page.waitForTimeout(2000);
  console.log('✓ On All Production Orders page\n');


    // ══════════════════════════════════════════════════════════
    //  PART 3 — CREATE NEW BATCH ORDER
    // ══════════════════════════════════════════════════════════

    console.log('Step 8: Clicking New batch order...');
    await page.getByRole('button', { name: 'New batch order' }).click();
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(1000);

    console.log('Step 9: Filling batch order number...');
    const batchOrderInput = page.getByRole('textbox', { name: 'Batch order' });
    await batchOrderInput.waitFor({ timeout: t.element });
    await batchOrderInput.fill(data.description);
    batchOrderId = data.description;
    console.log(`         Batch Order ID: ${batchOrderId}`);

    console.log('Step 10: Filling Item number...');
    await page.getByRole('combobox', { name: 'Item number' }).fill(data.itemNumber);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);

    if (data.configuration) {
      console.log('Step 11: Filling Configuration...');
      await page.getByRole('combobox', { name: 'Configuration' }).fill(data.configuration);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
    } else {
      console.log('Step 11: Configuration — skipped');
    }

    console.log('Step 12: Filling Site...');
    await page.getByRole('combobox', { name: 'Site' }).fill(data.site);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    console.log('Step 13: Filling Warehouse...');
    await page.getByRole('combobox', { name: 'Warehouse', exact: true }).fill(data.warehouse);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    console.log('Step 14: Filling Location...');
    await page.getByRole('combobox', { name: 'Location' }).fill(data.location);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    console.log('Step 15: Filling Quantity...');
    await page.locator('#ProdTableCreate_4_Production_QtySched_input').fill(data.quantity);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    console.log('Step 16: Checking for "Insert active versions" dialog...');
    const dialogVisible = await page.getByRole('heading', { name: 'Insert the active versions' }).isVisible({ timeout: 5000 }).catch(() => false);
    if (dialogVisible) {
      console.log('         Dialog found — clicking Yes...');
      await page.getByRole('button', { name: 'Yes' }).click();
      await page.waitForTimeout(1000);
    } else {
      console.log('         Dialog not shown — continuing');
    }

    if (data.formulaNumber) {
      console.log('Step 17: Filling Formula number...');
      await page.getByRole('combobox', { name: 'Formula number' }).fill(data.formulaNumber);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
    } else {
      console.log('Step 17: Formula number — skipped');
    }

    if (data.pool) {
      console.log('Step 18: Filling Pool...');
      await page.getByRole('combobox', { name: 'Pool' }).fill(data.pool);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
    } else {
      console.log('Step 18: Pool — skipped');
    }

    console.log('Step 19: Clicking Create...');
    await page.locator('#ProdTableCreate_4_Ok').click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    console.log(`✓ Batch Order ${batchOrderId} created\n`);
    await page.screenshot({ path: 'screenshot-batch-order-created.png' });


    // ══════════════════════════════════════════════════════════
    //  PART 4 — FILTER GRID AND SELECT THE ORDER
    // ══════════════════════════════════════════════════════════

    console.log('Step 20: Selecting Production orders tab...');
    await page.getByLabel('Production orders', { exact: true }).getByText('Production', { exact: true }).click();
    await page.waitForTimeout(1000);

    console.log(`Step 21: Filtering grid for ${batchOrderId}...`);
    const filterField = page.locator('#__FilterField_ProdTable_ProdId_ProdId_Input_0_0_input');
    await filterField.waitFor({ timeout: t.element });
    await filterField.fill(batchOrderId);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: t.navigation });
    await page.waitForTimeout(2000);

    /*
    // Apply button click is a best-effort — Enter already filtered the grid
    await page.getByRole('button', { name: 'Apply' }).click().catch(() => {
      console.log('         Apply button not found — filter already applied via Enter');
    });
    await page.waitForLoadState('networkidle', { timeout: t.navigation });
    await page.waitForTimeout(2000);
    */

    console.log('Step 22: Selecting the order row...');
    await page.getByRole('checkbox', { name: 'Select or unselect row' }).first().check();
    await page.waitForTimeout(500);


    // ══════════════════════════════════════════════════════════
    //  PART 5 — START THE BATCH ORDER
    // ══════════════════════════════════════════════════════════

    console.log('Step 23: Opening Production order menu...');
    await page.getByRole('button', { name: 'Production order', exact: true }).click();
    await page.waitForTimeout(500);

    console.log('Step 24: Clicking Process > Start...');
    await page.getByRole('group', { name: 'Process' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: 'Start' }).click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1000);

    console.log('Step 25: Confirming Start dialog...');
    await page.getByText('Standard view - this is the default view Standard view Start').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'OK' }).click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 60000 });
    await page.waitForTimeout(1000);


    // ══════════════════════════════════════════════════════════
    //  PART 6 — VERIFY STATUS
    // ══════════════════════════════════════════════════════════

    console.log('Step 26: Verifying batch order status...');
    await page.locator('#ProdTable_ProdStatus_3_0_header').waitFor({ timeout: 15000 }).catch(() => {});
    const status = await page.getByRole('textbox', { name: 'Status', exact: true }).inputValue().catch(() => 'unknown');
    await page.screenshot({ path: 'screenshot-batch-order-started.png' });

    if (!status.toLowerCase().includes('start')) {
      throw new Error(`Status assertion failed — expected "Started" but got "${status}"`);
    }

    console.log(`\n✅ TEST CASE 1 PASSED`);
    console.log(`   Batch Order: ${batchOrderId}`);
    console.log(`   Status:      ${status}`);
    console.log('   Screenshots: screenshot-batch-order-created.png, screenshot-batch-order-started.png');

  } catch (err: any) {
    console.error(`\n❌ TEST CASE 1 FAILED: ${err.message}`);
    await page.screenshot({ path: 'screenshot-error.png' });
    console.log('   Error screenshot saved: screenshot-error.png');
    console.log('   Batch Order at failure:', batchOrderId || 'not yet created');
  } finally {
    await page.waitForTimeout(4000);
    await browser.close();
  }

})();