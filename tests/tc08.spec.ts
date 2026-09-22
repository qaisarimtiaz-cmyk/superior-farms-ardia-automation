// Playwright Test Runner wrapper for TC008 — reuses tests/tc8.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc8';

test('TC008 - Reversal: CR Transfer License Plate deletion -> CRT reversal staging', async ({ browser }, testInfo) => {
  await run(browser, undefined, testInfo);
});
