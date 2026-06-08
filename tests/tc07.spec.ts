// Playwright Test Runner wrapper for TC007 — reuses tests/tc7.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc7';

test('TC007b - Reversal: Catch-Weight Tag deletion (refined) -> RAF reversal staging', async ({ browser }) => {
  await run(browser);
});
