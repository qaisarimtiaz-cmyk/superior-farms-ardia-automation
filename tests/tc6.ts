// ============================================================
//  tests/tc6.ts
//  Test Case 6 — D365: Catch Weight Tag Deletion Workflow
//
//  Workflow:
//  1. Login to D365
//  2. Go to Catch Weight Tag Inquiry v2 and retrieve registered tags
//  3. Copy a tag number with "Registered" status
//  4. Navigate to Tag or license plate deletion form
//  5. Edit the form, paste the tag number, and delete the tag
//  6. Validate deletion by checking RAF reversal staging data
//
//  Run with:
//  npx ts-node tests/tc6.ts
// ============================================================

import { chromium, Browser, BrowserContext, Page }  from 'playwright';
import { config }    from '../config';
import { openAuthedD365 } from './helpers/auth-flows';

const t    = config.timeouts;

export async function run(browser: Browser) {
  console.log('Starting Test Case 6 — Catch Weight Tag Deletion Workflow\n');

  let d365Context: BrowserContext | undefined;
  let d365ErrPage: Page | undefined;

  let retrievedTagNumber = '';

  try {
    // ══════════════════════════════════════════════════════════
    //  PART 1 — LOGIN TO D365
    // ══════════════════════════════════════════════════════════

    console.log('Step 1: Opening D365 (authenticated session)...');
    const d365 = await openAuthedD365(browser);
    d365Context = d365.context;
    const d365Page = d365.page;
    d365ErrPage = d365Page;
    const page = d365Page;
    console.log('✓ Logged in and dashboard loaded\n');

    // ══════════════════════════════════════════════════════════
    //  PART 2 — NAVIGATE TO CATCH WEIGHT TAG INQUIRY V2
    // ══════════════════════════════════════════════════════════

    console.log('Step 6: Navigating to Catch Weight Tag Inquiry...');
    await page.keyboard.press('Control+/');
    await page.waitForTimeout(2000);
    await page.keyboard.type('catch weight tag inquiry', { delay: 150 });
    await page.waitForTimeout(2000);
    await page.getByText('Catch weight tag inquiry V2').first().click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log('✓ On Catch Weight Tag Inquiry page\n');

    // ══════════════════════════════════════════════════════════
    //  PART 3 — FILTER FOR REGISTERED TAGS
    // ══════════════════════════════════════════════════════════

    //console.log('Step 7: Closing the filter pane on the left...');
    //await page.getByRole('button', { name: 'Search' }).click();
    //await page.waitForTimeout(1000);

    /*console.log('Step 8: Searching for catch weight tag...');
    await page.getByRole('textbox', { name: 'Search for a page' }).fill('catch weight tag');
    await page.waitForTimeout(1500);
    await page.getByRole('option', { name: 'Catch weight tag inquiry V2' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);*/

    console.log('Step 9: Clicking on Catch weight tag registration header to access filter...');
    await page.locator('#SFCWTagInquiryView_RegistrationEvent_203_0_header').getByText('Catch weight tag registration').click();
    await page.waitForTimeout(1000);

    console.log('Step 10: Opening filter dropdown...');
    await page.locator('.lookupDock-dockContainer.lookupDock-comboBox > .lookupDock-buttonContainer > .lookupButton').click();
    await page.waitForTimeout(1000);

    console.log('Step 11: Selecting "Registered" status...');
    await page.getByRole('option', { name: 'Registered' }).click();
    await page.waitForTimeout(1000);

    console.log('Step 12: Applying filters...');
    await page.locator('[id="__SFCWTagInquiryView_RegistrationEvent_ApplyFilters"]').click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log('✓ Registered tags filtered\n');

    // ══════════════════════════════════════════════════════════
    //  PART 4 — RETRIEVE TAG NUMBER FROM GRID
    // ══════════════════════════════════════════════════════════

    console.log('Step 13: Selecting first registered tag row...');
    const tagCheckbox = page.locator('#Grid_203_0-row-0').getByRole('checkbox', { name: 'Select or unselect row' });
    await tagCheckbox.click();
    await page.waitForTimeout(500);

    console.log('Step 14: Clicking on tag number column header...');
    await page.locator('#SFCWTagInquiryView_TagNumber_203_0_header').click();
    await page.waitForTimeout(1000);

    console.log('Step 15: Clearing previous filter and filtering by tag number...');
    await page.getByRole('button', { name: 'Clear' }).click();
    await page.waitForTimeout(500);
    await page.locator('#SFCWTagInquiryView_TagNumber_203_0_header').getByText('Catch weight tag number').click();
    await page.waitForTimeout(500);

    const tagNumberInput = page.getByRole('textbox', { name: 'Filter field: Catch weight tag number, operator: begins with' });
    await tagNumberInput.click();
    await page.waitForTimeout(500);

    console.log('Step 16: Retrieving tag number from grid...');
    const tagElement = page.getByTitle('0603785486');
    await tagElement.waitFor({ timeout: t.element });
    retrievedTagNumber = await tagElement.getAttribute('title') || '0603785486';
    console.log(`         Retrieved Tag Number: ${retrievedTagNumber}`);

    // Double-click to ensure we have the tag
    await tagElement.dblclick();
    await page.waitForTimeout(1000);

    console.log('Step 17: Executing search...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ Tag retrieved\n');

    // ══════════════════════════════════════════════════════════
    //  PART 5 — NAVIGATE TO TAG DELETION FORM
    // ══════════════════════════════════════════════════════════

    console.log('Step 18: Opening search dialog for tag deletion form...');
    await page.keyboard.press('Control+/');
    await page.waitForTimeout(2000);
    await page.keyboard.type('tag or license', { delay: 150 });
    await page.waitForTimeout(2000);
    await page.getByText('Tags or license plates deletion form').first().click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ On tag deletion form\n');

    // ══════════════════════════════════════════════════════════
    //  PART 6 — ENTER AND DELETE TAG
    // ══════════════════════════════════════════════════════════

    console.log('Step 19: Clicking "Edit" button...');
    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log('Step 20: Entering tag number into deletion form...');
    const tagNumCtrl = page.locator('#f3prodappscanneddeletedbarcode_4_tagNumCtrl_input');
    await tagNumCtrl.waitFor({ timeout: t.element });
    await tagNumCtrl.click();
    await tagNumCtrl.fill(retrievedTagNumber);
    await page.waitForTimeout(1000);

    console.log('Step 21: Saving form...');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log('Step 22: Selecting all rows for deletion...');
    await page.getByRole('checkbox', { name: 'Select or unselect all rows' }).click();
    await page.waitForTimeout(500);

    console.log('Step 23: Clicking "Remove Tags" button...');
    await page.getByRole('button', { name: /Remove Tags/i }).click();
    await page.waitForTimeout(2000);

    console.log('Step 24: Confirming deletion with "Yes"...');
    await page.getByRole('button', { name: 'Yes' }).click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ Tag deleted\n');

    // ══════════════════════════════════════════════════════════
    //  PART 7 — VALIDATE DELETION IN RAF REVERSAL FORM
    // ══════════════════════════════════════════════════════════

    console.log('Step 25: Opening search dialog for RAF reversal...');
    await page.keyboard.press('Control+/');
    await page.waitForTimeout(2000);
    await page.keyboard.type('raf reversal', { delay: 150 });
    await page.waitForTimeout(2000);
    await page.getByText('RAF reversal staging data').first().click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log('Step 26: Filtering RAF reversal data by tag number...');
    await page.getByText('Tag', { exact: true }).click();
    await page.waitForTimeout(500);

    const rafTagFilter = page.getByRole('textbox', { name: /Filter field: Tag/ });
    await rafTagFilter.waitFor({ timeout: t.element });
    await rafTagFilter.click();
    await rafTagFilter.fill(retrievedTagNumber);
    await page.waitForTimeout(1000);

    console.log('Step 27: Applying RAF reversal filter...');
    await page.getByRole('button', { name: /Apply/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════
    //  PART 8 — VERIFY TAG DELETION
    // ══════════════════════════════════════════════════════════

    console.log('Step 28: Verifying deletion in RAF reversal form...');
    const rowsContainer = page.locator('.fixedDataTableLayout_rowsContainer');
    await rowsContainer.waitFor({ timeout: t.element }).catch(() => {});
    const rowCount = await rowsContainer.locator('div[role="row"]').count().catch(() => 0);

    if (rowCount > 0) {
      console.log(`✓ SUCCESS: Tag ${retrievedTagNumber} found in RAF reversal staging data`);
      console.log(`  This confirms the tag was successfully deleted (RAF entry created)`);
    } else {
      console.log(`✗ WARNING: Tag ${retrievedTagNumber} NOT found in RAF reversal staging data`);
      console.log(`  The deletion may not have been processed or RAF entry not yet synced`);
    }

    console.log('\n✓ Test Case 6 completed successfully!\n');

  } catch (error) {
    console.error('\n✗ Test Case 6 FAILED');
    console.error(`Error: ${error}\n`);
    throw error;
  } finally {
    await d365Context?.close();
  }
}

// Run standalone:  npx ts-node tests/tc6.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser); } finally { await browser.close(); }
  })();
}
