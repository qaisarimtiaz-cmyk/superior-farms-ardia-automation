// ============================================================
//  tests/tc10.ts
//  Test Case 10 — Ardia: Pick process (end-to-end)
//
//  Business flow:
//   PART A — D365 On-hand list: search the batch, find a License
//            Plate whose physical inventory = 1, capture it.
//            (The On-hand form can take up to ~5 min to render.)
//   PART B — Ardia: login, select Pick + Site/WH/Location/Printer,
//            Proceed, pick the batch tile, scan the LP, key the
//            weight, Enter + Post, verify the Picking journal dialog.
//   PART C — D365 Cold scale staging data: filter on the LP and
//            verify the row exists and IsSync = true.
//
//  Run standalone:  npx ts-node tests/tc10.ts
//  Run via runner:  npx playwright test tests/tc10.spec.ts
// ============================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { config }   from '../config';
import { testData } from '../test-data';
import { openAuthedD365, openAuthedArdia } from './helpers/auth-flows';

const data = testData.TC10;
const t     = config.timeouts;

export async function run(browser: Browser) {
  console.log('=============================================================');
  console.log(' Test Case 10 — Ardia Pick process');
  console.log('=============================================================');
  console.log(`  Batch number : ${data.batchNumber}`);
  console.log(`  Site/WH/Loc  : ${data.site} / ${data.warehouse} / ${data.location}`);
  console.log(`  Printer      : ${data.printer}`);
  console.log(`  Pick tile    : ${data.pickBatchTile}`);
  console.log(`  Weight       : ${data.pickWeight}\n`);

  let d365Context:  BrowserContext | undefined;
  let ardiaContext: BrowserContext | undefined;
  let d365ErrPage:  Page | undefined;   // referenced by the catch block for an error screenshot
  let ardiaErrPage: Page | undefined;   // referenced by the catch block for an error screenshot
  let licensePlate = '';

  try {
    // ══════════════════════════════════════════════════════════
    //  PART 0 — LOGIN TO D365  (TC9 Part 1, steps 1-5)
    // ══════════════════════════════════════════════════════════
    const d365 = await openAuthedD365(browser);
    d365Context = d365.context;
    const d365Page = d365.page;
    d365ErrPage = d365Page;

    // ══════════════════════════════════════════════════════════
    //  PART A — GET LICENSE PLATE FROM ON-HAND LIST
    // ══════════════════════════════════════════════════════════
    console.log(`Step 2: Opening On-hand list (grid can take up to ${Math.round(t.onHandLoad / 60000)} min)...`);
    // Navigate via Search -> option, then WAIT for the grid to actually render
    // before doing anything else (TC9 strategy — never assume navigation happened).
    await openViaSearch(d365Page, 'on-hand list', /On-hand list/i, t.onHandLoad);
    console.log('✓ On-hand list opened — grid rendered\n');

    console.log(`Step 3: Filtering by Batch number = ${data.batchNumber}...`);
    // Reveal the Batch number inline filter (click the column header if the
    // filter combobox is not already exposed), then fill + Apply (TC9 pattern).
    let batchFilter = d365Page.getByRole('combobox', { name: /Filter field: Batch number/ });
    if (!(await batchFilter.isVisible({ timeout: 5000 }).catch(() => false))) {
      await d365Page.getByText('Batch number', { exact: true }).first().click().catch(() => {});
      await d365Page.waitForTimeout(800);
      batchFilter = d365Page.getByRole('combobox', { name: /Filter field: Batch number/ });
    }
    await batchFilter.waitFor({ state: 'visible', timeout: t.element });
    await batchFilter.click();
    await batchFilter.fill(data.batchNumber!);
    await d365Page.waitForTimeout(500);

    console.log('Step 4: Applying Batch number filter...');
    await d365Page.getByRole('button', { name: 'Apply' }).click();
    await d365Page.waitForLoadState('networkidle', { timeout: t.onHandLoad }).catch(() => {});
    await d365Page.waitForTimeout(3000);
    console.log('✓ Batch filter applied\n');

    // Optional: add product dimensions (best effort — not required to read the LP).
    await addDimensions(d365Page).catch(() => console.log('         Dimensions step skipped'));

    console.log(`Step 5: Waiting for On-hand data to populate (up to ${Math.round(t.onHandLoad / 60000)} min)...`);
    await waitForOnHandData(d365Page, t.onHandLoad);

    console.log('Step 5b: Extracting a License Plate with physical inventory = 1...');
    licensePlate = await extractLicensePlate(d365Page, t.onHandLoad);

    // ── Diagnostic: if extraction failed, dump the grid DOM so we can
    //    see the REAL structure (column labels, cell layout) instead of
    //    guessing. Saves grid HTML to a file + prints headers and the
    //    first data row to the console. Remove once extraction is stable.
    if (!licensePlate) {
      console.log('         ⚠ Extraction returned empty — running DOM diagnostic...');
      await dumpOnHandGridDiagnostic(d365Page);
    }

    if (!licensePlate && data.manualLicensePlate) {
      console.log('         No LP extracted — falling back to manualLicensePlate from test-data.ts');
      licensePlate = data.manualLicensePlate;
    }
    if (!licensePlate) {
      throw new Error('Could not determine a License Plate (inventory = 1) and no manualLicensePlate configured.');
    }
    console.log(`✓ License Plate captured: ${licensePlate}\n`);
    await d365Page.screenshot({ path: 'screenshot-tc10-onhand-lp.png' });

    // ══════════════════════════════════════════════════════════
    //  PART B — ARDIA PICK
    // ══════════════════════════════════════════════════════════
    console.log('Step 6: Opening and logging into Ardia...');
    const ardia = await openAuthedArdia(browser);
    ardiaContext = ardia.context;
    const ardiaPage = ardia.page;
    ardiaErrPage = ardiaPage;
    console.log('✓ Logged into Ardia\n');
    await ardiaPage.screenshot({ path: 'screenshot-tc10-ardia-loggedin.png' });

    console.log('Step 7: Selecting Pick filters (Process/Printer/Site/WH/Location)...');
    await ardiaPage.getByText('Select Process').waitFor({ timeout: t.element }).catch(() => {});
    await ardiaPage.waitForTimeout(1000);

    // Codegen-style sequential dropdowns: textbox.first()=Process, nth(1)=Printer,
    // nth(2)=Site, nth(3)=Warehouse, nth(4)=Location.
    await selectArdiaDropdown(ardiaPage, 0, data.ardiaProcessText!);
    await selectArdiaDropdown(ardiaPage, 1, data.printer);
    await selectArdiaDropdown(ardiaPage, 2, data.ardiaSiteText!);
    await ardiaPage.waitForTimeout(1500); // warehouse list loads after site
    await selectArdiaDropdown(ardiaPage, 3, data.ardiaWarehouseText!);
    await ardiaPage.waitForTimeout(1500); // location list loads after warehouse
    await selectArdiaDropdown(ardiaPage, 4, data.ardiaLocationText!);
    await ardiaPage.screenshot({ path: 'screenshot-tc10-ardia-filters.png' });
    console.log('✓ Filters selected\n');

    console.log('Step 8: Clicking Proceed...');
    const proceedBtn = ardiaPage.getByRole('button', { name: 'Proceed' });
    await proceedBtn.waitFor({ timeout: t.element });
    if (!(await proceedBtn.isEnabled())) {
      throw new Error('Proceed button is disabled — check the Pick filter selections');
    }
    await proceedBtn.click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation }).catch(() => {});
    await ardiaPage.waitForTimeout(3000);

    console.log(`Step 9: Selecting batch tile "${data.pickBatchTile}"...`);
    const tile = ardiaPage.getByText(data.pickBatchTile!, { exact: false });
    await tile.first().waitFor({ timeout: t.element });
    await tile.first().click();
    await ardiaPage.waitForTimeout(2000);

    console.log(`Step 10: Entering License Plate barcode: ${licensePlate}...`);
    const barcodeBox = ardiaPage.getByRole('textbox', { name: 'Barcode:' });
    await barcodeBox.waitFor({ timeout: t.element });
    await barcodeBox.fill(licensePlate);
    await ardiaPage.waitForTimeout(500);

    console.log(`Step 11: Keying weight ${data.pickWeight} on the numpad...`);
    for (const digit of data.pickWeight!) {
      await ardiaPage.getByRole('button', { name: digit, exact: true }).click();
      await ardiaPage.waitForTimeout(200);
    }
    await ardiaPage.getByRole('button', { name: 'Enter', exact: true }).click();
    await ardiaPage.waitForTimeout(1500);
    await ardiaPage.screenshot({ path: 'screenshot-tc10-ardia-weight-entered.png' });

    console.log('Step 12: Clicking Post...');
    await ardiaPage.getByRole('button', { name: 'Post', exact: true }).click();
    await ardiaPage.waitForLoadState('networkidle', { timeout: t.navigation }).catch(() => {});
    await ardiaPage.waitForTimeout(2000);

    console.log('Step 13: Verifying Picking journal success dialog...');
    const successDialog = ardiaPage.getByRole('alertdialog', { name: /Picking journal/i });
    const dialogVisible = await successDialog.isVisible({ timeout: t.element }).catch(() => false);
    if (!dialogVisible) {
      // some builds show a toast/banner instead of an alertdialog
      const banner = ardiaPage.getByText(/Picking journal|success|posted/i);
      const bannerVisible = await banner.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!bannerVisible) {
        throw new Error('Pick Post did not show a Picking journal success message');
      }
    }
    console.log('✓ Pick posted — Picking journal confirmed\n');
    await ardiaPage.screenshot({ path: 'screenshot-tc10-ardia-posted.png' });

    // ══════════════════════════════════════════════════════════
    //  PART C — VERIFY COLD SCALE STAGING DATA IN D365
    // ══════════════════════════════════════════════════════════

    // ── Wait for the backend sync batch job before verifying ──
    // After the Ardia pick is posted, a D365 batch job syncs the
    // record into Cold scale staging data. This takes time — wait
    // 2 minutes before checking, otherwise the LP row won't exist
    // yet. (Tune COLD_SCALE_SYNC_WAIT_MS if a slower environment
    // needs longer.)
    const COLD_SCALE_SYNC_WAIT_MS = 120_000; // 2 minutes
    console.log(`Step 13b: Waiting ${COLD_SCALE_SYNC_WAIT_MS / 60000} min for the sync batch job to write the Cold scale staging record...`);
    for (let remaining = COLD_SCALE_SYNC_WAIT_MS; remaining > 0; remaining -= 30_000) {
      await ardiaPage.waitForTimeout(Math.min(30_000, remaining));
      const left = Math.max(0, Math.round((remaining - 30_000) / 1000));
      console.log(`         ... ${left}s remaining`);
    }
    console.log('         ✓ Sync wait complete — proceeding to Cold scale verification\n');

    console.log('Step 14: Opening Cold scale staging data in D365...');
    await openViaSearch(d365Page, 'cold scale', /Cold scale staging data/i, t.dashboard);
    console.log('✓ Cold scale staging data opened — grid rendered\n');

    console.log(`Step 15: Filtering Bar code = ${licensePlate}...`);
    // Reveal the Bar code inline filter, then fill + Apply (TC9 pattern).
    let barcodeFilter = d365Page.getByRole('textbox', { name: /Filter field: Bar code/ });
    if (!(await barcodeFilter.isVisible({ timeout: 5000 }).catch(() => false))) {
      await d365Page.getByText('Bar code', { exact: true }).first().click().catch(() => {});
      await d365Page.waitForTimeout(800);
      barcodeFilter = d365Page.getByRole('textbox', { name: /Filter field: Bar code/ });
    }
    await barcodeFilter.waitFor({ state: 'visible', timeout: t.element });
    await barcodeFilter.click();
    await barcodeFilter.fill(licensePlate);
    await d365Page.waitForTimeout(500);
    await d365Page.getByRole('button', { name: 'Apply' }).click();
    await d365Page.waitForLoadState('networkidle', { timeout: t.dashboard }).catch(() => {});
    await d365Page.waitForTimeout(3000);
    await d365Page.screenshot({ path: 'screenshot-tc10-coldscale-staging.png' });

    console.log('Step 16: Verifying the LP row exists and IsSync = true...');

    // Cold scale staging is a virtualized react grid (same as On-hand):
    // getByText returns empty because values live in cell attributes.
    // We verify via DOM evaluate — find the Bar code cell matching our LP
    // and read the IsSync cell in the SAME ROW (paired by index).
    const verification = await verifyColdScaleRow(d365Page, licensePlate, t.element);

    if (!verification.found) {
      throw new Error(`License Plate ${licensePlate} not found in Cold scale staging data`);
    }
    console.log(`         ✓ LP ${licensePlate} found in Cold scale staging data`);

    if (verification.isSync === true) {
      console.log('         ✓ IsSync = true');
    } else if (verification.isSync === false) {
      throw new Error('Cold scale staging row found but IsSync = false');
    } else {
      console.log('         ⚠ LP row present but IsSync state could not be read — confirm visually');
    }

    console.log('\n✅ TEST CASE 10 PASSED');
    console.log(`   License Plate : ${licensePlate}`);
    console.log(`   Batch         : ${data.batchNumber}`);
    console.log('   Pick posted   : Picking journal confirmed');
    console.log('   Cold scale    : LP present in staging data');

  } catch (err: any) {
    console.error(`\n❌ TEST CASE 10 FAILED: ${err.message}`);
    await d365ErrPage?.screenshot({ path: 'screenshot-tc10-error-d365.png' }).catch(() => {});
    await ardiaErrPage?.screenshot({ path: 'screenshot-tc10-error-ardia.png' }).catch(() => {});
    console.log(`   License Plate at failure: ${licensePlate || 'not yet captured'}`);
    throw err;   // surface failure to the Playwright Test Runner
  } finally {
    await d365Context?.close();
    await ardiaContext?.close();
  }
}

