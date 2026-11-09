import { execFileSync } from 'node:child_process';
import { expect, test as base, type Page } from '@playwright/test';
import { e2eEnvironment, REPO_ROOT } from './env.js';

/** Seed ids: 1 Amina El Idrissi, 2 Youssef, 3 Salma. The assignment id equals the worker id. */
export const AMINA = 1;

type Fixtures = {
  /** Resets the e2e database before every test. */
  freshDatabase: void;
  /** The dashboard, in its own browser context. */
  manager: Page;
  /** The worker view for Amina, in a second browser context (a different "device"). */
  worker: Page;
};

function resetDatabase(): void {
  const env = e2eEnvironment();
  // The owner URL is used for the reset; process.env values win over .env in the script.
  execFileSync('sh', ['infra/scripts/reset-db.sh'], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}

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

/** Waits until the page's connection badge says Live, meaning the snapshot has arrived. */
export async function waitLive(page: Page, timeout = 15_000): Promise<void> {
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', 'live', { timeout });
}
