import AxeBuilder from '@axe-core/playwright';
import { type Page, type TestInfo } from '@playwright/test';
import { expect, test } from '../fixtures/test';

const SUPPORTED_PROJECTS = new Set(['chromium', 'Mobile Chrome']);
const MOBILE_PROJECT = 'Mobile Chrome';
const THEMES = ['light', 'dark'] as const;
const BLOCKING_IMPACTS = ['serious', 'critical'] as const;

type Theme = (typeof THEMES)[number];
type BlockingImpact = (typeof BLOCKING_IMPACTS)[number];
type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type AxeTarget = AxeResults['violations'][number]['nodes'][number]['target'];

interface BlockingViolation {
  theme: Theme;
  ruleId: string;
  impact: BlockingImpact;
  target: AxeTarget;
}

interface ScanPageOptions {
  page: Page;
  testInfo: TestInfo;
  goto: () => Promise<void>;
  openMobileMenu: () => Promise<void>;
}

function skipUnsupportedProject(testInfo: TestInfo): void {
  test.skip(
    !SUPPORTED_PROJECTS.has(testInfo.project.name),
    'axe検査はchromiumとMobile Chromeのみで実行',
  );
}

function isBlockingImpact(
  impact: string | null | undefined,
): impact is BlockingImpact {
  return BLOCKING_IMPACTS.some((candidate) => candidate === impact);
}

async function scanPageForAccessibility({
  page,
  testInfo,
  goto,
  openMobileMenu,
}: ScanPageOptions): Promise<void> {
  const blockingViolations: BlockingViolation[] = [];
  const isMobile = testInfo.project.name === MOBILE_PROJECT;

  for (const theme of THEMES) {
    await page.emulateMedia({ colorScheme: theme });
    await goto();

    if (isMobile) {
      await openMobileMenu();
    }

    const results = await new AxeBuilder({ page }).analyze();

    await testInfo.attach(`axe-results-${theme}.json`, {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    });

    for (const violation of results.violations) {
      const { impact } = violation;
      if (!isBlockingImpact(impact)) {
        continue;
      }

      for (const node of violation.nodes) {
        blockingViolations.push({
          theme,
          ruleId: violation.id,
          impact,
          target: node.target,
        });
      }
    }
  }

  expect(
    blockingViolations,
    'serious または critical のアクセシビリティ違反が存在しない',
  ).toEqual([]);
}

test.describe('axe-coreアクセシビリティ検査', () => {
  test('ホーム', async ({ homePage }, testInfo) => {
    skipUnsupportedProject(testInfo);

    await scanPageForAccessibility({
      page: homePage.page,
      testInfo,
      goto: () => homePage.goto(),
      openMobileMenu: () => homePage.header.openMobileMenu(),
    });
  });

  test('About', async ({ aboutPage }, testInfo) => {
    skipUnsupportedProject(testInfo);

    await scanPageForAccessibility({
      page: aboutPage.page,
      testInfo,
      goto: () => aboutPage.goto(),
      openMobileMenu: () => aboutPage.header.openMobileMenu(),
    });
  });

  test('代表記事', async ({ articlePage }, testInfo) => {
    skipUnsupportedProject(testInfo);

    await scanPageForAccessibility({
      page: articlePage.page,
      testInfo,
      goto: () => articlePage.goto(),
      openMobileMenu: () => articlePage.header.openMobileMenu(),
    });
  });

  test('タグ一覧', async ({ tagIndexPage }, testInfo) => {
    skipUnsupportedProject(testInfo);

    await scanPageForAccessibility({
      page: tagIndexPage.page,
      testInfo,
      goto: () => tagIndexPage.goto(),
      openMobileMenu: () => tagIndexPage.header.openMobileMenu(),
    });
  });
});
