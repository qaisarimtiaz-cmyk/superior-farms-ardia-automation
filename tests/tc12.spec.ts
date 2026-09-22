// Playwright Test Runner wrapper for TC012 — reuses tests/tc12.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc12';

test('TC012 - D365 batch order creation -> Ardia Produce -> RAF staging verify', async ({ browser }, testInfo) => {
  // End-to-end: batch create -> Ardia produce -> ~2 min RAF sync wait -> staging verify.
  test.setTimeout(20 * 60 * 1000);
  await run(browser, testInfo);
});
