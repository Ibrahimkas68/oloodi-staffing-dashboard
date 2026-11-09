import { defineConfig } from 'vitest/config';

// Playwright owns ./tests; the plain unit tests live in ./unit so the two runners never collide.
export default defineConfig({ test: { include: ['unit/**/*.test.ts'] } });
