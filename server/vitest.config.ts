import { defineConfig } from 'vitest/config';
import { testEnv } from './tests/test-env.js';

export default defineConfig({
  // Use the TypeScript source of @staffing/shared (its "source" export condition), no build step.
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'], externalConditions: ['source'] } },
  test: {
    include: ['tests/**/*.test.ts'],
    // API and concurrency tests share one real PostgreSQL database, so files run one at a time.
    fileParallelism: false,
    passWithNoTests: true,
    env: testEnv(),
    globalSetup: ['./tests/global-setup.ts'],
  },
});
