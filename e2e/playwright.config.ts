import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT, START_APP, e2eTarget, serverEnvironment } from './env.js';

const SERVER_START_TIMEOUT_MS = 120_000;

const target = e2eTarget();

export default defineConfig({
  testDir: './tests',
  // Tests share one database and one live hub, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    // Local mode: the server this config starts. External mode: the app in the e2e container.
    // Either way env.ts has checked that the database that gets reset belongs to this target.
    baseURL: target.baseUrl,
    trace: 'retain-on-failure',
  },
  // External mode: the app is already running, so there is nothing to start.
  webServer:
    target.mode === 'external'
      ? undefined
      : {
          command: START_APP,
          // Relative to this config file: run from the repository root.
          cwd: '..',
          url: `http://localhost:${E2E_PORT}/api/health`,
          // A server that is already running would be using another database.
          reuseExistingServer: false,
          timeout: SERVER_START_TIMEOUT_MS,
          env: serverEnvironment(),
        },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
