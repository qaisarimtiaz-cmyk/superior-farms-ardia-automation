// Playwright Test Runner wrapper for TC010 — reuses tests/tc10.ts logic.
// Authentication is handled once by the "setup" project (auth.setup.ts).
import { test } from '@playwright/test';
import { run } from './tc10';

test('TC010 - Pick process from Ardia: On-hand LP -> Pick -> Cold scale staging sync', async ({ browser }, testInfo) => {
  // D365 On-hand list can take ~5 min to render, plus a ~2 min cold-scale sync wait.
  test.setTimeout(15 * 60 * 1000);
  await run(browser, testInfo);
});
