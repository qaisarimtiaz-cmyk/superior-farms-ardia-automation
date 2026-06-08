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

const data = testData.TC05;
const t    = config.timeouts;

export async function run(browser: Browser) {

  console.log('=============================================================');
  console.log(' Test Case 5 — Ardia Produce → Reprint/Reversal Label');
  console.log('=============================================================');
  console.log(`  Process: Produce`);
  console.log(`  Printer: ${data.printer}\n`);

  let ardiaContext: BrowserContext | undefined;
  let ardiaErrPage: Page | undefined;   // referenced by the catch block for an error screenshot

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
    await ardiaPage.screenshot({ path: 'screenshot-tc5-ardia-loggedin.png' });


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

    console.log('Step 8: Selecting Warehouse...');
    await ardiaPage.locator('div:nth-of-type(4) textarea').click();
    await ardiaPage.waitForTimeout(800);
    // Scroll and select warehouse
    await ardiaPage.locator('xpath=//html/body/app-root/app-batch-filters/main/div/div[2]/div/div[4]/app-input-grid-select/div[2]')
      .evaluate((el: Element) => { el.scrollTop = 1000; });
    await ardiaPage.waitForTimeout(500);
    await ardiaPage.locator('div:nth-of-type(4) textarea').click();
    await ardiaPage.waitForTimeout(500);
    await ardiaPage.locator('xpath=//html/body/app-root/app-batch-filters/main/div/div[2]/div/div[4]/app-input-grid-select/div[2]/div[25]/div').click();
    await ardiaPage.waitForTimeout(1500);
    console.log(`         ✓ Warehouse selected: ${data.warehouse}`);

    console.log('Step 9: Selecting Location...');
    await ardiaPage.locator('div:nth-of-type(5) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await ardiaPage.locator('xpath=//html/body/app-root/app-batch-filters/main/div/div[2]/div/div[5]/app-input-grid-select/div[2]/div[2]/div').click();
    await ardiaPage.waitForTimeout(800);
    console.log(`         ✓ Location selected: ${data.location}`);

    await ardiaPage.screenshot({ path: 'screenshot-tc5-filters-selected.png' });

    console.log('Step 10: Clicking Proceed...');
    await ardiaPage.locator('div:nth-of-type(6) > button').click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation });
    await ardiaPage.waitForTimeout(3000);
    console.log('✓ Proceeded to Produce page\n');
    await ardiaPage.screenshot({ path: 'screenshot-tc5-produce-page.png' });


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


    // ══════════════════════════════════════════════════════════
    //  PART 5 — VALIDATE ON REPRINT & REVERSAL LABEL PAGE
    // ══════════════════════════════════════════════════════════

    console.log('Step 13: Validating we are on Reprint & Reversal Label page...');
    const reprintHeading = ardiaPage.getByRole('heading', { name: 'Reprint & Reversal Label' });
    await reprintHeading.waitFor({ timeout: t.element });
    console.log('         ✓ Confirmed on Reprint & Reversal Label page\n');
    await ardiaPage.screenshot({ path: 'screenshot-tc5-reprint-page.png' });


    // ══════════════════════════════════════════════════════════
    //  PART 6 — SELECT FIRST TAG TILE
    //  Look for tile with text pattern like "- XXXXXX.XX lb(s)"
    // ══════════════════════════════════════════════════════════

    console.log('Step 14: Looking for tag tiles with weight pattern "- XXX.XX lb(s)"...');
    const tagTile = ardiaPage.locator('text=/- \\d+\\.\\d+ lb\\(s\\)/').first();
    await tagTile.waitFor({ timeout: t.element });
    const tagText = await tagTile.textContent();
    console.log(`         ✓ Found first tag tile: ${tagText}`);

    console.log('Step 15: Clicking on the first tag tile...');
    await tagTile.click();
    await ardiaPage.waitForTimeout(1500);
    console.log('         ✓ Tag tile selected\n');
    await ardiaPage.screenshot({ path: 'screenshot-tc5-tag-selected.png' });


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
    } catch (err: any) {
      throw new Error(
        `barcodereprint API verification failed: ${err.message}\n` +
        `Expected POST to https://10.164.2.92:812/barcodereprint with status 200`
      );
    }

    await ardiaPage.waitForTimeout(2000);
    await ardiaPage.screenshot({ path: 'screenshot-tc5-after-save.png' });
    console.log('         ✓ Save completed successfully\n');


    // ══════════════════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════════════════

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
    console.error(`\n❌ TEST CASE 5 FAILED: ${err.message}`);
    await ardiaErrPage?.screenshot({ path: 'screenshot-tc5-error.png' }).catch(() => {});
    console.log('   Error screenshot saved:');
    console.log('     screenshot-tc5-error.png');
    throw err;   // surface failure to the Playwright Test Runner
  } finally {
    await ardiaContext?.close();
  }
}

// Run standalone:  npx ts-node tests/tc5.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser); } finally { await browser.close(); }
  })();
}
