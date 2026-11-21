import { defineConfig } from '@playwright/test';
import config, { e2ePort } from './playwright.config';

export default defineConfig({
  ...config,
  testMatch: '**/visual-pages.spec.ts',
  testIgnore: [],
  snapshotPathTemplate:
    '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}',
  updateSnapshots: 'none',
  workers: 2,
  retries: 0,
  use: { ...config.use, locale: 'ja-JP', timezoneId: 'UTC' },
  projects: config.projects?.filter((project) =>
    ['chromium', 'Mobile Chrome'].includes(project.name ?? ''),
  ),
  webServer: {
    ...config.webServer,
    command: `pnpm run build:e2e && pnpm run preview --port ${e2ePort}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
