// Playwright Test Runner wrapper for TC006 — reuses tests/tc6.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc6';

test('TC007 - Reversal: Catch-Weight Tag deletion -> RAF reversal staging', async ({ browser }, testInfo) => {
  await run(browser, testInfo);
});
