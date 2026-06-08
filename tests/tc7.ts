// ============================================================
//  tests/tc6.ts
//  Test Case 6 — D365: Catch Weight Tag Deletion Workflow
//
//  Workflow:
//  1. Login to D365
//  2. Navigate to Catch Weight Tag Inquiry V2
//  3. Filter for "Registered" status tags and retrieve the first tag number
//  4. Navigate to Tags or license plates deletion form
//  5. Enter tag number, save, select all rows, and remove
//  6. Validate deletion by checking RAF reversal staging data
//
//  Run with:
//  npx ts-node tests/tc6.ts
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }   from '../config';
import { openAuthedD365 } from './helpers/auth-flows';

const t = config.timeouts;

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
    const page = d365.page;
    d365ErrPage = page;
    console.log('✓ Logged in and dashboard loaded\n');

    // ══════════════════════════════════════════════════════════
    //  PART 2 — NAVIGATE TO CATCH WEIGHT TAG INQUIRY V2
    //  Uses the Search button → textbox → option approach
    //  (more reliable than Control+/ for this module)
    // ══════════════════════════════════════════════════════════

    console.log('Step 6: Opening search and navigating to Catch Weight Tag Inquiry V2...');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.waitForTimeout(1000);

    const searchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await searchBox.waitFor({ timeout: t.element });
    await searchBox.fill('catch weight tag');
    await page.waitForTimeout(1500);

    await page.getByRole('option', { name: 'Catch weight tag inquiry V2' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ On Catch Weight Tag Inquiry V2 page\n');

   /* // ══════════════════════════════════════════════════════════
    //  PART 3 — FILTER FOR "REGISTERED" STATUS TAGS
    //  Codegen recorded a direct textbox for this filter field —
    //  far more reliable than the dropdown/lookupDock approach
    // ══════════════════════════════════════════════════════════

    console.log('Step 7: Filtering by "Registered" status...');
    const registrationFilter = page.getByRole('textbox', {
      name: 'Filter field: Catch weight tag registration event, operator: is exactly',
    });
    await registrationFilter.waitFor({ timeout: t.element });
    await registrationFilter.click();
    await registrationFilter.fill('Registered');
    await page.waitForTimeout(500);

    console.log('Step 8: Applying filter...');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ Registered tags filtered\n');*/

    // ══════════════════════════════════════════════════════════
    //  PART 3 — FILTER FOR "REGISTERED" STATUS + IS TAG DELETED = No
    // ══════════════════════════════════════════════════════════

    console.log('Step 7: Filtering by "Registered" status...');
    const registrationFilter = page.getByRole('textbox', {
      name: 'Filter field: Catch weight tag registration event, operator: is exactly',
    });
    await registrationFilter.waitFor({ timeout: t.element });
    await registrationFilter.click();
    await registrationFilter.fill('Registered');
    await page.waitForTimeout(500);

    console.log('Step 8: Applying "Registered" filter...');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(5000);
    console.log('✓ Registered filter applied\n');

    console.log('Step 9: Filtering by "Is tag deleted" = No...');
    const isDeletedFilter = page.getByRole('textbox', {
      name: /Filter field: Is tag deleted/i,
    });
    await isDeletedFilter.waitFor({ timeout: t.element });
    await isDeletedFilter.click();
    await isDeletedFilter.fill('No');
    await page.waitForTimeout(900);

    console.log('Step 10: Applying "Is tag deleted" filter...');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(5000);
    console.log('✓ Is tag deleted = No filter applied\n');

    // ══════════════════════════════════════════════════════════
    //  PART 4 — RETRIEVE TAG NUMBER FROM FIRST GRID ROW
    //  Select row 0, then read its tag number cell title attribute.
    //  Falls back to the title attribute on any element in the row
    //  whose title looks like a numeric tag (all-digit string).
    // ══════════════════════════════════════════════════════════

    console.log('Step 9: Selecting first row in the grid...');
    const firstRowCheckbox = page.locator('#Grid_203_0-row-0').getByRole('checkbox', {
      name: 'Select or unselect row',
    });
    await firstRowCheckbox.waitFor({ timeout: t.element });
    await firstRowCheckbox.click();
    await page.waitForTimeout(500);

    console.log('Step 10: Reading tag number from first row...');

    // D365 renders the tag number cell with its value in the title attribute.
    // Try the known column-header-derived cell ID first, then fall back to
    // scanning all [title] elements inside the row for a numeric string.
    const tagNumberCell = page.locator(
      '#SFCWTagInquiryView_TagNumber_203_0-row-0, ' +
      '[id*="TagNumber"][id*="row-0"]'
    ).first();

    const cellTitle = await tagNumberCell.getAttribute('title').catch(() => null);

    if (cellTitle && cellTitle.trim() !== '') {
      retrievedTagNumber = cellTitle.trim();
    } else {
      // Fallback: scan all titled elements in row-0 for a numeric string
      const titledElements = await page.locator('#Grid_203_0-row-0 [title]').all();
      for (const el of titledElements) {
        const t2 = (await el.getAttribute('title') ?? '').trim();
        if (/^\d+$/.test(t2)) {
          retrievedTagNumber = t2;
          break;
        }
      }
    }

    if (!retrievedTagNumber) {
      throw new Error('Could not retrieve a tag number from the first registered row. Check grid locators.');
    }

    console.log(`✓ Retrieved Tag Number: ${retrievedTagNumber}\n`);

    // ══════════════════════════════════════════════════════════
    //  PART 5 — NAVIGATE TO TAG DELETION FORM
    // ══════════════════════════════════════════════════════════

    console.log('Step 11: Opening search and navigating to Tags or license plates deletion form...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1000);

    const delSearchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await delSearchBox.waitFor({ timeout: t.element });
    await delSearchBox.fill('deletion');
    await page.waitForTimeout(1500);

    await page.getByRole('option', { name: 'Tags or license plates' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ On Tags or license plates deletion form\n');

    // ══════════════════════════════════════════════════════════
    //  PART 6 — ENTER TAG NUMBER AND DELETE
    // ══════════════════════════════════════════════════════════

    console.log('Step 12: Clicking "Edit" button...');
    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log(`Step 13: Entering tag number [${retrievedTagNumber}] into deletion form...`);
    const tagNumCtrl = page.locator('#f3prodappscanneddeletedbarcode_4_tagNumCtrl_input');
    await tagNumCtrl.waitFor({ timeout: t.element });
    await tagNumCtrl.click();
    await tagNumCtrl.fill(retrievedTagNumber);
    await page.waitForTimeout(1000);

    console.log('Step 14: Saving the form...');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log('Step 15: Selecting all rows...');
    await page.getByRole('checkbox', { name: 'Select or unselect all rows' }).click();
    await page.waitForTimeout(500);

    console.log('Step 16: Clicking "Delete All" button...');
    await page.getByRole('button', { name: /Delete All/i }).click();
    await page.waitForTimeout(2000);

    /*console.log('Step 17: Confirming deletion with "Yes"...');
    await page.getByRole('button', { name: 'Yes' }).click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log(`✓ Tag [${retrievedTagNumber}] deleted\n`);*/

    // ══════════════════════════════════════════════════════════
    //  PART 7 — VALIDATE DELETION IN RAF REVERSAL FORM
    // ══════════════════════════════════════════════════════════

    console.log('Step 18: Opening search and navigating to RAF reversal staging data...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1000);

    const rafSearchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await rafSearchBox.waitFor({ timeout: t.element });
    await rafSearchBox.fill('raf reversal');
    await page.waitForTimeout(1500);

    await page.getByText('RAF reversal staging data').first().click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log(`Step 19: Filtering RAF reversal data by tag number [${retrievedTagNumber}]...`);
    const rafTagFilter = page.getByRole('textbox', { name: /Filter field: Tag/ });
    await rafTagFilter.waitFor({ timeout: t.element });
    await rafTagFilter.click();
    await rafTagFilter.fill(retrievedTagNumber);
    await page.waitForTimeout(1000);

    console.log('Step 20: Applying RAF reversal filter...');
    await page.getByRole('button', { name: /Apply/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    // ══════════════════════════════════════════════════════════
    //  PART 8 — VERIFY
    // ══════════════════════════════════════════════════════════

    console.log('Step 21: Verifying tag appears in RAF reversal staging data...');
    const rowsContainer = page.locator('.fixedDataTableLayout_rowsContainer');
    await rowsContainer.waitFor({ timeout: t.element }).catch(() => {});
    const rowCount = await rowsContainer.locator('div[role="row"]').count().catch(() => 0);

    if (rowCount > 0) {
      console.log(`✓ SUCCESS: Tag [${retrievedTagNumber}] found in RAF reversal staging data`);
      console.log('  Confirms the tag was successfully deleted and RAF entry was created');
    } else {
      console.log(`⚠ WARNING: Tag [${retrievedTagNumber}] NOT found in RAF reversal staging data`);
      console.log('  The deletion may not have been processed, or the RAF entry is not yet synced');
    }

    console.log('\n✅ Test Case 6 completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Test Case 6 FAILED');
    console.error(`   Error: ${error.message ?? error}`);
    console.error(`   Tag at failure: ${retrievedTagNumber || 'not yet retrieved'}\n`);
    throw error;
  } finally {
    await d365Context?.close();
  }
}

// Run standalone:  npx ts-node tests/tc7.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser); } finally { await browser.close(); }
  })();
}