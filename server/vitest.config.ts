import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { conditions: ['source'] },
  test: {
    include: ['tests/**/*.test.ts'],
    // API and concurrency tests share one real PostgreSQL database, so files run one at a time.
    fileParallelism: false,
    passWithNoTests: true,
    // The global setup that resets the test database is added with the test helpers (T033).
  },
});
