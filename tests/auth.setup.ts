// ============================================================
//  tests/auth.setup.ts  —  One-time authentication bootstrap
//
//  Runs as the Playwright "setup" project before the e2e suite
//  (see playwright.config.ts -> projects). It logs into D365 and
//  Ardia once, approving MFA on the authenticator app, and saves
//  each session to .auth/d365.json / .auth/ardia.json. Every test
//  then reuses those sessions instead of logging in again.
//
//  Refresh sessions only:  npx playwright test --project=setup
// ============================================================

import { test as setup } from '@playwright/test';
import { config } from '../config';
import {
  loginToD365,
  loginToArdia,
  dismissArdiaCertWarning,
  ensureAuthDir,
  D365_STATE,
  ARDIA_STATE,
} from './helpers/auth-flows';

// Login + MFA can be slow; give each bootstrap generous headroom.
setup.setTimeout(5 * 60 * 1000);

setup('authenticate D365', async ({ page }) => {
  ensureAuthDir();
  await page.goto(config.d365.url, { waitUntil: 'domcontentloaded', timeout: config.timeouts.dashboard });
  await loginToD365(page);
  await page.context().storageState({ path: D365_STATE });
  console.log(`✓ D365 session saved → ${D365_STATE}`);
});

setup('authenticate Ardia', async ({ page }) => {
  ensureAuthDir();
  await page.goto(config.ardia.url, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigation });
  await dismissArdiaCertWarning(page);
  await loginToArdia(page);
  await page.context().storageState({ path: ARDIA_STATE });
  console.log(`✓ Ardia session saved → ${ARDIA_STATE}`);
});
