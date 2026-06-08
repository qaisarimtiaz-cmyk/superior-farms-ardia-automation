import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://sf-f3-d365-test-723aae8f7890958cedevaos.axcloud.dynamics.com/?cmp=THCI');

  // Pause here — manually complete Azure AD login + MFA in the browser
  await page.pause();

  // Once you're fully logged in and on the D365 homepage, press Resume in the Playwright inspector
  await context.storageState({ path: 'auth.json' });

  await browser.close();
  console.log('Auth state saved to auth.json');
})();