// Playwright Test Runner wrapper for TC001 — reuses tests/tc1.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc1';

test('TC001 - Produce workflow: D365 batch order -> Ardia produce -> RAF posting', async ({ browser }) => {
  await run(browser);
});
