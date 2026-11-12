import { test as base, expect } from '@playwright/test';
// Local verification can attach to the shared Preview browser instead of launching one.
export const test = base.extend({
  page: async ({ playwright }, use) => {
    const endpoint = process.env.SNAPGLOW_CDP;
    const browser = endpoint
      ? await playwright.chromium.connectOverCDP(endpoint)
      : await playwright.chromium.launch();
    const context = endpoint
      ? browser.contexts()[0]
      : await browser.newContext({
          acceptDownloads: true,
          viewport: { width: 1440, height: 1000 },
        });
    if (!context) throw new Error('Preview browser context unavailable.');
    const page = await context.newPage();
    await use(page);
    await page.close();
    await browser.close();
  },
});
export { expect };
