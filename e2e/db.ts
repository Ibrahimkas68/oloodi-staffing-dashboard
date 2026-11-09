import { execFileSync } from 'node:child_process';
import { e2eEnvironment, REPO_ROOT } from './env.js';

/** Seed ids: 1 Amina El Idrissi, 2 Youssef, 3 Salma. The assignment id equals the worker id. */
export const AMINA = 1;

/**
 * Drops, recreates and seeds the e2e database. Plain module (no Playwright fixtures), so both the
 * test fixtures and the measurement script can use it.
 */
export function resetDatabase(): void {
  const env = e2eEnvironment();
  // The owner URL is used for the reset; process.env values win over .env in the script.
  execFileSync('sh', ['infra/scripts/reset-db.sh'], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}
