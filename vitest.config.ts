/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['src/lib/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    server: {
      deps: { inline: ['remark-link-card-plus'] },
    },
  },
});