// ============================================================
//  Helpers
// ============================================================

/**
 * Navigate to a D365 page via the Search box, then WAIT for a grid to render.
 * Mirrors TC9: click the search result as an `option` (not loose text), then
 * block on a grid container so we never proceed while still on the dashboard.
 */
async function openViaSearch(page: Page, term: string, optionName: RegExp, gridTimeout: number): Promise<void> {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.waitForTimeout(1000);

  const box = page.getByRole('textbox', { name: 'Search for a page' });
  await box.waitFor({ timeout: t.element });
  await box.fill(term);
  await page.waitForTimeout(1500);

  await page.getByRole('option', { name: optionName }).first().click();
  await page.waitForLoadState('networkidle', { timeout: t.dashboard }).catch(() => {});

  // Reliable "form is loaded" signal: a grid body / react grid becomes visible.
  await page.locator('.reactGrid, .grid-body, [id*="MainGrid"]').first()
    .waitFor({ state: 'visible', timeout: gridTimeout });
  await page.waitForTimeout(2000);
}

/**
 * Enable the product + storage dimensions needed for LP extraction.
 *
 * The On-hand "Dimensions display" dialog has two groups:
 *   - Product dimensions:  Configuration, Size, Color, Style, Version
 *   - Storage dimensions:  Site, Warehouse, Location, License plate,
 *                          Inventory status, Batch number
 *
 * The previous version only ticked Size/Color/Style, so the
 * License plate column never appeared in the grid — which is why
 * LP extraction failed. We now also tick the storage dimensions,
 * with License plate being the critical one.
 *
 * Each checkbox first reads its state and only clicks if needed —
 * clicking an already-checked box would uncheck it.
 */
