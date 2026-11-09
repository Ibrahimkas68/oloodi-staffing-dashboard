/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Use the TypeScript source of @staffing/shared (its "source" export condition), no build step.
  resolve: { conditions: ['source', 'module', 'browser', 'development|production'] },
  ssr: { resolve: { conditions: ['source'], externalConditions: ['source'] } },
  server: {
    port: 5173,
    // In development the API runs on its own port; in production the server serves this app.
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
