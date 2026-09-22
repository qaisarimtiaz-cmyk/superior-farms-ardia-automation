// Playwright Test Runner wrapper for TC004 — reuses tests/tc4.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc4';

test('TC004 - RAF staging barcode -> Ardia Fresh-to-Frozen conversion', async ({ browser }, testInfo) => {
  await run(browser, testInfo);
});
