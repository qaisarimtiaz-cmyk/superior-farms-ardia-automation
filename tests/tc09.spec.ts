// Playwright Test Runner wrapper for TC009 — reuses tests/tc9.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc9';

test('TC009 - Reversal: Hangback License Plate deletion -> Hangback reversal staging', async ({ browser }) => {
  await run(browser);
});
