import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
