import { expect, test } from '../fixtures/test';
import { routes, sampleArticleTitle } from '../utils/routes';

/**
 * `/rss.xml` RSS フィードの E2E 検証。
 *
 * RSS はブラウザ描画ではなく XML 応答のため、ビューポートやブラウザエンジンに
 * 依存しない。重複実行を避けるため Chromium 1 プロジェクトのみで実行する。
 *
 * 期待仕様（`src/pages/rss.xml.ts` 参考）:
 * - `@astrojs/rss` が `Content-Type: application/xml` で応答する。
 * - `<channel>` に `config.siteName`・`config.description`・`<language>ja-jp</language>` が含まれる。
 * - 公開記事と既存の standalone Markdown ページを含む。draft とテンプレートは除外する。
 */
test.describe('RSS フィード', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'XML 応答ベースの検証のため Chromium 1 プロジェクトのみで実行',
    );
  });

  test.beforeEach(async ({ rssFeedPage }) => {
    await rssFeedPage.goto();
  });

  test('/rss.xml が 200 で XML の content-type を返す', async ({
    rssFeedPage,
  }) => {
    expect(
      rssFeedPage.response.status(),
      'RSS フィード URL は HTTP 200 を返す',
    ).toBe(200);
    expect(
      rssFeedPage.response.headers()['content-type'],
      'RSS フィード応答の content-type は XML 形式である',
    ).toMatch(/xml/i);
  });

  test('チャネルにサイト名と説明と言語が含まれる', async ({ rssFeedPage }) => {
    const feed = await rssFeedPage.content();

    expect(feed.siteName, 'RSS チャネルにサイト名が設定される').toBe(
      'Daiki Sato',
    );
    expect(feed.description, 'RSS チャネルにサイトの説明が設定される').toBe(
      'Daiki Satoのブログ',
    );
    expect(feed.language, 'RSS チャネルの言語が日本語に設定される').toBe(
      'ja-jp',
    );
  });

  test('代表記事のタイトルとリンクが含まれる', async ({ rssFeedPage }) => {
    const feed = await rssFeedPage.content();

    const sample = feed.items.find((item) => item.title === sampleArticleTitle);
    expect(
      sample,
      `RSS フィードに代表記事「${sampleArticleTitle}」が含まれる`,
    ).toBeTruthy();
    // ホスト・末尾スラッシュの差異に依存しないようパスで部分一致させる。
    expect(
      sample?.link,
      `RSS フィードの代表記事リンクにパス「${routes.sampleArticle}」が含まれる`,
    ).toContain(routes.sampleArticle);
  });

  test('frontmatter 不足の記事はフィードから除外される', async ({
    rssFeedPage,
  }) => {
    const { items } = await rssFeedPage.content();

    expect(
      items.length,
      'RSS フィードに記事が 1 件以上含まれる',
    ).toBeGreaterThan(0);
    // hasRequiredFrontmatter (title + pubDate) を通過した記事だけが並ぶため、
    // 全 item が title・link を持つ。
    for (const item of items) {
      expect(
        item.title,
        `RSS item (${item.link}) のタイトルが空でない`,
      ).not.toBe('');
      expect(item.link, `RSS item「${item.title}」のリンクが空でない`).not.toBe(
        '',
      );
    }
    // 記事テンプレート (title 未設定) はフィードに出現しない。
    expect(
      items.some((item) => item.link.includes('/template/')),
      '記事テンプレートが RSS フィードから除外される',
    ).toBe(false);
  });
});
