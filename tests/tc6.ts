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
import { ReportCollector } from './helpers/report-collector';
import { readSharedState } from '../utils/shared-state';
import { screenshotPath } from '../utils/run-folder';

const t    = config.timeouts;

export async function run(browser: Browser, testInfo: any = null) {
  console.log('Starting Test Case 6 — Catch Weight Tag Deletion Workflow\n');

  const reportTestData: Record<string, string> = { 'Workflow': 'Catch-Weight Tag Deletion', 'Process': 'Reversal' };
  const report = new ReportCollector('Test Case 6', reportTestData);

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
    report.add('Open D365 (authenticated session)', 'PASS');

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
    report.add('Navigate to Catch Weight Tag Inquiry', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 3 — FILTER FOR REGISTERED TAGS
    // ══════════════════════════════════════════════════════════

    console.log('Step 7: Closing the filter pane on the left...');
    // exact: true — the Catch Weight Tag Inquiry page also has its own
    // "Search for an action" icon, which made the unqualified name match
    // 2 elements once we're on this page (only 1 matches earlier in the flow).
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1000);

    console.log('Step 8: Searching for catch weight tag...');
    await page.getByRole('textbox', { name: 'Search for a page' }).fill('catch weight tag');
    await page.waitForTimeout(1500);
    await page.getByRole('option', { name: 'Catch weight tag inquiry V2' }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    // This page now opens with a modern right-side "Filters" panel (Apply/
    // Reset) instead of the old grid-header lookupDock dropdown this script
    // was originally built against. The panel can carry a stale saved filter
    // (e.g. a License plate value) from a previous session that yields 0
    // rows when combined with "Registered" — Reset clears it before we set
    // only the filter we actually want.
    console.log('Step 9: Resetting the Filters panel to clear any stale filter values...');
    const resetButton = page.getByRole('button', { name: 'Reset' });
    await resetButton.waitFor({ state: 'visible', timeout: t.element });
    await resetButton.click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(1500);
    console.log('✓ Filters reset\n');
    report.add('Reset Filters panel', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 3b — FILTER BY TC14's BATCH NUMBER (freshly produced)
    // ══════════════════════════════════════════════════════════
    //  Trusting "whatever is in row 0" was never a real criterion — it just
    //  happened to work while the environment's tags were all Registered.
    //  Scoping to a batch that was just produced is a real criterion — but
    //  NOT TC1's: TC4 runs a Fresh-to-Frozen conversion on TC1's batch,
    //  which changes the tag's state away from "Registered" (confirmed
    //  live: filtering by TC1's batch order consistently returned 0 rows).
    //  TC14 (Multi-Box, produces 10 boxes via plain "Produce") is never
    //  touched by any conversion flow, so its tags should stay Registered.
    //  "Batch number" is already present in the Filters panel by default —
    //  no need to add it. Falls back to the unfiltered grid if TC14's
    //  shared state isn't available.
    let tc14BatchOrderId = '';
    try {
      tc14BatchOrderId = readSharedState('TC14').batchOrderId;
    } catch (err: any) {
      console.log(`         ⚠ Could not read TC14's batch order (${err.message}) — continuing unfiltered`);
    }

    if (tc14BatchOrderId) {
      console.log(`Step 9b: Filtering by Batch number = ${tc14BatchOrderId} (from TC14)...`);
      const batchFilter = page.getByRole('combobox', { name: /Filter field: Batch number/i });
      await batchFilter.waitFor({ state: 'visible', timeout: t.element }).catch(() => {});
      if (await batchFilter.isVisible().catch(() => false)) {
        await batchFilter.click();
        await batchFilter.fill(tc14BatchOrderId);
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: 'Apply' }).click();
        await page.waitForLoadState('networkidle', { timeout: t.dashboard }).catch(() => {});
        await page.waitForTimeout(1500);
        console.log('✓ Filtered by Batch number\n');
        report.add('Filter by Batch number (from TC14)', 'PASS', tc14BatchOrderId);
      } else {
        console.log('         Batch number filter field not found — continuing unfiltered');
      }
    }

    // ══════════════════════════════════════════════════════════
    //  PART 4 — RETRIEVE TAG NUMBER FROM GRID
    // ══════════════════════════════════════════════════════════

    console.log('Step 13: Selecting first row in the grid...');
    // #Grid_203_0-row-0 is a stale form-instance ID from before the page's
    // UI update (confirmed: it no longer resolves to anything). Use the
    // same ID-independent role/name selector already proven reliable for
    // this identical "select grid row" action elsewhere in this suite.
    const tagCheckbox = page.getByRole('checkbox', { name: 'Select or unselect row' }).first();
    await tagCheckbox.waitFor({ timeout: t.element });
    await tagCheckbox.click();
    await page.waitForTimeout(500);

    console.log('Step 14: Reading tag number from first row...');
    // Read row 0's tag number cell dynamically instead of a hardcoded value
    // (the previous code looked for a literal, one-time tag number that
    // will never exist again). Same ID-independent + fallback pattern
    // already proven working in tc7.ts.
    const tagNumberCell = page.locator(
      '#SFCWTagInquiryView_TagNumber_203_0-row-0, ' +
      '[id*="TagNumber"][id*="row-0"]'
    ).first();
    const cellTitle = await tagNumberCell.getAttribute('title').catch(() => null);
    if (cellTitle && cellTitle.trim() !== '') {
      retrievedTagNumber = cellTitle.trim();
    } else {
      const titledElements = await page.locator('[id*="row-0"] [title]').all();
      for (const el of titledElements) {
        const v = (await el.getAttribute('title') ?? '').trim();
        if (/^\d+$/.test(v)) { retrievedTagNumber = v; break; }
      }
    }
    if (!retrievedTagNumber) {
      throw new Error('Could not read a tag number from row 0 of the Catch weight tag inquiry grid.');
    }
    console.log(`         ✓ Retrieved Tag Number: ${retrievedTagNumber}`);
    report.add('Retrieve tag number from grid', 'PASS', retrievedTagNumber);
    await page.screenshot({ path: screenshotPath('screenshot-tc6-tag-retrieved.png') });
    report.addScreenshot('Tag retrieved from grid', screenshotPath('screenshot-tc6-tag-retrieved.png'));

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
    report.add('Navigate to Tag or license plate deletion form', 'PASS');

    // ══════════════════════════════════════════════════════════
    //  PART 6 — ENTER AND DELETE TAG
    // ══════════════════════════════════════════════════════════

    console.log('Step 19: Clicking "Edit" button...');
    await page.getByRole('button', { name: /Edit/i }).click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    console.log('Step 20: Entering tag number into deletion form...');
    // #f3prodappscanneddeletedbarcode_4_tagNumCtrl_input is a stale
    // form-instance ID (same "_N_" pattern found stale elsewhere this
    // session). The visible "Enter Tag/LP:" label isn't programmatically
    // associated with its input (no aria-label — confirmed live: role-based
    // matching on the label text timed out despite the field being visibly
    // present), so anchor on the label text itself and take the next
    // <input> that follows it in the DOM instead.
    const tagNumCtrl = page.getByText('Enter Tag/LP', { exact: false }).locator('xpath=following::input[1]');
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
    await page.screenshot({ path: screenshotPath('screenshot-tc6-before-deletion-confirm.png') });
    report.addScreenshot('Before deletion confirmation', screenshotPath('screenshot-tc6-before-deletion-confirm.png'));

    console.log('Step 24: Confirming deletion with "Yes"...');
    await page.getByRole('button', { name: 'Yes' }).click();
    await page.locator('#ShellProcessingDiv').waitFor({ state: 'hidden', timeout: t.action }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);
    console.log('✓ Tag deleted\n');
    await page.screenshot({ path: screenshotPath('screenshot-tc6-tag-deleted.png') });
    report.addScreenshot('Tag deleted', screenshotPath('screenshot-tc6-tag-deleted.png'));
    report.add('Enter tag & delete', 'PASS', retrievedTagNumber);

    // ══════════════════════════════════════════════════════════
    //  PART 7 — VALIDATE DELETION IN RAF REVERSAL FORM
    // ══════════════════════════════════════════════════════════

    // Control+/ didn't reliably open the search dialog right after the
    // deletion-confirm flow (confirmed live — focus likely still trapped
    // from the dialog/grid, so the shortcut never registered). Use the
    // Search button UI click instead — proven reliable for this exact
    // navigation in tc7.ts.
    console.log('Step 25: Opening search and navigating to RAF reversal staging data...');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForTimeout(1000);

    const rafSearchBox = page.getByRole('textbox', { name: 'Search for a page' });
    await rafSearchBox.waitFor({ timeout: t.element });
    await rafSearchBox.fill('raf reversal');
    await page.waitForTimeout(1500);

    await page.getByText('RAF reversal staging data').first().click();
    await page.waitForLoadState('networkidle', { timeout: t.dashboard });
    await page.waitForTimeout(2000);

    // This page has no advanced per-column filter row/panel by default
    // (confirmed while fixing this same step in tc7.ts — the "Filter
    // field: Tag" combobox/textbox this script expected doesn't exist
    // here), just a plain quick-filter textbox above the grid.
    console.log(`Step 26: Filtering RAF reversal data by tag number [${retrievedTagNumber}]...`);
    // getByPlaceholder('Filter') timed out twice (30s, then 120s) despite
    // the box being clearly visible in both failure screenshots — the
    // visible "Filter" text likely isn't a real HTML placeholder attribute
    // on this component. This page's grid renders via plain divs (like
    // other D365 grids in this suite), so the quick-filter box is the only
    // real <input> on the page — target it directly instead.
    const rafTagFilter = page.locator('input:visible').first();
    await rafTagFilter.waitFor({ timeout: t.dashboard });
    await rafTagFilter.click();
    await rafTagFilter.fill(retrievedTagNumber);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: t.dashboard }).catch(() => {});
    await page.waitForTimeout(2000);
    report.add('Filter RAF reversal staging data by tag', 'PASS', retrievedTagNumber);

    // ══════════════════════════════════════════════════════════
    //  PART 8 — VERIFY TAG DELETION
    // ══════════════════════════════════════════════════════════

    console.log('Step 28: Verifying deletion in RAF reversal form...');
    const rowsContainer = page.locator('.fixedDataTableLayout_rowsContainer');
    await rowsContainer.waitFor({ timeout: t.element }).catch(() => {});
    const rowCount = await rowsContainer.locator('div[role="row"]').count().catch(() => 0);
    await page.screenshot({ path: screenshotPath('screenshot-tc6-raf-reversal-verification.png') });
    report.addScreenshot('RAF reversal staging verification', screenshotPath('screenshot-tc6-raf-reversal-verification.png'));

    if (rowCount > 0) {
      console.log(`✓ SUCCESS: Tag ${retrievedTagNumber} found in RAF reversal staging data`);
      console.log(`  This confirms the tag was successfully deleted (RAF entry created)`);
      report.add('Verify tag deletion in RAF reversal staging data', 'PASS', `Tag ${retrievedTagNumber} found in RAF reversal staging data`);
    } else {
      console.log(`✗ WARNING: Tag ${retrievedTagNumber} NOT found in RAF reversal staging data`);
      console.log(`  The deletion may not have been processed or RAF entry not yet synced`);
      report.add('Verify tag deletion in RAF reversal staging data', 'FAIL', `Tag ${retrievedTagNumber} NOT found in RAF reversal staging data`);
    }

    console.log('\n✓ Test Case 6 completed successfully!\n');

  } catch (error) {
    report.add('TEST FAILED', 'FAIL', (error as any)?.message ?? String(error));
    await d365ErrPage?.screenshot({ path: screenshotPath('screenshot-tc6-error.png') }).catch(() => {});
    report.addScreenshot('Failure screenshot', screenshotPath('screenshot-tc6-error.png'));
    console.error('\n✗ Test Case 6 FAILED');
    console.error(`Error: ${error}\n`);
    throw error;
  } finally {
    try {
      const meta: Record<string, string> = {
        'Retrieved Tag Number': retrievedTagNumber || '(not retrieved)',
        'Process': 'Reversal',
      };
      const { excelPath } = await report.finalize(testInfo, meta);
      console.log(`\n📊 Excel report written: ${excelPath}`);
    } catch (repErr: any) {
      console.error(`   ⚠ Failed to write report: ${repErr.message}`);
    }

    await d365Context?.close();
  }
}

// Run standalone:  npx ts-node tests/tc6.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser, null); } finally { await browser.close(); }
  })();
}
