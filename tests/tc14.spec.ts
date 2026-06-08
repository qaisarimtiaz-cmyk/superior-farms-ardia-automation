// Playwright Test Runner wrapper for TC013 — reuses tests/tc13.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc14';

test('TC001 (Multi-Box) - D365 batch order -> Ardia produce N boxes', async ({ browser }, testInfo) => {
  test.setTimeout(20 * 60 * 1000); // 20 min — full flow + N-box produce loop
  await run(browser, testInfo);
});
 
