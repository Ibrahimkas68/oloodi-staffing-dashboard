import { expect, type Page } from '@playwright/test';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

/** Waits until the page's connection badge shows the given status. */
export async function waitForStatus(
  page: Page,
  status: ConnectionStatus,
  timeout = 15_000,
): Promise<void> {
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-status', status, {
    timeout,
  });
}

/** Waits until the badge says Live, meaning the snapshot has arrived. */
export function waitLive(page: Page, timeout = 15_000): Promise<void> {
  return waitForStatus(page, 'live', timeout);
}
