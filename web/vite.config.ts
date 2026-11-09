/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { conditions: ['source'] },
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
