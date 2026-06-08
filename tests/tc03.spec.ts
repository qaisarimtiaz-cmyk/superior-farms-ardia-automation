// Playwright Test Runner wrapper for TC003 — reuses tests/tc3.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc3';

test('TC003/TC004 - Produce via Hangback: D365 batch order -> Ardia -> RAF staging verify', async ({ browser }) => {
  // End-to-end: batch create -> Ardia Hangback produce -> ~2 min RAF sync wait -> staging verify.
  test.setTimeout(20 * 60 * 1000);
  await run(browser);
});
