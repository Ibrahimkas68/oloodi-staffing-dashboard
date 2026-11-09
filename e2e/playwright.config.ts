import { defineConfig, devices } from '@playwright/test';
import { E2E_PORT, e2eEnvironment } from './env.js';

const SERVER_START_TIMEOUT_MS = 120_000;

// One command, in order: the database must exist before the server starts, and the web app must be
// built before the server can serve it.
const START_APP = [
  'npx tsx e2e/prepare-db.ts',
  'npm run build -w @staffing/web',
  'npm run start -w @staffing/server',
].join(' && ');

export default defineConfig({
  testDir: './tests',
  // Tests share one database and one live hub, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    // Always the server this config starts, so the database that gets reset is the one under test.
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: START_APP,
    // Relative to this config file: run from the repository root.
    cwd: '..',
    url: `http://localhost:${E2E_PORT}/api/health`,
    // A server that is already running would be using another database.
    reuseExistingServer: false,
    timeout: SERVER_START_TIMEOUT_MS,
    env: {
      ...e2eEnvironment(),
      PORT: String(E2E_PORT),
      LOG_LEVEL: 'warn',
      RATE_LIMIT_PER_MINUTE: '10000',
      DEMO_MODE: 'false',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
