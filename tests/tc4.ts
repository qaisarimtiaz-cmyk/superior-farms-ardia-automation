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
import * as readline from 'readline';

const data = testData.TC01;
const t    = config.timeouts;
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

export async function run(browser: Browser) {

  // ── Try to read batch order ID from TC1, or prompt for manual barcode ──
  let batchOrderId = '';
  let firstBarcode = '';
  let useManualBarcode = false;

  try {
    const state = readSharedState();
    batchOrderId = state.batchOrderId;
    console.log('   ✓ TC1 shared state found — will extract barcode from D365\n');
  } catch (err) {
    console.log('\n   ⚠  TC1 shared state not found (TC1 may have failed)\n');
    
    if (tc04Data?.fallbackBarcode) {
      console.log('   ✓ Using fallback barcode from test-data.ts\n');
      firstBarcode = tc04Data.fallbackBarcode;
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
  let d365Page:     Page | undefined;   // referenced by the catch block for an error screenshot
  let ardiaErrPage: Page | undefined;   // referenced by the catch block for an error screenshot

  try {

    // ══════════════════════════════════════════════════════════
    //  PART 1-4 — D365 EXTRACTION (skipped if manual barcode)
    // ══════════════════════════════════════════════════════════

    if (!useManualBarcode) {
      console.log('Step 1: Opening D365 (authenticated session)...');
      const d365 = await openAuthedD365(browser);
      d365Context = d365.context;
      d365Page = d365.page;
      console.log('✓ D365 ready\n');


      // ══════════════════════════════════════════════════════════
      //  PART 2 — NAVIGATE TO "REPORT AS FINISHED STAGING DATA"
      //  Locators from Playwright codegen
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
      const rafUrl = 'https://sf-f3-d365-test-723aae8f7890958cedevaos.axcloud.dynamics.com/?cmp=THCI&mi=F3ProdAppRAFProcessForm';
      await d365Page.waitForURL(rafUrl, { timeout: t.navigation });
      console.log('✓ Confirmed on Report as finished staging data form\n');
      await d365Page.screenshot({ path: 'screenshot-tc4-raf-staging-form.png' });


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
      await d365Page.screenshot({ path: 'screenshot-tc4-raf-filtered.png' });


      // ══════════════════════════════════════════════════════════
      //  PART 4 — LOCATE THE BARCODE COLUMN AND COPY FIRST VALUE
      //  The barcode format is: (01)XXXXXX(3202)XXXXXX(11)XXXXXX(21)XXXXXX
      //  It is read from the title attribute of the first barcode cell.
      // ══════════════════════════════════════════════════════════

      console.log('Step 13: Locating the Barcode column in the results grid...');
      await d365Page.getByText('Barcode').waitFor({ timeout: t.element });
      console.log('         ✓ Barcode column found');

      console.log('Step 14: Reading the first barcode value from the grid...');
      // The barcode is stored in the title attribute of the first data cell
      // under the Barcode column. We grab the first matching cell title.
      const barcodeCell = d365Page.locator('[title*="(01)"]').first();
      await barcodeCell.waitFor({ timeout: t.element });

      // title holds the full barcode string e.g. (01)90717497100436(3202)004688(11)260305(21)0603785481
      firstBarcode = (await barcodeCell.getAttribute('title') ?? '').trim();

      if (!firstBarcode) {
        throw new Error(
          `Barcode value is empty — confirm a row exists for batch order "${batchOrderId}" ` +
          `and that results contain a Barcode column with a title attribute starting with "(01)".`
        );
      }

      console.log(`         ✓ Barcode captured: ${firstBarcode}\n`);
      await d365Page.screenshot({ path: 'screenshot-tc4-barcode-captured.png' });
    } else {
      console.log('Step 1-14: Skipping D365 steps (using manual barcode)\n');
    }


    // ══════════════════════════════════════════════════════════
    //  PART 5 — OPEN ARDIA (reuses saved session; logs in if needed)
    // ══════════════════════════════════════════════════════════

    console.log('Step 15: Opening Ardia (authenticated session)...');
    const ardia = await openAuthedArdia(browser);
    ardiaContext = ardia.context;
    const ardiaPage = ardia.page;
    ardiaErrPage = ardiaPage;
    console.log('✓ Ardia ready\n');
    await ardiaPage.screenshot({ path: 'screenshot-tc4-ardia-loggedin.png' });


    // ══════════════════════════════════════════════════════════
    //  PART 7 — ARDIA BATCH FILTERS: OPEN FIRST DROPDOWN
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
    await ardiaPage.screenshot({ path: 'screenshot-tc4-ardia-filter-selected.png' });


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
    await ardiaPage.screenshot({ path: 'screenshot-tc4-ardia-after-proceed.png' });


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
    await ardiaPage.screenshot({ path: 'screenshot-tc4-barcode-entered.png' });


    // ══════════════════════════════════════════════════════════
    //  SUMMARY
    // ══════════════════════════════════════════════════════════

    console.log('\n✅ TEST CASE 4 PASSED');
    console.log(`   Batch Order: ${batchOrderId || '(manual barcode used)'}`);
    console.log(`   Barcode: ${firstBarcode}`);
    console.log(`   Source: ${useManualBarcode ? 'Manual Input' : 'TC1 (D365 RAF Staging)'}`);
    console.log('   Screenshots:');
    if (!useManualBarcode) {
      console.log('     screenshot-tc4-raf-staging-form.png');
      console.log('     screenshot-tc4-raf-filtered.png');
      console.log('     screenshot-tc4-barcode-captured.png');
    }
    console.log('     screenshot-tc4-ardia-loggedin.png');
    console.log('     screenshot-tc4-ardia-filter-selected.png');
    console.log('     screenshot-tc4-ardia-after-proceed.png');
    console.log('     screenshot-tc4-barcode-entered.png');

  } catch (err: any) {
    console.error(`\n❌ TEST CASE 4 FAILED: ${err.message}`);
    await d365Page?.screenshot({ path: 'screenshot-tc4-error-d365.png' }).catch(() => {});
    await ardiaErrPage?.screenshot({ path: 'screenshot-tc4-error-ardia.png' }).catch(() => {});
    console.log('   Error screenshots saved:');
    console.log('     screenshot-tc4-error-d365.png');
    console.log('     screenshot-tc4-error-ardia.png');
    console.log(`   Batch Order: ${batchOrderId || '(manual barcode used)'}`);
    console.log(`   Barcode: ${firstBarcode || 'not yet captured'}`);
    console.log(`   Source: ${useManualBarcode ? 'Manual Input' : 'TC1 (D365 RAF Staging)'}`);
    throw err;   // surface failure to the Playwright Test Runner
  } finally {
    await d365Context?.close();
    await ardiaContext?.close();
  }
}

// Run standalone:  npx ts-node tests/tc4.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser); } finally { await browser.close(); }
  })();
}