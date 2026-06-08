// ============================================================
//  config.ts  —  Environment settings ONLY
//  URLs and credentials are loaded from .env (see .env.example);
//  timeouts and tunable test inputs live here.
// ============================================================

import 'dotenv/config';

/** Read a required environment variable or fail fast with a clear message. */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${name}". ` +
      `Copy .env.example to .env and fill in the value.`,
    );
  }
  return value;
}

export const config = {
  d365: {
    url:      required('D365_URL'),
    username: required('D365_USERNAME'),
    password: required('D365_PASSWORD'),
  },

  ardia: {
    url:      required('ARDIA_URL'),
    username: required('ARDIA_USERNAME'),
    password: required('ARDIA_PASSWORD'),
    weightInputProduce: '29',          // Weight to enter on the numpad — update as needed
    weightInput:        '900',         // Weight to enter on the numpad — update as needed
    qtyInput:           '5',           // Quantity to enter on the numpad — update as needed
    rafApiUrl:          required('ARDIA_RAF_API_URL'),  // RAF journal API to verify
  },

  // ── Timeouts (milliseconds) ────────────────────────────────
  // Increase these if your environment is slow
  timeouts: {
    login:        60000,    // Azure AD login + MFA approval
    dashboard:   120000,    // Waiting for D365 dashboard to fully load
    navigation:   60000,    // Page navigations inside D365
    action:       60000,    // Button clicks, form submissions, spinners
    element:      30000,    // Waiting for individual elements to appear
    mfa:          90000,    // Extra time for MFA approval on phone
    apiResponse:  10000,    // RAF / barcodereprint API response
    onHandLoad:  300000,    // D365 On-hand list can take up to ~5 min to render (varies by env)
  },
  reporter: [
     ['list'],
     ['html', { open: 'never' }],
     ['./tests/reporters/client-report.ts', { outputFile: 'reports/Client_Execution_Report.html' }],
   ],
};
