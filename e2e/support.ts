import { expect, test as base, type Page } from '@playwright/test';
import { AMINA, resetDatabase } from './db.js';
import { waitLive } from './live.js';

type Fixtures = {
  /** Resets the e2e database before every test. */
  freshDatabase: void;
  /** The dashboard, in its own browser context. */
  manager: Page;
  /** The worker view for Amina, in a second browser context (a different "device"). */
  worker: Page;
};

export const test = base.extend<Fixtures>({
  freshDatabase: [
    // Playwright requires the first argument to be a destructuring pattern, even when empty.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      resetDatabase();
      await use();
    },
    { auto: true },
  ],
  manager: async ({ browser, baseURL, freshDatabase: _ }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto('/');
    await use(page);
    await context.close();
  },
  worker: async ({ browser, baseURL, freshDatabase: _ }, use) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto(`/worker?worker=${AMINA}`);
    await use(page);
    await context.close();
  },
});

export { expect };

// Specs import everything they need from here.
export { AMINA, waitLive };
