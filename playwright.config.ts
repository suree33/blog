import { defineConfig, devices } from '@playwright/test';
const e2ePort = 4322;
const e2eBaseURL = `http://localhost:${e2ePort}/`;
const e2ePreviewCommand = `pnpm run preview --port ${e2ePort}`;
// CI では build-e2e ジョブが `E2E_DRAFT_FIXTURE=true` でビルドした dist/ を配布するため、
// `E2E_PREBUILT=1` のときはビルドを省いて preview だけを起動する。
const e2eServerCommand =
  process.env.E2E_PREBUILT === '1'
    ? e2ePreviewCommand
    : `E2E_DRAFT_FIXTURE=true pnpm run build:ci && ${e2ePreviewCommand}`;

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
  testIgnore: '**/visual-pages.spec.ts',
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
    command: e2eServerCommand,
    url: e2eBaseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
