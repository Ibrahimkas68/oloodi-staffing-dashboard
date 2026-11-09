import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { AMINA } from '../db.js';
import { waitLive } from '../live.js';
import { installOnlineClock } from './probes.js';
import { waitForButton } from './toggle.js';

export const AMINA_ROW = `worker-row-${AMINA}`;

export type Session = {
  manager: Page;
  worker: Page;
  /** The manager's context: the one that loses and regains the network. */
  managerContext: BrowserContext;
  close: () => Promise<void>;
};

/** POSTs an action over HTTP. Used for setup only, outside any timing. */
async function postAction(baseUrl: string, action: 'invite' | 'accept'): Promise<void> {
  const response = await fetch(`${baseUrl}/api/assignments/${AMINA}/${action}`, { method: 'POST' });
  if (!response.ok)
    throw new Error(`Setup request "${action}" failed with HTTP ${response.status}.`);
}

/**
 * Two browser contexts (two "devices"), as in the e2e tests: the manager dashboard and the worker
 * view for Amina. Both are Live and Amina is accepted when this returns. The database must have
 * been reset BEFORE this runs, because the pages load whatever state exists at that moment.
 */
export async function openSession(browser: Browser, baseUrl: string): Promise<Session> {
  const managerContext = await browser.newContext({ baseURL: baseUrl });
  const workerContext = await browser.newContext({ baseURL: baseUrl });
  const manager = await managerContext.newPage();
  const worker = await workerContext.newPage();
  await manager.goto('/');
  await worker.goto(`/worker?worker=${AMINA}`);
  await Promise.all([waitLive(manager), waitLive(worker)]);
  await installOnlineClock(manager);

  await postAction(baseUrl, 'invite');
  await postAction(baseUrl, 'accept');
  await expect(manager.getByTestId(AMINA_ROW)).toContainText('Accepted');
  await waitForButton(worker, 'cancel');

  return {
    manager,
    worker,
    managerContext,
    close: async () => {
      await Promise.all([managerContext.close(), workerContext.close()]);
    },
  };
}
