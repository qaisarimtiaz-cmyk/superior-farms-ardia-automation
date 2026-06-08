// ============================================================
//  test-data.ts  —  Test case data
//  Each test case has its own batch order settings.
//  Add a new entry here whenever you add a new test case.
// ============================================================

export interface BatchOrderData {
  itemNumber:    string;
  configuration: string;   // leave '' if not used
  site:          string;
  siteDisplayText:      string;
  warehouse:     string;
  warehouseDisplayText: string;
  location:      string;
  quantity:      string;
  formulaNumber: string;   // leave '' if not used
  pool:          string;   // leave '' if not used
  printer:       string;   // used in Ardia app
  description:   string;   // human readable note — what this test case is testing
  fallbackBarcode?: string; // optional: barcode to use if TC1 fails (for TC4)

  // ── Pick-process fields (TC10) ─────────────────────────────
  batchNumber?:        string;  // batch to search in D365 On-hand list
  ardiaProcessText?:   string;  // Ardia Process dropdown text (e.g. "Pick")
  ardiaSiteText?:      string;  // Ardia Site dropdown option text
  ardiaWarehouseText?: string;  // Ardia Warehouse dropdown option text
  ardiaLocationText?:  string;  // Ardia Location dropdown option text
  pickBatchTile?:      string;  // batch tile shown on the left in Ardia Pick screen
  pickWeight?:         string;  // weight to key into the Ardia numpad
  manualLicensePlate?: string;  // fallback LP if D365 extraction yields nothing
  boxCount?:           number;  // number of boxes to pick (for TC10 Pick test)

  // ── Customer-label produce fields (TC12) ───────────────────
  customerLabelText?:  string;  // Ardia Customer Label option (e.g. "HEB Grocery44700")
  produceWeight?:      string;  // weight to key on the Ardia numpad for produce
}

export const testData: Record<string, BatchOrderData> = {

  // ── Test Case 1 ────────────────────────────────────────────
  TC01: {
    description: 'AT-013',
    itemNumber: 'P20',
    configuration: '10043',
    site: '12',
    warehouse: '12001',
    location: '12140',
    quantity: '10',
    formulaNumber: '',
    pool: '',
    printer: 'ZPL virtual printer (new)',
    siteDisplayText: "",
    warehouseDisplayText: "",
    boxCount: 10
  },
// ── Test Case 2 ────────────────────────────────────────────
  TC02: {
    description: 'CRT-AT-001',
    itemNumber: 'P20',
    configuration: '12026',
    site: '15',
    warehouse: '15001',
    location: '15140',
    quantity: '10',
    formulaNumber: '',
    pool: '',
    printer: 'ZPL virtual printer (new)',
    siteDisplayText: "",
    warehouseDisplayText: ""
  },
// ── Test Case 3 ────────────────────────────────────────────
  TC03: {
    description:   'CRT-AT-001',
    itemNumber:    'P12',
    configuration: '13897',
    site:          '17',
    warehouse:     '17001',
    location:      '17140',
    quantity:      '10',
    formulaNumber: '',
    pool:          '',
    printer:       'ZPL virtual printer (new)',
     // ... existing fields ...
    siteDisplayText:'17 - Grove - IL Pro of Illinois',
    warehouseDisplayText: 'Grove - Stock (17001)',
  },

  // ── Test Case 4 ────────────────────────────────────────────
  // Depends on TC1. If TC1 fails, uses fallbackBarcode
  TC04: {
    description: 'RAF Staging Barcode → Ardia Conversions',
    itemNumber: 'P20',
    configuration: '10043',
    site: '12',
    warehouse: '12001',
    location: '12140',
    quantity: '10',
    formulaNumber: '',
    pool: '',
    printer: 'ZPL virtual printer (new)',
    fallbackBarcode: '(01)90717497100436(3202)004688(11)260305(21)0603785481',
    siteDisplayText: "",
    warehouseDisplayText: ""
  },

  // ── Test Case 5 ────────────────────────────────────────────
  // Ardia: Produce → Reprint/Reversal workflow
  TC05: {
    description: 'Ardia Produce - Reprint/Reversal Label',
    itemNumber: 'P20',
    configuration: '10043',
    site: '12',
    warehouse: '12001',
    location: '12140',
    quantity: '10',
    formulaNumber: '',
    pool: '',
    printer: 'ZPL virtual printer (new)',
    siteDisplayText: "",
    warehouseDisplayText: ""
  },

  // ── Test Case 10 ───────────────────────────────────────────
  // Ardia: Pick process. Get a License Plate (inventory = 1) from
  // D365 On-hand list, pick it in Ardia, then verify the Cold scale
  // staging data row exists and IsSync = true.
  TC10: {
    description: 'Pick process from Ardia App',
    itemNumber: 'P20',
    configuration: '',
    site: '12',
    warehouse: '12001',
    location: '12140',
    quantity: '1',
    formulaNumber: '',
    pool: '',
    printer: 'ZPL virtual printer (new)',
    siteDisplayText: '',
    warehouseDisplayText: '',

    // ── Pick-specific ──
    batchNumber:        'HS-051926',                 // batch to search in On-hand list
    ardiaProcessText:   'Pick',
    ardiaSiteText:      '- Dixon Ellensburg Lamb',   // partial text is fine
    ardiaWarehouseText: 'Dixon - Stock (12001)',
    ardiaLocationText:  '12140',
    pickBatchTile:      'Primals12-SF',              // batch tile on the left in Ardia
    pickWeight:         '54',
    manualLicensePlate: '1205202026000003',          // fallback if extraction finds none
  },

  // ── Test Case 12 ───────────────────────────────────────────
  // D365 batch order creation only (Parts 1-4: login -> navigate ->
  // create batch order -> filter & select). Fill in your values.
  TC12: {
    description:   'TC12 — D365 batch order creation',
    itemNumber:    'P15',
    configuration: '14573',
    site:          '12',
    warehouse:     '12001',
    location:      '12140',
    quantity:      '10',
    formulaNumber: '',
    pool:          '',
    printer:       'ZPL virtual printer (new)',
    siteDisplayText:      '',
    warehouseDisplayText: '',

    // ── Ardia (Produce + HEB Customer Label) ──
    ardiaProcessText:   'Produce',                  // usually the default — selected explicitly
    ardiaSiteText:      '- Dixon Ellensburg Lamb',  // partial text is fine
    ardiaWarehouseText: 'Dixon - Stock (12001)',
    ardiaLocationText:  '12140',
    customerLabelText:  'HEB Grocery44700',
    produceWeight:      '44',
  },

  // ── Add more test cases below as needed ────────────────────
  // TC06: { ... }

};