import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--ignore-certificate-errors'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  await page.goto('https://10.164.2.92:444/');

  // Manually complete login + MFA in the opened browser window
  // then press Resume in the Playwright Inspector
  await page.pause();

  await context.storageState({ path: 'auth.json' });

  await browser.close();
  console.log('✓ Auth state saved to auth.json');
})();