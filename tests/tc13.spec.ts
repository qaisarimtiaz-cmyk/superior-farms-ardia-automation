// Playwright Test Runner wrapper for TC013 — reuses tests/tc13.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc13';

test('TC013 - D365 batch order -> Ardia Produce', async ({ browser }) => {
  // End-to-end with MFA, batch create, Ardia produce, sync wait and verify.
  test.setTimeout(20 * 60 * 1000);
  await run(browser);
});
