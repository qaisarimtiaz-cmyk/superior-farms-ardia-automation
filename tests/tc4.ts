// ============================================================
//  tests/tc4.ts
//  Test Case 4 — D365: Login + Navigate to "Report as finished
//               staging data" + Filter by TC1 Batch Order
//               + Copy first row Barcode
//               Ardia: Login + Batch Filters + Proceed
//                      + Enter Barcode in Conversions
//
//  Prereq: TC1 must have already run successfully.
//          The batch order ID is read automatically from
//          shared-state.json written by TC1.
//
//  Run standalone:   npx ts-node tests/tc4.ts
//  Run in sequence:  npx ts-node tests/run-tc1-tc4.ts
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }   from '../config';
import { testData } from '../test-data';
import { readSharedState } from '../utils/shared-state';   // ← reads from TC1
import { openAuthedD365, openAuthedArdia } from './helpers/auth-flows';
import { ReportCollector } from './helpers/report-collector';
import { screenshotPath } from '../utils/run-folder';
import * as readline from 'readline';

const data    = testData.TC01;
const t       = config.timeouts;
const tc04Data = testData.TC04;

// ── Helper function to prompt user for input ───────────────────
function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function run(browser: Browser, testInfo: any = null) {

  // ── Try to read batch order ID from TC1, or prompt for manual barcode ──
  let batchOrderId     = '';
  let firstBarcode     = '';
  let useManualBarcode = false;

  try {
    const state = readSharedState('TC01');
    batchOrderId = state.batchOrderId;
    console.log('   ✓ TC1 shared state found — will extract barcode from D365\n');
  } catch (err) {
    console.log('\n   ⚠  TC1 shared state not found (TC1 may have failed)\n');

    if (tc04Data?.fallbackBarcode) {
      console.log('   ✓ Using fallback barcode from test-data.ts\n');
      firstBarcode     = tc04Data.fallbackBarcode;
      useManualBarcode = true;
    } else {
      console.log('   ⚠  No fallback barcode configured in test-data.ts\n');
      console.log('   OPTIONS:');
      console.log('   1. Configure fallbackBarcode in test-data.ts > TC04');
      console.log('   2. Or provide barcode manually below\n');

      firstBarcode = await promptUser('   Enter barcode (or press Enter to exit): ');

      if (!firstBarcode) {
        console.log('   ❌ No barcode provided. Exiting...\n');
        process.exit(0);
      }
      useManualBarcode = true;
    }
  }

  const reportTestData: Record<string, string> = {
    'Item Number':   String(data.itemNumber ?? ''),
    'Configuration': String(data.configuration ?? ''),
    'Site':          String(data.site ?? ''),
    'Warehouse':     String(data.warehouse ?? ''),
    'Location':      String(data.location ?? ''),
    'Batch Order':   batchOrderId || '(manual barcode)',
    'Barcode Source': useManualBarcode ? 'Manual / Fallback' : 'TC1 D365 RAF Staging',
    'Process':       'Conversions',
  };
  const report = new ReportCollector('Test Case 4', reportTestData);

  console.log('=============================================================');
  console.log(' Test Case 4 — RAF Staging Barcode → Ardia Conversions');
  console.log('=============================================================');
  if (useManualBarcode) {
    console.log(`  Barcode (manual input): ${firstBarcode}\n`);
  } else {
    console.log(`  Batch Order (from TC1): ${batchOrderId}\n`);
  }

  let d365Context:  BrowserContext | undefined;
  let ardiaContext: BrowserContext | undefined;
  let d365Page:     Page | undefined;
  let ardiaErrPage: Page | undefined;
  let overall: 'PASS' | 'FAIL' = 'FAIL';
  let deferredError: any = null;

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1-4 — D365 EXTRACTION (skipped if manual barcode)
    // ══════════════════════════════════════════════════════════

    if (!useManualBarcode) {
      console.log('Step 1: Opening D365 (authenticated session)...');
      const d365 = await openAuthedD365(browser);
      d365Context = d365.context;
      d365Page    = d365.page;
      console.log('✓ D365 ready\n');
      report.add('Open D365 (authenticated session)', 'PASS');


      // ══════════════════════════════════════════════════════════
      //  PART 2 — NAVIGATE TO "REPORT AS FINISHED STAGING DATA"
      // ══════════════════════════════════════════════════════════

      console.log('Step 6: Clicking the Search button on the D365 dashboard...');
      await d365Page.getByRole('button', { name: 'Search' }).click();
      await d365Page.waitForTimeout(1500);

      console.log('Step 7: Typing "Report as finished staging data" in the search box...');
      await d365Page.getByRole('textbox', { name: 'Search for a page' }).fill('Report as finished staging data');
      await d365Page.waitForTimeout(2000);

      console.log('Step 8: Clicking the search result option...');
      await d365Page.getByRole('option', {
        name: 'Report as finished staging data System administration > Setup > Ardia app',
        exact: true,
      }).click();
      await d365Page.waitForLoadState('networkidle', { timeout: t.navigation });
      await d365Page.waitForTimeout(2000);

      console.log('Step 9: Confirming redirect to RAF form URL...');
      // Match by query params only (wildcard), not a hardcoded domain — the
      // literal UAT sandbox URL here broke as soon as .env pointed at a
      // different D365 environment. Same pattern already proven reliable
      // in auth-flows.ts's login URL check.
      await d365Page.waitForURL('**cmp=THCI&mi=F3ProdAppRAFProcessForm**', { timeout: t.navigation });
      console.log('✓ Confirmed on Report as finished staging data form\n');
      await d365Page.screenshot({ path: screenshotPath('screenshot-tc4-raf-staging-form.png') });
      report.addScreenshot('D365 RAF Staging form', screenshotPath('screenshot-tc4-raf-staging-form.png'));
      report.add('Navigate to RAF Staging Data in D365', 'PASS');


      // ══════════════════════════════════════════════════════════
      //  PART 3 — FILTER THE GRID BY BATCH ORDER NUMBER
      // ══════════════════════════════════════════════════════════

      console.log('Step 10: Clicking the "Batch number" column header to open the filter popup...');
      await d365Page.getByText('Batch number').click();
      await d365Page.waitForTimeout(1000);

      console.log(`Step 11: Entering batch order number "${batchOrderId}" into the filter combobox...`);
      const batchFilterCombobox = d365Page.getByRole('combobox', {
        name: 'Filter field: Batch number,',
      });
      await batchFilterCombobox.click();
      await batchFilterCombobox.fill(batchOrderId);
      await d365Page.waitForTimeout(500);

      console.log('Step 12: Clicking Apply to execute the filter...');
      await d365Page.getByRole('button', { name: 'Apply' }).click();
      await d365Page.waitForLoadState('networkidle', { timeout: t.navigation });
      await d365Page.waitForTimeout(2000);
      console.log(`✓ Filter applied — showing results for batch order "${batchOrderId}"\n`);
      await d365Page.screenshot({ path: screenshotPath('screenshot-tc4-raf-filtered.png') });
      report.addScreenshot('RAF Staging filtered by batch order', screenshotPath('screenshot-tc4-raf-filtered.png'));
      report.add(`Filter RAF Staging by Batch Order (${batchOrderId})`, 'PASS', batchOrderId);


      // ══════════════════════════════════════════════════════════
      //  PART 4 — LOCATE THE BARCODE COLUMN AND COPY FIRST VALUE
      // ══════════════════════════════════════════════════════════

      console.log('Step 13: Locating the Barcode column in the results grid...');
      await d365Page.getByText('Barcode').waitFor({ timeout: t.element });
      console.log('         ✓ Barcode column found');

      console.log('Step 14: Reading the first barcode value from the grid...');
      const barcodeCell = d365Page.locator('[title*="(01)"]').first();
      await barcodeCell.waitFor({ timeout: t.element });

      firstBarcode = (await barcodeCell.getAttribute('title') ?? '').trim();

      if (!firstBarcode) {
        throw new Error(
          `Barcode value is empty — confirm a row exists for batch order "${batchOrderId}" ` +
          `and that results contain a Barcode column with a title attribute starting with "(01)".`
        );
      }

      console.log(`         ✓ Barcode captured: ${firstBarcode}\n`);
      await d365Page.screenshot({ path: screenshotPath('screenshot-tc4-barcode-captured.png') });
      report.addScreenshot('Barcode captured from grid', screenshotPath('screenshot-tc4-barcode-captured.png'));
      report.add('Extract Barcode from RAF Staging grid', 'PASS', firstBarcode);

    } else {
      console.log('Step 1-14: Skipping D365 steps (using manual/fallback barcode)\n');
      report.add('D365 Extraction', 'INFO', `Skipped — using barcode: ${firstBarcode}`);
    }


    // ══════════════════════════════════════════════════════════
    //  PART 5 — OPEN ARDIA
    // ══════════════════════════════════════════════════════════

    console.log('Step 15: Opening Ardia (authenticated session)...');
    const ardia = await openAuthedArdia(browser);
    ardiaContext = ardia.context;
    const ardiaPage = ardia.page;
    ardiaErrPage = ardiaPage;
    console.log('✓ Ardia ready\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc4-ardia-loggedin.png') });
    report.add('Open Ardia (authenticated session)', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 7 — ARDIA BATCH FILTERS
    // ══════════════════════════════════════════════════════════

    console.log('Step 17: Waiting for Ardia batch-filters page...');
    await ardiaPage.getByText('Select Process').waitFor({ timeout: t.element });
    await ardiaPage.waitForTimeout(1000);

    console.log('Step 18: Clicking the first filter dropdown textarea...');
    await ardiaPage.locator(
      `//div[position()=1]/div[position()=1]/app-input-grid-select[position()=1]/div[position()=1]/textarea[position()=1]`
    ).click();
    await ardiaPage.waitForTimeout(800);

    console.log('Step 19: Selecting the option at div[3] in the dropdown list...');
    await ardiaPage.locator(
      `xpath=/html/body/app-root/app-batch-filters/main/div/div[2]/div/div[1]/app-input-grid-select/div[2]/div[3]/div`
    ).click();
    await ardiaPage.waitForTimeout(800);
    console.log('         ✓ Dropdown option selected\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc4-ardia-filter-selected.png') });
    report.addScreenshot('Ardia filter selected', screenshotPath('screenshot-tc4-ardia-filter-selected.png'));
    report.add('Select Ardia Process filter', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 8 — CLICK PROCEED
    // ══════════════════════════════════════════════════════════

    console.log('Step 20: Clicking the Proceed button...');
    await ardiaPage.locator(
      `xpath=/html/body/app-root/app-batch-filters/main/div/div[2]/div/div[6]/button`
    ).click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation });
    await ardiaPage.waitForTimeout(3000);
    console.log('✓ Proceeded past the filter page\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc4-ardia-after-proceed.png') });
    report.addScreenshot('Ardia after Proceed', screenshotPath('screenshot-tc4-ardia-after-proceed.png'));
    report.add('Proceed to Ardia Conversions page', 'PASS');


    // ══════════════════════════════════════════════════════════
    //  PART 9 — ENTER BARCODE IN ARDIA CONVERSIONS TEXT FIELD
    // ══════════════════════════════════════════════════════════

    console.log(`Step 21: Entering barcode "${firstBarcode}" into the Ardia conversions input...`);
    const barcodeInput = ardiaPage.locator(
      `xpath=/html/body/app-root/app-conversions/main/section/div/div/input`
    );
    await barcodeInput.waitFor({ timeout: t.element });
    await barcodeInput.fill(firstBarcode);
    await ardiaPage.keyboard.press('Enter');
    await ardiaPage.waitForTimeout(2000);
    console.log('         ✓ Barcode entered and submitted\n');
    await ardiaPage.screenshot({ path: screenshotPath('screenshot-tc4-barcode-entered.png') });
    report.addScreenshot('Barcode entered in Ardia Conversions', screenshotPath('screenshot-tc4-barcode-entered.png'));
    report.add('Enter Barcode in Ardia Conversions', 'PASS', firstBarcode);


    // ══════════════════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════════════════

    overall = 'PASS';
    console.log('\n✅ TEST CASE 4 PASSED');
    console.log(`   Batch Order: ${batchOrderId || '(manual barcode used)'}`);
    console.log(`   Barcode:     ${firstBarcode}`);
    console.log(`   Source:      ${useManualBarcode ? 'Manual Input' : 'TC1 (D365 RAF Staging)'}`);

  } catch (err: any) {
    overall = 'FAIL';
    console.error(`\n❌ TEST CASE 4 FAILED: ${err.message}`);
    report.add('TEST FAILED', 'FAIL', err.message);
    await d365Page?.screenshot({ path: screenshotPath('screenshot-tc4-error-d365.png') }).catch(() => {});
    await ardiaErrPage?.screenshot({ path: screenshotPath('screenshot-tc4-error-ardia.png') }).catch(() => {});
    report.addScreenshot('Failure screenshot (D365)', screenshotPath('screenshot-tc4-error-d365.png'));
    report.addScreenshot('Failure screenshot (Ardia)', screenshotPath('screenshot-tc4-error-ardia.png'));
    console.log(`   Batch Order: ${batchOrderId || '(manual barcode used)'}`);
    console.log(`   Barcode:     ${firstBarcode || 'not yet captured'}`);
    deferredError = err;
  } finally {
    try {
      const meta: Record<string, string> = {
        'Overall Result': overall,
        'Batch Order ID': batchOrderId || '(manual barcode)',
        'Barcode':        firstBarcode || '(not captured)',
        'Barcode Source': useManualBarcode ? 'Manual / Fallback' : 'TC1 D365 RAF Staging',
        'Process':        'Conversions',
      };
      const { excelPath } = await report.finalize(testInfo, meta);
      console.log(`\n📊 Excel report written: ${excelPath}`);
    } catch (repErr: any) {
      console.error(`   ⚠ Failed to write report: ${repErr.message}`);
    }

    await d365Context?.close();
    await ardiaContext?.close();
  }

  if (deferredError) throw deferredError;
}

// Run standalone:  npx ts-node tests/tc4.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser, null); } finally { await browser.close(); }
  })();
}
