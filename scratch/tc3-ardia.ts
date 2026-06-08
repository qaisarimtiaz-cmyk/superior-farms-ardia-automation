// ============================================================
//  tests/tc3-ardia-only.ts
//  Standalone Ardia filter panel test — no D365 involved.
//
//  Use this to verify Ardia dropdown selections in isolation
//  before running the full TC3 end-to-end script.
//
//  Requires: auth.json in the project root (from a previous
//  Ardia login session). If auth.json is missing or stale,
//  the script falls back to a fresh login using config credentials.
//
//  Run with:
//  npx ts-node tests/tc3-ardia-only.ts
// ============================================================

import { chromium } from 'playwright';
import { config }   from '../config';
import { testData } from '../test-data';

const data = testData.TC03;
const t    = config.timeouts;

// ── Paste a real batch order ID here to test tile selection ─
// Leave empty to skip the tile + producing steps
const TEST_BATCH_ORDER_ID = '';

(async () => {

  console.log('Starting TC3 Ardia-Only Test\n');
  // Full display text as it appears in the Ardia dropdown list.
  // data.site / data.warehouse hold the short codes used elsewhere
  // (D365 form fields) — the dropdown shows the long label instead.
  const siteDisplayText      = '17 - Grove - IL Pro of Illinois';
  const warehouseDisplayText = 'Grove - Stock (17001)';

  console.log('Test Data:');
  console.log(`  Process:   Hangback`);
  console.log(`  Printer:   ${data.printer}`);
  console.log(`  Site:      ${siteDisplayText}`);
  console.log(`  Warehouse: ${warehouseDisplayText}`);
  console.log(`  Location:  ${data.location}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo:   500,
    args: ['--ignore-certificate-errors'],
  });

  // ── Try to reuse saved auth session, fall back to fresh login ──
  let ardiaContext: any;
  const fs = require('fs');
  const authExists = fs.existsSync('auth.json');

  if (authExists) {
    console.log('Using saved auth.json session...');
    ardiaContext = await browser.newContext({
      viewport:          { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      storageState:      'auth.json',
    });
  } else {
    console.log('No auth.json found — will do fresh login...');
    ardiaContext = await browser.newContext({
      viewport:          { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });
  }

  const ardiaPage = await ardiaContext.newPage();
  ardiaPage.setDefaultTimeout(t.element);

  try {

    // ══════════════════════════════════════════════════════════
    //  STEP 1 — NAVIGATE DIRECTLY TO ARDIA FILTER PANEL
    // ══════════════════════════════════════════════════════════

    console.log('Step 1: Navigating directly to Ardia batch-filters...');
    await ardiaPage.goto(`${config.ardia.url}/panel/batch-filters`, {
      waitUntil: 'domcontentloaded',
      timeout:   t.navigation,
    });

    // Handle self-signed cert warning if present
    const advancedButton = ardiaPage.getByRole('button', { name: 'Advanced' });
    const certWarning = await advancedButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (certWarning) {
      console.log('         Certificate warning — accepting...');
      await advancedButton.click();
      await ardiaPage.getByRole('link', { name: /proceed|continue/i }).click();
      await ardiaPage.waitForLoadState('domcontentloaded', { timeout: t.navigation });
    }

    await ardiaPage.waitForTimeout(2000);

    // ── If not logged in, auth.json was stale — do fresh login ──
    const needsLogin = await ardiaPage.locator('button.btn.btn-primary').isVisible({ timeout: 5000 }).catch(() => false);
    if (needsLogin) {
      console.log('Session expired or missing — logging in fresh...');
      await ardiaPage.locator('button.btn.btn-primary').click();
      await ardiaPage.waitForTimeout(2000);

      await ardiaPage.getByRole('textbox', { name: 'Enter your email, phone, or' }).waitFor({ timeout: t.login });
      await ardiaPage.getByRole('textbox', { name: 'Enter your email, phone, or' }).fill(config.ardia.username);
      await ardiaPage.getByRole('button', { name: 'Next' }).click();

      await ardiaPage.getByRole('textbox', { name: 'Enter the password for' }).waitFor({ timeout: t.login });
      await ardiaPage.getByRole('textbox', { name: 'Enter the password for' }).fill(config.ardia.password);
      await ardiaPage.getByRole('button', { name: 'Sign in' }).click();

      const mfaVisible = await ardiaPage.getByRole('heading', { name: 'Approve sign in request' }).isVisible({ timeout: 15000 }).catch(() => false);
      if (mfaVisible) {
        console.log('         MFA — approve on authenticator app...');
        await ardiaPage.getByRole('button', { name: 'Yes' }).click();
      }
      await ardiaPage.getByRole('button', { name: 'Yes' }).click().catch(() => {});

      await ardiaPage.waitForURL('**/10.164.2.92**', { timeout: t.dashboard }).catch(() => {});
      await ardiaPage.waitForLoadState('networkidle', { timeout: t.dashboard });
      await ardiaPage.waitForTimeout(3000);
      console.log('✓ Logged in\n');
    } else {
      console.log('✓ Session active — already on filter panel\n');
    }

    // ══════════════════════════════════════════════════════════
    //  STEP 2 — WAIT FOR FILTER PANEL
    // ══════════════════════════════════════════════════════════

    console.log('Step 2: Waiting for filter panel to render...');
    await ardiaPage.getByText('Select Process').waitFor({ timeout: t.element });
    await ardiaPage.waitForTimeout(1000);
    console.log('✓ Filter panel ready\n');

    // ══════════════════════════════════════════════════════════
    //  STEP 3 — SELECT PROCESS
    // ══════════════════════════════════════════════════════════

    console.log('Step 3: Selecting Process = "Hangback"...');
    await ardiaPage.locator(
      'xpath=/html/body/app-root/app-batch-filters/main/div/div[2]/div/div[1]/app-input-grid-select/div/textarea'
    ).click();
    await ardiaPage.waitForTimeout(800);
    await scrollDropdownUntilFound(ardiaPage, 'Hangback');
    await ardiaPage.getByText('Hangback', { exact: true }).click();
    await ardiaPage.waitForTimeout(800);
    console.log('✓ Process selected: Hangback\n');

    // ══════════════════════════════════════════════════════════
    //  STEP 4 — SELECT PRINTER
    // ══════════════════════════════════════════════════════════

    console.log(`Step 4: Selecting Printer = "${data.printer}"...`);
    await ardiaPage.locator('div.col-5 > div > div:nth-of-type(2) textarea').click();
    await ardiaPage.waitForTimeout(800);
    await scrollDropdownUntilFound(ardiaPage, data.printer);
    await ardiaPage.getByText(data.printer, { exact: true }).click();
    await ardiaPage.waitForTimeout(800);
    console.log(`✓ Printer selected: ${data.printer}\n`);

    // ══════════════════════════════════════════════════════════
    //  STEP 5 — SELECT SITE
    // ══════════════════════════════════════════════════════════

    console.log(`Step 5: Selecting Site = "${siteDisplayText}"...`);
    await ardiaPage.locator(
      'xpath=//div[position()=1]/div[position()=3]/app-input-grid-select[position()=1]/div[position()=1]/textarea[position()=1]'
    ).click();
    await ardiaPage.waitForTimeout(800);
    await scrollDropdownUntilFound(ardiaPage, siteDisplayText);
    await ardiaPage.getByText(siteDisplayText, { exact: true }).click();
    await ardiaPage.waitForTimeout(1500);
    console.log(`✓ Site selected: ${siteDisplayText}\n`);

    // ══════════════════════════════════════════════════════════
    //  STEP 6 — WAIT FOR WAREHOUSE TO ENABLE THEN SELECT
    // ══════════════════════════════════════════════════════════

    console.log('Step 6: Waiting for Warehouse dropdown to become enabled...');
    const warehouseTextarea = ardiaPage.locator(
      'xpath=//div[position()=1]/div[position()=4]/app-input-grid-select[position()=1]/div[position()=1]/textarea[position()=1]'
    );
    await warehouseTextarea.waitFor({ state: 'visible', timeout: t.element });
    await ardiaPage.waitForFunction(
      (sel: string) => {
        const result = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const el = result.singleNodeValue as HTMLTextAreaElement | null;
        return el ? !el.disabled : false;
      },
      '//div[position()=1]/div[position()=4]/app-input-grid-select[position()=1]/div[position()=1]/textarea[position()=1]',
      { timeout: t.element }
    );
    console.log('         ✓ Warehouse enabled');

    console.log(`         Selecting Warehouse = "${warehouseDisplayText}"...`);
    await warehouseTextarea.click();
    await ardiaPage.waitForTimeout(800);
    await scrollDropdownUntilFound(ardiaPage, warehouseDisplayText);
    await ardiaPage.getByText(warehouseDisplayText, { exact: true }).click();
    await ardiaPage.waitForTimeout(1500);
    console.log(`✓ Warehouse selected: ${warehouseDisplayText}\n`);

    // ══════════════════════════════════════════════════════════
    //  STEP 7 — SELECT LOCATION
    // ══════════════════════════════════════════════════════════

    console.log(`Step 7: Selecting Location = "${data.location}"...`);
    await ardiaPage.locator(
      'xpath=//div[position()=1]/div[position()=5]/app-input-grid-select[position()=1]/div[position()=1]/textarea[position()=1]'
    ).click();
    await ardiaPage.waitForTimeout(800);
    await scrollDropdownUntilFound(ardiaPage, data.location);
    await ardiaPage.getByText(data.location, { exact: true }).click();
    await ardiaPage.waitForTimeout(800);
    console.log(`✓ Location selected: ${data.location}\n`);

    await ardiaPage.screenshot({ path: 'screenshot-ardia-only-filters.png' });
    console.log('📸 Screenshot saved: screenshot-ardia-only-filters.png\n');

    // ══════════════════════════════════════════════════════════
    //  STEP 8 — VERIFY PROCEED IS ENABLED
    // ══════════════════════════════════════════════════════════

    console.log('Step 8: Checking Proceed button is enabled...');
    const proceedButton = ardiaPage.getByRole('button', { name: 'Proceed' });
    await proceedButton.waitFor({ timeout: t.element });
    const isEnabled = await proceedButton.isEnabled();

    if (!isEnabled) {
      throw new Error('Proceed button is still disabled — one or more dropdowns did not register correctly');
    }
    console.log('✓ Proceed button is enabled\n');

    // ══════════════════════════════════════════════════════════
    //  STEP 9 — CLICK PROCEED (optional — only if batch ID set)
    // ══════════════════════════════════════════════════════════

    if (TEST_BATCH_ORDER_ID) {
      console.log('Step 9: Clicking Proceed...');
      await proceedButton.click();
      await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation });
      await ardiaPage.waitForTimeout(3000);
      console.log('✓ On Batch Orders page\n');

      console.log(`Step 10: Finding tile for ${TEST_BATCH_ORDER_ID}...`);
      const orderTile = ardiaPage.getByText(new RegExp(TEST_BATCH_ORDER_ID, 'i'));
      await orderTile.waitFor({ timeout: t.element });
      await orderTile.scrollIntoViewIfNeeded();
      await orderTile.click();
      await ardiaPage.waitForTimeout(2000);
      console.log('✓ Tile clicked\n');
    } else {
      console.log('Step 9: Proceed skipped — TEST_BATCH_ORDER_ID not set');
      console.log('         Set TEST_BATCH_ORDER_ID at the top of this file to test beyond filters.\n');
    }

    console.log('✅ Ardia filter panel test PASSED');
    console.log(`   Process:   Hangback`);
    console.log(`   Printer:   ${data.printer}`);
    console.log(`   Site:      ${siteDisplayText}`);
    console.log(`   Warehouse: ${warehouseDisplayText}`);
    console.log(`   Location:  ${data.location}`);
    console.log(`   Proceed:   ${isEnabled ? 'Enabled ✓' : 'Disabled ✗'}\n`);

  } catch (err: any) {
    console.error(`\n❌ Ardia-only test FAILED: ${err.message}`);
    await ardiaPage.screenshot({ path: 'screenshot-ardia-only-error.png' }).catch(() => {});
    console.log('   Error screenshot: screenshot-ardia-only-error.png');
  } finally {
    await ardiaContext.close();
    await browser.close();
  }

})();


// ============================================================
//  Helper: scrollDropdownUntilFound
//
//  Ardia dropdowns are plain div-grid lists rendered inside
//  app-input-grid-select > div:nth-child(2). They are NOT
//  virtual scroll viewports or ng-dropdown-panels — those
//  selectors match nothing and scroll the wrong container.
//
//  Root cause of warehouse not scrolling in TC3:
//  - The old locator used .last() on a selector that never
//    matched the Ardia div-grid list, so scrollBy() was
//    called on the wrong element (or nothing), returning true
//    and suppressing the ArrowDown fallback.
//
//  Fix:
//  1. Target app-input-grid-select > div:nth-child(2) — the
//     actual container Ardia renders option rows into.
//  2. Use scrollTop (not scrollBy) which is more reliable for
//     div containers that use overflow:auto/scroll.
//  3. Log every 10 attempts so scroll progress is visible.
// ============================================================
async function scrollDropdownUntilFound(page: any, optionText: string): Promise<void> {
  // Give the dropdown animation time to fully open
  await page.waitForTimeout(500);

  let scrollAttempts = 0;

  // Target the open dropdown list container.
  // Ardia renders options as div rows inside the 2nd child div
  // of each app-input-grid-select. Only one is open at a time.
  const openDropdown = page.locator('app-input-grid-select > div:nth-child(2)').last();

  while (true) {
    // Check if the target option is already visible
    const option = page.getByText(optionText, { exact: true });
    const isVisible = await option.isVisible({ timeout: 400 }).catch(() => false);

    if (isVisible) {
      console.log(`         Found "${optionText}" after ${scrollAttempts} scroll(s)`);
      return;
    }

    // Scroll the open dropdown container using scrollTop
    const scrolled = await openDropdown.evaluate((el: Element) => {
      const scrollEl = el as HTMLElement;
      if (!scrollEl) return false;
      scrollEl.scrollTop += 150;
      return true;
    }).catch(() => false);

    if (!scrolled) {
      // Fallback: keyboard ArrowDown if container not found
      await page.keyboard.press('ArrowDown');
      console.log(`         scroll attempt ${scrollAttempts + 1} — ArrowDown fallback`);
    }

    await page.waitForTimeout(200);
    scrollAttempts++;

    // Progress log every 10 scrolls
    if (scrollAttempts % 10 === 0) {
      console.log(`         ... still scrolling for "${optionText}" (${scrollAttempts} attempts)`);
    }
  }
}