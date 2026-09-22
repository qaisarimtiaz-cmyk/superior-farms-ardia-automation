// Playwright Test Runner wrapper for TC002 — reuses tests/tc2.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc2';

test('TC002 - Produce via CR Transfer: D365 batch order -> Ardia -> RAF staging verify', async ({ browser }, testInfo) => {
  // End-to-end: batch create -> Ardia CR Transfer produce -> ~2 min RAF sync wait -> staging verify.
  test.setTimeout(20 * 60 * 1000);
  await run(browser, testInfo);
});
