import { defineConfig, devices } from '@playwright/test';
const e2ePort = 4322;
const e2eBaseURL = `http://localhost:${e2ePort}/`;

/**
 * Astro ブログの Playwright E2E 設定。
 *
 * `astro preview` を起動し、各プロジェクトでスモークテスト、ナビゲーション、
 * テーマ切り替え、ビジュアルリグレッションを検証する。
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e/specs',
  snapshotPathTemplate:
    '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: undefined,
  reporter: process.env.GITHUB_ACTIONS
    ? [['github'], ['list'], ['html']]
    : [['list'], ['html']],
  use: {
    baseURL: e2eBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Desktop
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 10'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 17'] },
    },
    {
      name: 'Mobile Safari (Small screen)',
      use: { ...devices['iPhone SE (3rd gen)'] },
    },
  ],
  webServer: {
    // `build:e2e` はビルド時の外部 HTTP をスタブに置き換えた `astro build`
    // （tests/e2e/support/network-stub.ts を参照）。
    command: `pnpm run build:e2e && pnpm run preview --port ${e2ePort}`,
    url: e2eBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
