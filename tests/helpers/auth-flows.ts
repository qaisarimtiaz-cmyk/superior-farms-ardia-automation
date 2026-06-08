// ============================================================
//  tests/helpers/auth-flows.ts
//  Centralized authentication for D365 and Ardia.
//
//  Login happens ONCE per app (see tests/auth.setup.ts), and the
//  resulting Playwright storageState is saved under .auth/. Every
//  test then opens a context seeded with that state via
//  openAuthedD365() / openAuthedArdia() — so no test logs in
//  separately on the happy path.
//
//  If the saved state is missing or stale (login screen detected),
//  the helpers automatically fall back to a full interactive login,
//  so a test is never left stranded on a sign-in page.
// ============================================================

import * as fs   from 'fs';
import * as path from 'path';
import { Browser, BrowserContext, Page } from '@playwright/test';
import { config } from '../../config';

const t = config.timeouts;

// ── Saved storageState locations ───────────────────────────
export const AUTH_DIR   = path.resolve(__dirname, '../../.auth');
export const D365_STATE  = path.join(AUTH_DIR, 'd365.json');
export const ARDIA_STATE = path.join(AUTH_DIR, 'ardia.json');

const VIEWPORT = { width: 1920, height: 1080 } as const;

/** Return the state path only if the file exists; otherwise undefined
 *  (passing a non-existent path to newContext throws). */
function existingState(stateFile: string): string | undefined {
  return fs.existsSync(stateFile) ? stateFile : undefined;
}

/** Ensure the .auth directory exists before writing a storageState. */
export function ensureAuthDir(): void {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// ============================================================
//  D365 — interactive login (Azure AD + MFA)
// ============================================================

/** Perform the Azure AD email → password → MFA flow on a page that
 *  is already on the D365 sign-in screen, then wait for the dashboard. */
export async function loginToD365(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Enter your email, phone, or' }).waitFor({ timeout: t.login });
  await page.getByRole('textbox', { name: 'Enter your email, phone, or' }).fill(config.d365.username);
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('textbox', { name: /Enter the password for/ }).waitFor({ timeout: t.login });
  await page.getByRole('textbox', { name: /Enter the password for/ }).fill(config.d365.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  console.log('Waiting for MFA — approve the D365 sign-in on your authenticator app...');
  await page.getByRole('heading', { name: 'Approve sign in request' }).waitFor({ timeout: t.mfa });
  await page.getByRole('button', { name: 'Yes' }).click();

  await page.waitForURL('**cmp=THCI**', { timeout: t.dashboard });
  await page.waitForLoadState('networkidle', { timeout: t.dashboard });
  await page.waitForTimeout(3000);
}

/** Open a D365 page using the saved session, falling back to a full
 *  login if the session is missing or expired. Returns the context so
 *  the caller can close it. */
export async function openAuthedD365(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport:          VIEWPORT,
    ignoreHTTPSErrors: true,
    storageState:      existingState(D365_STATE),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(t.element);

  await page.goto(config.d365.url, { waitUntil: 'domcontentloaded', timeout: t.dashboard });

  const needsLogin = await page
    .getByRole('textbox', { name: 'Enter your email, phone, or' })
    .isVisible({ timeout: 8000 })
    .catch(() => false);

  if (needsLogin) {
    console.log('D365 session not found or expired — logging in...');
    await loginToD365(page);
  } else {
    await page.waitForURL('**cmp=THCI**', { timeout: t.dashboard }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: t.dashboard }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log('D365 session reused from saved state.');
  }

  return { context, page };
}

// ============================================================
//  Ardia — interactive login (self-signed cert + Azure AD + MFA)
// ============================================================

/** Accept the self-signed certificate interstitial if Chromium shows it. */
export async function dismissArdiaCertWarning(page: Page): Promise<void> {
  const advancedButton = page.getByRole('button', { name: 'Advanced' });
  const isAdvancedVisible = await advancedButton.isVisible({ timeout: 5000 }).catch(() => false);
  if (isAdvancedVisible) {
    await advancedButton.click();
    await page.getByRole('link', { name: /proceed|continue/i }).click();
    await page.waitForLoadState('domcontentloaded', { timeout: t.navigation });
  }
}

/** Perform the Ardia "Login" → Azure AD → MFA flow on a page that is
 *  already on the Ardia landing screen, then wait for the app shell. */
export async function loginToArdia(page: Page): Promise<void> {
  await page.locator('button.btn.btn-primary').waitFor({ timeout: t.element });
  await page.locator('button.btn.btn-primary').click();
  await page.waitForTimeout(2000);

  await page.getByRole('textbox', { name: 'Enter your email, phone, or' }).waitFor({ timeout: t.login });
  await page.getByRole('textbox', { name: 'Enter your email, phone, or' }).fill(config.ardia.username);
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('textbox', { name: 'Enter the password for' }).waitFor({ timeout: t.login });
  await page.getByRole('textbox', { name: 'Enter the password for' }).fill(config.ardia.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  const mfaVisible = await page
    .getByRole('heading', { name: 'Approve sign in request' })
    .isVisible({ timeout: 15000 })
    .catch(() => false);
  if (mfaVisible) {
    console.log('Waiting for MFA — approve the Ardia sign-in on your authenticator app...');
    await page.getByRole('button', { name: 'Yes' }).click();
  }
  // "Stay signed in?" prompt — present only sometimes.
  await page.getByRole('button', { name: 'Yes' }).click().catch(() => {});

  await page.waitForURL('**/10.164.2.92**', { timeout: t.dashboard }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: t.dashboard });
  await page.waitForTimeout(3000);
}

/** Open an Ardia page using the saved session, falling back to a full
 *  login if the session is missing or expired. Returns the context so
 *  the caller can close it. */
export async function openAuthedArdia(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport:          VIEWPORT,
    ignoreHTTPSErrors: true,
    storageState:      existingState(ARDIA_STATE),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(t.element);

  await page.goto(config.ardia.url, { waitUntil: 'domcontentloaded', timeout: t.navigation });
  await dismissArdiaCertWarning(page);
  await page.waitForTimeout(2000);

  // The filter panel ("Select Process") means we are authenticated.
  const authenticated = await page
    .getByText('Select Process')
    .isVisible({ timeout: 8000 })
    .catch(() => false);

  if (!authenticated) {
    console.log('Ardia session not found or expired — logging in...');
    await loginToArdia(page);
  } else {
    console.log('Ardia session reused from saved state.');
  }

  return { context, page };
}
