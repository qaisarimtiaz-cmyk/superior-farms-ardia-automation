// Playwright Test Runner wrapper for TC005 — reuses tests/tc5.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc5';

test('TC006 - Ardia Produce -> Reprint/Reversal label (barcodereprint API)', async ({ browser }) => {
  await run(browser);
});
