import { AMINA, expect, test, waitLive } from '../support.js';

const ROW = `worker-row-${AMINA}`;

test('a change in one session shows up in the other without reloading', async ({ manager, worker }) => {
  await waitLive(manager);
  await waitLive(worker);
  const row = manager.getByTestId(ROW);
  const status = worker.getByRole('region', { name: 'Your status' });

  await manager.getByRole('button', { name: 'Invite Amina El Idrissi' }).click();
  await expect(worker.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();

  await worker.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(row).toContainText('Accepted');
  await expect(manager.getByTestId('kpi-filled')).toHaveText(/Filled\s*1\s*\/3/);

  await worker.getByRole('button', { name: 'Check in' }).click();
  await expect(row).toContainText('Checked in');
  await expect(manager.getByTestId('kpi-checked-in')).toHaveText(/Checked in now\s*1\s*on site/);

  await worker.getByRole('button', { name: 'Check out' }).click();
  await expect(row).toContainText('Checked out');
  await expect(manager.getByTestId('kpi-checked-out')).toHaveText(/Checked out\s*1\s*still count/);
  await expect(manager.getByTestId('kpi-filled')).toHaveText(/Filled\s*1\s*\/3/);
  await expect(status).toContainText('Checked out');

  // A reload must show exactly what the live updates showed: same statuses, same times.
  const managerRow = await row.innerText();
  const workerTimes = await worker.getByTestId('recorded-times').innerText();
  await manager.reload();
  await worker.reload();
  await waitLive(manager);
  await waitLive(worker);

  // The texts were read with innerText (cells on separate lines), so compare with innerText too.
  await expect(manager.getByTestId(ROW)).toHaveText(managerRow, { useInnerText: true });
  await expect(worker.getByTestId('recorded-times')).toHaveText(workerTimes, { useInnerText: true });
});
