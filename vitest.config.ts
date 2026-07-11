import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Playwright specs live in e2e/ and use @playwright/test, not vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
