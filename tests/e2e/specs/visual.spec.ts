import { fileURLToPath } from 'node:url';

import { expect, test } from '../fixtures/test';

const screenshotStylePath = fileURLToPath(
  new URL('../styles/screenshot.css', import.meta.url),
);

const screenshotOptions = {
  animations: 'disabled',
  stylePath: screenshotStylePath,
} as const;

/**
 * ビジュアルリグレッションのスナップショット。
 *
 * フルページではなくコンポーネント/ロケーター単位で撮影し、無関係なコンテンツ変更の
 * 影響を受けにくくする。
 *
 * ビジュアルリグレッションは全 Playwright プロジェクトで実行する。
 * ベースラインはブラウザ・端末・OS ごとに必要になるため、更新時は CI（Linux）基準で
 * 生成・コミットする。
 *
 * 記事メタデータは特に重要な対象。Astro の `compressHTML` でメタデータ内の余白が
 * 潰れた過去のような、空白/レイアウトのリグレッションを検出する。
 *
 * スナップショットは `tests/e2e/specs/visual.spec.ts-snapshots/` にコミットする。
 * 意図的な UI 変更後は `pnpm run test:e2e:update`（または
 * `pnpm run test:e2e -- --update-snapshots`）で再生成する。
 */
test.describe('ビジュアルリグレッション', () => {
  test.beforeEach(async ({ page }) => {
    // システム配色を固定し、テーマトグルアイコン
    // （sun-moon / moon / sun）や prefers-color-scheme スタイルが
    // 実行間で決定的になるようにする。
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('記事メタデータブロック', async ({ articlePage }) => {
    await articlePage.goto();

    await expect(
      articlePage.metadata.root,
      '記事メタデータブロックがビジュアルスナップショットと一致する',
    ).toHaveScreenshot('article-metadata.png', screenshotOptions);
  });

  test('サイトヘッダー', async ({ homePage }) => {
    await homePage.goto();

    await expect(
      homePage.header.root,
      'サイトヘッダーがビジュアルスナップショットと一致する',
    ).toHaveScreenshot('header.png', screenshotOptions);
  });

  test('ホームのサンプル記事リスト項目', async ({ homePage }) => {
    await homePage.goto();

    await expect(
      homePage.postList.sampleArticleLink,
      'ホームのサンプル記事リスト項目がビジュアルスナップショットと一致する',
    ).toHaveScreenshot('home-sample-article-item.png', screenshotOptions);
  });
});
