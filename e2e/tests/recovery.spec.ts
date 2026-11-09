import { AMINA, expect, test, waitLive } from '../support.js';

/** SC-006: a dropped connection is back to Live within this long after the network returns. */
const RECOVERY_TIMEOUT_MS = 15_000;
const OFFLINE_REACTION_TIMEOUT_MS = 5_000;

test('a session that loses the network catches up by itself, without a reload', async ({ manager, worker }) => {
  await waitLive(manager);
  await waitLive(worker);
  const row = manager.getByTestId(`worker-row-${AMINA}`);

  // Amina must be accepted before the outage, so the worker can check in during it.
  await manager.getByRole('button', { name: 'Invite Amina El Idrissi' }).click();
  await worker.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(row).toContainText('Accepted');
  // A marker that only survives while the page is not reloaded.
  await manager.evaluate(() => Object.assign(window, { __marker: 1 }));

  // The browser fires an `offline` event, and the app reacts to it at once.
  await manager.context().setOffline(true);
  await expect(manager.getByTestId('connection-status')).toHaveAttribute('data-status', 'offline', {
    timeout: OFFLINE_REACTION_TIMEOUT_MS,
  });
  await expect(manager.getByTestId('offline-banner')).toBeVisible();

  await worker.getByRole('button', { name: 'Check in' }).click();
  await expect(worker.getByRole('region', { name: 'Your status' })).toContainText('Checked in');
  await expect(row).not.toContainText('Checked in');

  await manager.context().setOffline(false);
  await waitLive(manager, RECOVERY_TIMEOUT_MS);
  await expect(manager.getByTestId('offline-banner')).toBeHidden();
  await expect(row).toContainText('Checked in');
  expect(await manager.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
});
