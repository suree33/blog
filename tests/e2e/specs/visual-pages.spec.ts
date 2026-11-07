import { fileURLToPath } from 'node:url';
import { type Page, type TestInfo } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { sitePages } from '../utils/site-pages';

const screenshotStylePath = fileURLToPath(
  new URL('../styles/screenshot-pages.css', import.meta.url),
);

type Theme = 'light' | 'dark';

/**
 * プロジェクトごとに撮影するテーマ。
 *
 * ベースラインのサイズを抑えるため、デスクトップは `chromium`（ライト/ダーク）、
 * モバイルは `Mobile Chrome`（ライト）に限定する。ダークは Shiki の
 * `light-dark()` 配色や Callout のダーク用スタイルを検出するために撮影する。
 */
const THEMES_BY_PROJECT: Partial<Record<string, readonly Theme[]>> = {
  chromium: ['light', 'dark'],
  'Mobile Chrome': ['light'],
};
const THEMES = ['light', 'dark'] as const satisfies readonly Theme[];

function isLocalUrl(url: string): boolean {
  const { protocol, hostname } = new URL(url);
  if (protocol === 'data:' || protocol === 'blob:') {
    return true;
  }
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function skipUnsupportedTheme(testInfo: TestInfo, theme: Theme): void {
  test.skip(
    !THEMES_BY_PROJECT[testInfo.project.name]?.includes(theme),
    'ページ全体のビジュアルリグレッションは chromium（ライト/ダーク）と Mobile Chrome（ライト）のみで実行',
  );
}

/**
 * 遅延読み込み画像を含むすべての画像を読み込み、デコードとフォントの読み込みを待つ。
 *
 * @returns 読み込みに失敗した画像の `src` 一覧
 */
async function loadAllImagesAndFonts(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const images = [...document.images];
    for (const image of images) {
      image.loading = 'eager';
    }
    await Promise.all(
      images.map(async (image) => {
        if (!image.complete) {
          await new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      }),
    );
    await document.fonts.ready;
    return images
      .filter((image) => image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src);
  });
}

/**
 * サイト全体（全ページ）のフルページ・ビジュアルリグレッション。
 *
 * Markdown 処理系の移行などで「画面での表示が変わらない」ことを確認するために、
 * ホーム、About、Dreamhouse、全記事、全タグページ、404 をフルページで撮影する。
 * 記事とタグは `utils/site-pages.ts` がソースから列挙する。
 *
 * 決定性のための対策:
 * - ビルド時の外部 HTTP（リンクカードの OGP・画像取得など）は
 *   `tests/e2e/support/network-stub.ts` が合成レスポンスに置き換える
 * - ブラウザからの localhost 以外へのリクエスト（Google Analytics / Partytown など）は
 *   中断し、Service Worker も無効化する
 * - テーマはサイトの仕組み（`localStorage.theme`）とシステム配色の両方で固定する
 * - 遅延読み込み画像も含めて全画像とフォントの読み込みを待ち、アニメーションを無効化する
 * - フォントは `styles/screenshot-pages.css` で Noto Sans CJK JP / Noto Sans Mono CJK JP に固定する
 *
 * スナップショットは `tests/e2e/specs/visual-pages.spec.ts-snapshots/` にコミットする。
 * 記事やタグを追加したら `pnpm run test:e2e:update` でベースラインを追加する。
 */
test.describe('ページ全体のビジュアルリグレッション', () => {
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ context }) => {
    await context.route('**/*', async (route) => {
      if (isLocalUrl(route.request().url())) {
        await route.continue();
      } else {
        await route.abort('blockedbyclient');
      }
    });
  });

  test('撮影対象のページ一覧が sitemap と一致する', async ({
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'ページ一覧の検証はブラウザに依存しないため chromium のみで実行',
    );

    const index = await (await request.get('/sitemap-index.xml')).text();
    const sitemapUrls = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1] ?? '').pathname,
    );
    const sitemapRoutes: string[] = [];
    for (const sitemapUrl of sitemapUrls) {
      const sitemap = await (await request.get(sitemapUrl)).text();
      for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        sitemapRoutes.push(new URL(match[1] ?? '').pathname);
      }
    }

    const normalize = (route: string) =>
      decodeURIComponent(route).replace(/(.)\/$/, '$1');

    expect(
      sitemapRoutes.map(normalize).sort(),
      'sitemap に載る全ページがページ全体のビジュアルリグレッションの撮影対象に含まれる',
    ).toEqual(
      sitePages
        .filter((sitePage) => sitePage.inSitemap)
        .map((sitePage) => normalize(sitePage.route))
        .sort(),
    );
  });

  for (const sitePage of sitePages) {
    for (const theme of THEMES) {
      test(`${sitePage.label}（${theme}）`, async ({ page }, testInfo) => {
        skipUnsupportedTheme(testInfo, theme);

        await page.addInitScript((storedTheme) => {
          window.localStorage.setItem('theme', storedTheme);
        }, theme);
        await page.emulateMedia({ colorScheme: theme });
        await page.goto(sitePage.route);

        await expect(
          page.locator('html'),
          `<html> に ${theme} テーマのクラスが適用されている`,
        ).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));

        const brokenImages = await loadAllImagesAndFonts(page);
        expect(
          brokenImages,
          'ページ内のすべての画像が読み込まれている',
        ).toEqual([]);

        const directories = sitePage.snapshotPath.slice(0, -1);
        const name = sitePage.snapshotPath.at(-1);
        await expect(
          page,
          `${sitePage.label}（${theme}）のページ全体がビジュアルスナップショットと一致する`,
        ).toHaveScreenshot([...directories, `${name}-${theme}.png`], {
          fullPage: true,
          animations: 'disabled',
          stylePath: screenshotStylePath,
        });
      });
    }
  }
});