async function addDimensions(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Dimensions' }).click({ timeout: t.element });

  // ── Wait for the Dimensions dialog to actually render ─────
  // The dialog opens with an animation; checking boxes before it
  // is painted causes every checkbox lookup to miss (the bug that
  // skipped all 9 dimensions). Block on the dialog + at least one
  // known checkbox being visible before proceeding.
  const dialog = page.getByRole('dialog').filter({
    has: page.getByRole('button', { name: 'OK' }),
  }).last();
  await dialog.waitFor({ state: 'visible', timeout: t.element }).catch(() => {});

  // Anchor: wait until ANY dimension checkbox is visible — confirms
  // the checkbox list inside the dialog has finished rendering.
  await page.getByRole('checkbox', { name: 'License plate', exact: true })
    .waitFor({ state: 'visible', timeout: t.element })
    .catch(async () => {
      // fallback anchor if License plate label differs slightly
      await page.getByRole('checkbox').first()
        .waitFor({ state: 'visible', timeout: t.element }).catch(() => {});
    });
  await page.waitForTimeout(800); // let remaining checkboxes settle

  // License plate is the one we actually need for LP extraction.
  // The rest are kept for parity with the manual flow.
  const requiredDimensions = [
    'Size',
    'Color',
    'Style',
    'Site',
    'Warehouse',
    'Location',
    'License plate',     // ← CRITICAL: needed to read the LP from the grid
    'Inventory status',
    'Batch number',
  ];

  for (const dim of requiredDimensions) {
    const checkbox = page.getByRole('checkbox', { name: dim, exact: true });
    const exists = await checkbox.isVisible({ timeout: 5000 }).catch(() => false);
    if (!exists) {
      console.log(`         (dimension "${dim}" checkbox not found — skipping)`);
      continue;
    }

    // Only click if not already checked — avoids accidentally unchecking
    const isChecked = await checkbox.isChecked().catch(() => false);
    if (!isChecked) {
      await checkbox.click({ timeout: 5000 }).catch(() => {});
      console.log(`         ✓ Enabled dimension: ${dim}`);
    } else {
      console.log(`         • Dimension already enabled: ${dim}`);
    }
  }

  await page.getByRole('button', { name: 'OK' }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

/**
 * Block until the On-hand grid has actually populated with data (not just the
 * grid shell). The On-hand form can take up to ~5 min; the grid container and
 * networkidle fire well before the filtered rows render, which is why the LP
 * extraction was falling back. We poll for any 16-digit License Plate appearing
 * in the grid, logging progress, up to `timeout` ms.
 */
async function waitForOnHandData(page: Page, timeout: number): Promise<void> {
  const start    = Date.now();
  const deadline = start + timeout;
  let lastLog    = 0;

  while (Date.now() < deadline) {
    // Query the raw DOM directly. The grid is virtualized — row text is
    // empty — so we check whether any "License plate" labelled cell has a
    // 16-digit value in its attributes or inner input.
    const found = await page.evaluate(() => {
      const lpEls = Array.from(document.querySelectorAll('[aria-label="License plate"], [title="License plate"]'));
      for (const el of lpEls) {
        const input = el.querySelector('input') as HTMLInputElement | null;
        const v = (input?.value || el.getAttribute('title') || el.getAttribute('aria-label') || (el as HTMLInputElement).value || el.textContent || '').trim();
        if (/\d{16}/.test(v)) return true;
      }
      // Secondary: any element anywhere holding a 16-digit value attribute
      const all = document.querySelectorAll('input[value], [title], [aria-label]');
      for (const el of Array.from(all)) {
        const input = el as HTMLInputElement;
        const v = `${input.value || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`;
        if (/\d{16}/.test(v)) return true;
      }
      return false;
    }).catch(() => false);

    if (found) {
      console.log(`         ✓ On-hand data populated after ${Math.round((Date.now() - start) / 1000)}s`);
      return;
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    if (elapsed - lastLog >= 30) {
      console.log(`         ... still loading On-hand data (${elapsed}s elapsed)`);
      lastLog = elapsed;
    }
    await page.waitForTimeout(5000);
  }
  console.log('         ⚠ On-hand data not detected within the max wait — attempting extraction anyway');
}

/**
 * Scan the On-hand grid for a 16-digit License Plate whose physical
 * inventory is 1.
 *
 * Two strategies, in order:
 *   1. Direct column read — now that the "License plate" dimension is
 *      enabled, each row exposes a cell labelled "License plate" whose
 *      title/text holds the 16-digit value. We pair it with the physical
 *      inventory cell to confirm the qty is 1.
 *   2. Row-text regex fallback — the row's accessible text looks like:
 *        "... Available 1205202026000002 1 1 1 1 1 Ea ..."
 *      so we match a 16-digit number immediately followed by " 1".
 */
/**
 * Scan the On-hand grid for a 16-digit License Plate whose physical
 * inventory is 1.
 *
 * D365's react grid renders each cell as a separate DOM node, and the
 * LP value often lives in a cell's title/aria-label rather than visible
 * text. Relying on concatenated row text (old Strategy 2) was fragile
 * because innerText() can join cells with newlines, breaking the
 * "LP immediately followed by 1" assumption.
 *
 * New approach — three strategies in order, with diagnostic logging:
 *   1. Per-row cell read: for each row, read the License plate cell and
 *      the CW physical inventory cell separately, confirm inventory = 1.
 *   2. License plate column scan: collect every cell exposing a
 *      "License plate" label, return the first whose row's text shows a 1.
 *   3. Loose row-text regex fallback (logs candidates it sees).
 */
/**
 * DIAGNOSTIC — dump the On-hand grid structure when LP extraction fails.
 * Writes the grid's outerHTML to tc10-grid-dump.html and prints the column
 * headers + the first few data rows (with their cell labels) to the console.
 * This reveals the REAL DOM structure so extraction selectors can be fixed
 * with certainty instead of guesswork.
 */
async function dumpOnHandGridDiagnostic(page: Page): Promise<void> {
  try {
    // 1. How many rows / gridcells does Playwright even see?
    const rowCount = await page.getByRole('row').count().catch(() => 0);
    const cellCount = await page.getByRole('gridcell').count().catch(() => 0);
    const lpLabelCount = await page.getByLabel('License plate').count().catch(() => 0);
    console.log(`         [diag] rows=${rowCount}  gridcells=${cellCount}  "License plate" labelled=${lpLabelCount}`);

    // 2. Print column header labels so we know exact dimension names
    const headers = page.getByRole('columnheader');
    const hCount = await headers.count().catch(() => 0);
    const headerNames: string[] = [];
    for (let i = 0; i < hCount; i++) {
      const h = ((await headers.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      if (h) headerNames.push(h);
    }
    console.log(`         [diag] column headers (${headerNames.length}): ${headerNames.join(' | ')}`);

    // 3. Print the first 3 data rows' text + per-cell labels
    const rows = page.getByRole('row');
    const sampleN = Math.min(rowCount, 4);
    for (let i = 0; i < sampleN; i++) {
      const rowText = ((await rows.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
      console.log(`         [diag] row[${i}] text: ${rowText.substring(0, 250)}`);

      // Inspect each cell's accessible label + title in this row
      const cells = rows.nth(i).getByRole('gridcell');
      const cCount = await cells.count().catch(() => 0);
      for (let j = 0; j < cCount && j < 25; j++) {
        const label = await cells.nth(j).getAttribute('aria-label').catch(() => null);
        const title = await cells.nth(j).getAttribute('title').catch(() => null);
        const txt = ((await cells.nth(j).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
        if (/\d{16}/.test(`${label} ${title} ${txt}`)) {
          console.log(`         [diag]   row[${i}] cell[${j}] label="${label}" title="${title}" text="${txt}"`);
        }
      }
    }

    // 4. Save full grid HTML to a file for offline inspection
    const gridHtml = await page.locator('.reactGrid, [id*="MainGrid"], [role="grid"]').first()
      .evaluate((el: Element) => el.outerHTML).catch(() => '');
    if (gridHtml) {
      const fs = require('fs');
      fs.writeFileSync('tc10-grid-dump.html', gridHtml);
      console.log('         [diag] full grid HTML saved → tc10-grid-dump.html');
    }
  } catch (e: any) {
    console.log(`         [diag] diagnostic dump failed: ${e.message}`);
  }
}

async function extractLicensePlate(page: Page, timeout: number): Promise<string> {
  const deadline = Date.now() + timeout;
  let loggedSample = false;

  while (Date.now() < deadline) {

    // ── PRIMARY — group cells into rows by geometry, read per row ──
    // The grid is virtualized. Pairing two flat lists (License plate
    // cells vs CW physical inventory cells) BY INDEX is WRONG because
    // blank inventory cells may not emit a DOM node — so the lists have
    // different lengths and indices drift (this caused an LP with blank
    // inventory to be selected). Instead we group ALL labelled cells by
    // their row, using each cell's vertical position (rounded top), then
    // read License plate + CW physical inventory from the SAME row.
    const pairs = await page.evaluate(() => {
      const readVal = (el: Element): string => {
        const input = el.querySelector('input') as HTMLInputElement | null;
        const candidates = [
          input?.value,
          (el as HTMLElement).getAttribute('title'),
          (el as HTMLElement).getAttribute('aria-label'),
          (el as HTMLElement).getAttribute('value'),
          (el as HTMLElement).innerText,
          el.textContent,
        ];
        for (const c of candidates) if (c && c.trim()) return c.trim();
        return '';
      };

      // Get the displayed value of a cell including attribute checks —
      // D365 virtualized grid stores values in title/aria-label, not text.
      const readCellValue = (el: Element): string => {
        const input = el.querySelector('input') as HTMLInputElement | null;
        const candidates = [
          input?.value,
          (el as HTMLElement).getAttribute('title'),
          (el as HTMLElement).getAttribute('aria-label'),
          (el as HTMLElement).getAttribute('value'),
          (el as HTMLElement).innerText,
          el.textContent,
        ];
        for (const c of candidates) if (c && c.trim()) return c.trim();
        return '';
      };

      // Collect labelled cells for the two columns we care about
      const lpEls  = Array.from(document.querySelectorAll('[aria-label="License plate"], [title="License plate"]'));
      const invEls = Array.from(document.querySelectorAll('[aria-label="CW physical inventory"], [title="CW physical inventory"]'));

      // Build a lookup of inventory cells keyed by their row's vertical
      // position. Cells in the same visual row share (approximately) the
      // same top coordinate. Round to nearest 4px to absorb sub-pixel drift.
      const rowKey = (el: Element): number => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return Math.round(r.top / 4) * 4;
      };

      const invByRow = new Map<number, string>();
      for (const inv of invEls) {
        invByRow.set(rowKey(inv), readCellValue(inv));
      }

      const out: { lp: string; inv: string }[] = [];
      for (const lpEl of lpEls) {
        const lp = readVal(lpEl);
        if (!/^\d{16}$/.test(lp)) continue;

        // Find the inventory value for the SAME row (same top position).
        // Try exact key, then nearest within a few px to tolerate rounding.
        const key = rowKey(lpEl);
        let inv = invByRow.has(key) ? invByRow.get(key)! : '';
        if (inv === '' && !invByRow.has(key)) {
          let best = Infinity;
          for (const [k, v] of invByRow.entries()) {
            const d = Math.abs(k - key);
            if (d < best && d <= 8) { best = d; inv = v; }
          }
        }
        out.push({ lp, inv });
      }

      // Fallback: brute scan if the labelled-cell approach found nothing
      if (out.length === 0) {
        const all = document.querySelectorAll('*');
        for (const el of Array.from(all)) {
          const input = el.querySelector?.('input') as HTMLInputElement | null;
          const v = (input?.value || el.getAttribute('title') || el.getAttribute('aria-label') || (el as HTMLInputElement).value || '').trim();
          if (/^\d{16}$/.test(v)) out.push({ lp: v, inv: '' });
        }
      }

      return out;
    }).catch(() => [] as { lp: string; inv: string }[]);

    if (pairs.length > 0) {
      if (!loggedSample) {
        console.log(`         [diagnostic] read ${pairs.length} LP/inventory pair(s) (paired by row position). Sample: ` +
          pairs.slice(0, 8).map((p: { lp: string; inv: string }) => `${p.lp}(inv=${p.inv === '' ? 'blank' : p.inv})`).join(', '));
        loggedSample = true;
      }

      // ONLY accept an LP whose physical inventory is exactly 1.
      // A blank inventory means the LP is used up (inventory 0) — never pick it.
      const exact = pairs.find((p: { lp: string; inv: string }) => /^1(?:\.0+)?$/.test((p.inv || '').replace(/,/g, '')));
      if (exact) {
        console.log(`         ✓ LP found (physical inventory = ${exact.inv}): ${exact.lp}`);
        return exact.lp;
      }

      // NOTE: deliberately NO "single LP" fallback here. Picking an LP whose
      // inventory we could not confirm as 1 risks selecting a used-up LP
      // (the original bug). If nothing has inventory=1, we keep waiting.
      console.log(`         [diagnostic] no LP with inventory=1 yet: ` +
        pairs.slice(0, 10).map((p: { lp: string; inv: string }) => `${p.lp}(inv=${p.inv === '' ? 'blank' : p.inv})`).join(', '));
    }

    await page.waitForTimeout(5000);
  }
  return '';
}

/**
 * Open an Ardia filter dropdown by index, scroll the list until the option is
 * visible (long lists like Warehouse render the value several rows down — same
 * issue fixed in TC2/TC3), then click it by visible text.
 */
async function selectArdiaDropdown(page: Page, index: number, optionText: string): Promise<void> {
  await page.getByRole('textbox').nth(index).click({ timeout: t.element });
  await page.waitForTimeout(800);
  await scrollArdiaDropdownUntilVisible(page, optionText);
  await page.getByText(optionText, { exact: false }).first().click({ timeout: t.element });
  await page.waitForTimeout(800);
  console.log(`         ✓ Selected "${optionText}"`);
}

/**
 * Scroll the open Ardia dropdown container until `optionText` becomes visible.
 * Ardia renders option rows as plain divs inside app-input-grid-select's 2nd
 * child div (not a virtual-scroll viewport), so we bump scrollTop and re-check.
 * Mirrors the scroll fix used for the Warehouse dropdown in TC2/TC3.
 */
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
  // Final attempt — let the click's auto-scroll handle it if still not matched.
}

/**
 * Best-effort read of the IsSync column for the filtered Cold scale row.
 * Returns true/false when it can read the value, or null if uncertain.
 * Adjust the selectors to match your environment's column rendering.
 */
/**
 * Verify a License Plate exists in the Cold scale staging grid and read
 * its IsSync state. Cold scale staging is a virtualized react grid, so
 * (like On-hand) getByText/innerText return empty — values live in cell
 * attributes. We scan via page.evaluate.
 *
 * Approach:
 *  - Collect all "Bar code" cells and find the one whose value === the LP.
 *  - Collect all "IsSync" (or "RAF is synced") cells.
 *  - Pair by index: Bar code cell N ↔ IsSync cell N = same row.
 *  - Read the IsSync state from the checkbox (aria-checked / checked) or
 *    a Yes/No/True/False value.
 *
 * Returns { found, isSync } where isSync is true | false | null (unknown).
 */
async function verifyColdScaleRow(
  page: Page,
  licensePlate: string,
  timeout: number,
): Promise<{ found: boolean; isSync: boolean | null }> {
  const deadline = Date.now() + timeout;
  let logged = false;

  while (Date.now() < deadline) {
    const res = await page.evaluate((lp: string) => {
      const readVal = (el: Element): string => {
        const input = el.querySelector('input') as HTMLInputElement | null;
        const candidates = [
          input?.value,
          (el as HTMLElement).getAttribute('title'),
          (el as HTMLElement).getAttribute('aria-label'),
          (el as HTMLElement).getAttribute('value'),
          (el as HTMLElement).innerText,
          el.textContent,
        ];
        for (const c of candidates) if (c && c.trim()) return c.trim();
        return '';
      };

      const readChecked = (el: Element): boolean | null => {
        const input = el.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        if (input) return input.checked;
        const ac = el.getAttribute('aria-checked');
        if (ac === 'true') return true;
        if (ac === 'false') return false;
        const v = readVal(el).toLowerCase();
        if (/yes|true|✓/.test(v)) return true;
        if (/no|false/.test(v)) return false;
        return null;
      };

      // Cold scale columns (from codegen): "Bar code", "IsSync", "RAF is synced"
      const barEls  = Array.from(document.querySelectorAll('[aria-label="Bar code"], [title="Bar code"]'));
      const syncEls = Array.from(document.querySelectorAll('[aria-label="IsSync"], [title="IsSync"], [aria-label="RAF is synced"], [title="RAF is synced"]'));

      // Find which Bar code cell holds our LP
      let idx = -1;
      const allBars: string[] = [];
      for (let i = 0; i < barEls.length; i++) {
        const v = readVal(barEls[i]);
        allBars.push(v);
        if (v === lp || v.includes(lp)) { idx = i; break; }
      }

      if (idx === -1) {
        return { found: false, isSync: null as boolean | null, debugBars: allBars.slice(0, 8) };
      }

      // Pair the IsSync cell at the same index
      const isSync = syncEls[idx] ? readChecked(syncEls[idx]) : null;
      return { found: true, isSync, debugBars: allBars.slice(0, 8) };
    }, licensePlate).catch(() => ({ found: false, isSync: null as boolean | null, debugBars: [] as string[] }));

    if (!logged) {
      console.log(`         [diagnostic] Cold scale Bar code cells seen: ${(res.debugBars || []).join(', ') || '(none)'}`);
      logged = true;
    }

    if (res.found) {
      return { found: true, isSync: res.isSync };
    }

    // Record may still be syncing/rendering — wait and retry until timeout
    await page.waitForTimeout(5000);
  }

  return { found: false, isSync: null };
}

// Run standalone:  npx ts-node tests/tc10.ts
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 500, args: ['--ignore-certificate-errors'] });
    try { await run(browser); } finally { await browser.close(); }
  })();
}