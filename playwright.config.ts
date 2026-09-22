// ============================================================
//  playwright.config.ts  —  Playwright Test Runner configuration
//
//  Enables the native HTML execution report, traces, screenshots,
//  and video. Only files matching *.spec.ts are run as tests, so
//  the original standalone ts-node scripts (tc1.ts ...) are ignored.
//
//  Authentication runs ONCE via the "setup" project (auth.setup.ts),
//  which saves D365/Ardia sessions to .auth/. The "e2e" project then
//  reuses those sessions, so individual tests do not log in again.
//
//  Run all:   npx playwright test          (setup -> e2e -> report)
//  Auth only: npx playwright test --project=setup
//  Report:    npx playwright show-report
// ============================================================

import { defineConfig } from '@playwright/test';
import { config as env } from './config';

export default defineConfig({
  testDir: './tests',

  // Creates this run's timestamped reports/runs/<date-time>/ folder before
  // anything else starts, so every test's screenshots and the client
  // report all land in the same place for this execution. See
  // utils/run-folder.ts.
  globalSetup: './global-setup.ts',

  // These flows are long (D365 login + MFA + Ardia). Give them room.
  timeout: env.timeouts.dashboard * 3,   // ~6 min per test
  expect: { timeout: env.timeouts.element },

  // Tests share data via shared-state.json (TC chains), so run serially.
  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [
    ['list'],                          // live progress in the console
    ['html', { open: 'never' }],       // interactive HTML report -> playwright-report/
    ['json', { outputFile: 'test-results/results.json' }],
    // Client-facing, PDF-ready branded report (print to PDF from Chrome).
    // Only the filename is used — the directory is always this run's
    // timestamped folder (see utils/run-folder.ts).
    ['./tests/reporters/client-report.ts', { outputFile: 'Client_Execution_Report.html' }],
  ],

  use: {
    headless: process.env.HEADLESS === 'true',
    launchOptions: { slowMo: 500, args: ['--ignore-certificate-errors'] },
    ignoreHTTPSErrors: true,           // Ardia uses a self-signed certificate
    viewport: { width: 1920, height: 1080 },
    actionTimeout: env.timeouts.action,
    navigationTimeout: env.timeouts.navigation,

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',        // open failures in the Trace Viewer
  },

  projects: [
    // One-time login bootstrap — saves D365/Ardia sessions to .auth/.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // The actual test cases, run only after setup has authenticated.
    {
      name: 'e2e',
      testMatch: '**/*.spec.ts',
      dependencies: ['setup'],
    },
  ],
});
