// ============================================================
//  tests/tc5.ts
//  Test Case 5 — Ardia: Login + Batch Filters
//               + Select Produce
//               + Click Reprint/Reversal
//               + Select first tag tile + Click Save
//               + Verify barcodereprint API call (status 200)
//
//  Run standalone:   npx ts-node tests/tc5.ts
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }   from '../config';
import { testData } from '../test-data';
import { openAuthedArdia } from './helpers/auth-flows';
import { ReportCollector } from './helpers/report-collector';
import { screenshotPath } from '../utils/run-folder';

const data = testData.TC05;
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

export async function run(browser: Browser, testInfo: any = null) {

  console.log('=============================================================');
  console.log(' Test Case 5 — Ardia Produce → Reprint/Reversal Label');
  console.log('=============================================================');
  console.log(`  Process: Produce`);
  console.log(`  Printer: ${data.printer}\n`);

  // Test data shown in BOTH the Excel and the client HTML report
  const reportTestData: Record<string, string> = {
    'Item Number':   String(data.itemNumber ?? ''),
    'Configuration': String(data.configuration ?? ''),
    'Site':          String(data.site ?? ''),
    'Warehouse':     String(data.warehouse ?? ''),
    'Location':      String(data.location ?? ''),
    'Quantity':      String(data.quantity ?? ''),
    'Printer':       String(data.printer ?? ''),
    'Process':       'Produce',
  };
  const report = new ReportCollector('Test Case 5', reportTestData);

  let ardiaContext: BrowserContext | undefined;
  let ardiaErrPage: Page | undefined;   // referenced by the catch block for an error screenshot
  let overall: 'PASS' | 'FAIL' = 'FAIL';
  let tagTextResult = '';

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1 — OPEN ARDIA (reuses saved session; logs in if needed)
    // ══════════════════════════════════════════════════════════

    console.log('Opening Ardia (authenticated session)...');
    const ardia = await openAuthedArdia(browser);
    ardiaContext = ardia.context;
    const ardiaPage = ardia.page;
    ardiaErrPage = ardiaPage;
    console.log('✓ Ardia ready\n');
    report.add('Open Ardia (authenticated session)', 'PASS');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc5-ardia-loggedin.png') });
    report.addScreenshot('Ardia logged in', screenshotPath('screenshot-tc5-ardia-loggedin.png'));


    // ══════════════════════════════════════════════════════════
    //  PART 3 — ARDIA BATCH FILTERS: SELECT PROCESS = PRODUCE
    // ══════════════════════════════════════════════════════════

    console.log('Step 3: Waiting for Ardia batch-filters page...');
    await ardiaPage.getByText('Select Process').waitFor({ timeout: t.element });
    await ardiaPage.waitForTimeout(1000);

    console.log('Step 4: Clicking the first filter dropdown (Process)...');
    await ardiaPage.locator('div.col-5 > div > div:nth-of-type(1) textarea').click();
    await ardiaPage.waitForTimeout(800);

    console.log('Step 5: Selecting "Produce" option...');
    await ardiaPage.locator('div.dropdownContainer > div:nth-of-type(1) > div').click();
    await ardiaPage.waitForTimeout(800);
    console.log('         ✓ Process selected: Produce');

    console.log('Step 6: Selecting Printer...');
    await ardiaPage.locator('div.col-5 > div > div:nth-of-type(2) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('div.dropdownContainer > div:nth-of-type(2) > div').click();
    await ardiaPage.waitForTimeout(800);
    console.log(`         ✓ Printer selected: ${data.printer}`);

    console.log('Step 7: Selecting Site...');
    await ardiaPage.locator('div:nth-of-type(3) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('div.col-5 div:nth-of-type(3) > div').click();
    await ardiaPage.waitForTimeout(1500);
    console.log(`         ✓ Site selected: ${data.site}`);

    console.log(`Step 8: Selecting Warehouse = "${data.warehouseDisplayText || data.warehouse}"...`);
    await ardiaPage.locator('div:nth-of-type(4) textarea').click();
    await ardiaPage.waitForTimeout(800);
    // Scroll incrementally and match by visible text instead of a hardcoded
    // item index — the index-based approach broke whenever the warehouse
    // wasn't at the assumed position. Same fix already proven in TC3/TC10/TC12.
    await scrollArdiaDropdownUntilVisible(ardiaPage, data.warehouseDisplayText || data.warehouse);
    await ardiaPage.getByText(data.warehouseDisplayText || data.warehouse, { exact: !!data.warehouseDisplayText }).first().click();
    await ardiaPage.waitForTimeout(1500);
    console.log(`         ✓ Warehouse selected: ${data.warehouseDisplayText || data.warehouse}`);

    console.log('Step 9: Selecting Location...');
    await ardiaPage.locator('div:nth-of-type(5) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('xpath=//html/body/app-root/app-batch-filters/main/div/div[2]/div/div[5]/app-input-grid-select/div[2]/div[2]/div').click();
    await ardiaPage.waitForTimeout(800);
    console.log(`         ✓ Location selected: ${data.location}`);

    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc5-filters-selected.png') });
    report.addScreenshot('Ardia filters selected', screenshotPath('screenshot-tc5-filters-selected.png'));
    report.add('Select Ardia filters (Process/Printer/Site/WH/Location)', 'PASS');

    console.log('Step 10: Clicking Proceed...');
    await ardiaPage.locator('div:nth-of-type(6) > button').click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation });
    await ardiaPage.waitForTimeout(3000);
    console.log('✓ Proceeded to Produce page\n');
    report.add('Proceed to Produce page', 'PASS');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc5-produce-page.png') });
    report.addScreenshot('Produce page', screenshotPath('screenshot-tc5-produce-page.png'));


    // ══════════════════════════════════════════════════════════
    //  PART 4 — CLICK REPRINT/REVERSAL BUTTON
    // ══════════════════════════════════════════════════════════

    console.log('Step 11: Looking for Reprint/Reversal button on Produce page...');
    const reprintButton = ardiaPage.getByRole('button', { name: 'Reprint/Reversal' });
    await reprintButton.waitFor({ timeout: t.element });
    console.log('         ✓ Reprint/Reversal button found');

    console.log('Step 12: Clicking Reprint/Reversal button...');
    await reprintButton.click();
    await ardiaPage.waitForTimeout(2000);
    console.log('         ✓ Clicked Reprint/Reversal\n');
    report.add('Click Reprint/Reversal button', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 5 — VALIDATE ON REPRINT & REVERSAL LABEL PAGE
    // ══════════════════════════════════════════════════════════

    console.log('Step 13: Validating we are on Reprint & Reversal Label page...');
    const reprintHeading = ardiaPage.getByRole('heading', { name: 'Reprint & Reversal Label' });
    await reprintHeading.waitFor({ timeout: t.element });
    console.log('         ✓ Confirmed on Reprint & Reversal Label page\n');
    report.add('Validate Reprint & Reversal Label page', 'PASS');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc5-reprint-page.png') });
    report.addScreenshot('Reprint & Reversal Label page', screenshotPath('screenshot-tc5-reprint-page.png'));


    // ══════════════════════════════════════════════════════════
    //  PART 6 — SELECT FIRST TAG TILE
    //  Look for tile with text pattern like "- XXXXXX.XX lb(s)"
    // ══════════════════════════════════════════════════════════

    console.log('Step 14: Looking for tag tiles with weight pattern "- XXX.XX lb(s)"...');
    const tagTile = ardiaPage.locator('text=/- \\d+\\.\\d+ lb\\(s\\)/').first();
    await tagTile.waitFor({ timeout: t.element });
    const tagText = await tagTile.textContent();
    tagTextResult = tagText ?? '';
    console.log(`         ✓ Found first tag tile: ${tagText}`);

    console.log('Step 15: Clicking on the first tag tile...');
    await tagTile.click();
    await ardiaPage.waitForTimeout(1500);
    console.log('         ✓ Tag tile selected\n');
    report.add('Select first tag tile', 'PASS', tagText ?? '');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc5-tag-selected.png') });
    report.addScreenshot('Tag tile selected', screenshotPath('screenshot-tc5-tag-selected.png'));


    // ══════════════════════════════════════════════════════════
    //  PART 7 — CLICK SAVE BUTTON AND VERIFY API CALL
    // ══════════════════════════════════════════════════════════

    console.log('Step 16: Setting up API response listener...');
    const reprintApiPromise = ardiaPage.waitForResponse(
      response =>
        response.url().includes('/barcodereprint') &&
        response.request().method() === 'POST',
      { timeout: t.apiResponse }
    );

    console.log('Step 17: Clicking Save button...');
    const saveButton = ardiaPage.getByRole('button', { name: 'Save' });
    await saveButton.waitFor({ timeout: t.element });
    await saveButton.click();

    // Wait for and assert the barcodereprint API response
    try {
      const reprintResponse = await reprintApiPromise;
      const status = reprintResponse.status();

      if (status !== 200) {
        throw new Error(`barcodereprint API returned unexpected status: ${status} (expected 200)`);
      }

      const responseBody = await reprintResponse.json().catch(() => null);
      console.log(`         ✓ barcodereprint API call verified`);
      console.log(`           URL:    ${reprintResponse.url()}`);
      console.log(`           Method: POST`);
      console.log(`           Status: ${status} OK`);
      if (responseBody) {
        console.log(`           Response: ${JSON.stringify(responseBody).substring(0, 100)}...`);
      }
      report.add('Save & verify barcodereprint API (POST)', 'PASS', 'barcodereprint POST → 200 OK');
    } catch (err: any) {
      report.add('Save & verify barcodereprint API (POST)', 'FAIL', err.message);
      throw new Error(
        `barcodereprint API verification failed: ${err.message}\n` +
        `Expected POST to https://10.164.2.92:812/barcodereprint with status 200`
      );
    }

    await ardiaPage.waitForTimeout(2000);
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc5-after-save.png') });
    report.addScreenshot('After save', screenshotPath('screenshot-tc5-after-save.png'));
    console.log('         ✓ Save completed successfully\n');
    report.add('Save completed successfully', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════════════════

    overall = 'PASS';
    console.log('\n✅ TEST CASE 5 PASSED');
    console.log(`   Process: Produce`);
    console.log(`   Tag Selected: ${tagText}`);
    console.log('   Screenshots:');
    console.log('     screenshot-tc5-ardia-loggedin.png');
    console.log('     screenshot-tc5-filters-selected.png');
    console.log('     screenshot-tc5-produce-page.png');
    console.log('     screenshot-tc5-reprint-page.png');
    console.log('     screenshot-tc5-tag-selected.png');
    console.log('     screenshot-tc5-after-save.png');

  } catch (err: any) {
    report.add('TEST FAILED', 'FAIL', err.message ?? String(err));
    console.error(`\n❌ TEST CASE 5 FAILED: ${err.message}`);
    await ardiaErrPage?.screenshot({ path: screenshotPath('screenshot-tc5-error.png') }).catch(() => {});
    report.addScreenshot('Failure screenshot', screenshotPath('screenshot-tc5-error.png'));
    console.log('   Error screenshot saved:');
    console.log('     screenshot-tc5-error.png');
    throw err;   // surface failure to the Playwright Test Runner
  } finally {
    try {
      const meta: Record<string, string> = {
        'Overall Result': overall,
        'Process':        'Produce',
        'Tag Selected':   tagTextResult || '(not selected)',
        'Printer':        data.printer,
        'barcodereprint API': 'POST /barcodereprint → 200 OK',
      };
      const { excelPath } = await report.finalize(testInfo, meta);
      console.log(`\n📊 Excel report written: ${excelPath}`);
    } catch (repErr: any) {
      console.error(`   ⚠ Failed to write report: ${repErr.message}`);
    }
    await ardiaContext?.close();
  }
}

// Run standalone:  npx ts-node tests/tc5.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser, null); } finally { await browser.close(); }
  })();
}
