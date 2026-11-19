import { readdirSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { load } from 'cheerio';
import { expect, test } from '../fixtures/test';
import { routes, sampleArticleTitle } from '../utils/routes';

const pagesDir = new URL('../../../src/pages/', import.meta.url);
const publishedPosts = readdirSync(pagesDir, {
  recursive: true,
  withFileTypes: true,
})
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .flatMap((entry) => {
    const file = `${entry.parentPath}/${entry.name}`;
    const { frontmatter, content } = parseFrontmatter(
      readFileSync(file, 'utf8'),
    );
    if (!frontmatter.title || !frontmatter.pubDate) return [];
    return [
      {
        title: String(frontmatter.title),
        // Astro と同じ YAML パーサーを使い、日付のみの値も UTC のまま比較する。
        pubDate: new Date(frontmatter.pubDate).toUTCString(),
        route: relative(fileURLToPath(pagesDir), file)
          .replace(/\.md$/, '')
          .replace(/(^|\/)index$/, ''),
        imageCount: [...content.matchAll(/!\[[^\]]*\]\([^)]+\)/g)].length,
      },
    ];
  });

/**
 * `/rss.xml` RSS フィードの E2E 検証。
 *
 * RSS はブラウザ描画ではなく XML 応答のため、ビューポートやブラウザエンジンに
 * 依存しない。重複実行を避けるため Chromium 1 プロジェクトのみで実行する。
 *
 * 期待仕様（`src/pages/rss.xml.ts` 参考）:
 * - `@astrojs/rss` が `Content-Type: application/xml` で応答する。
 * - `<channel>` に `config.siteName`・`config.description`・`<language>ja-jp</language>` が含まれる。
 * - 各 `<item>` は `title` と `pubDate` frontmatter を持つ記事のみ（`hasRequiredFrontmatter`）。
 *   `title` または `pubDate` が未設定の記事（例: 記事テンプレート）はフィードから除外される。
 *   本リポジトリに draft 扱いは存在せず、上記 frontmatter 条件のみで絞り込む。
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

  test('公開記事の集合が一致し全記事に本文と正しい RFC 822 公開日がある', async ({
    rssFeedPage,
  }) => {
    const { items } = await rssFeedPage.content();
    const routeOf = (link: string) =>
      decodeURI(new URL(link).pathname).replace(/^\/|\/$/g, '');
    expect(publishedPosts.length, 'ソースに公開記事が存在する').toBeGreaterThan(
      0,
    );
    expect(
      items.map((item) => routeOf(item.link)).sort(),
      'RSS の記事集合が title と pubDate を持つソースの記事集合と一致する',
    ).toEqual(publishedPosts.map((post) => post.route).sort());
    for (const post of publishedPosts) {
      const item = items.find((item) => routeOf(item.link) === post.route);
      if (!item) throw new Error(`${post.route} が RSS にありません`);
      expect(item.title, `${post.route} のタイトルが一致する`).toBe(post.title);
      expect(
        item.content.trim(),
        `${post.route} に content:encoded 本文がある`,
      ).not.toBe('');
      expect(
        item.pubDate,
        `${post.route} の公開日が RFC 822 形式である`,
      ).toMatch(
        /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/,
      );
      expect(
        Number.isNaN(Date.parse(item.pubDate)),
        `${post.route} の公開日が有効である`,
      ).toBe(false);
      expect(
        item.pubDate,
        `${post.route} の公開日が frontmatter と一致する`,
      ).toBe(post.pubDate);
    }
  });

  test('全記事の本文から危険な HTML が除去され意味のある本文が残る', async ({
    rssFeedPage,
  }) => {
    const { items } = await rssFeedPage.content();
    for (const item of items) {
      const $ = load(item.content);
      expect(
        $(
          'script, style, iframe, object, embed, form, input, svg, math, base, meta, link',
        ).length,
        `${item.title} に危険な要素がない`,
      ).toBe(0);
      for (const element of $('*').toArray()) {
        if (!('attribs' in element)) continue;
        for (const [name, value] of Object.entries(element.attribs)) {
          expect(name, `${item.title} にイベント属性がない`).not.toMatch(
            /^on/i,
          );
          expect(name, `${item.title} に埋め込み HTML 属性がない`).not.toBe(
            'srcdoc',
          );
          if (
            [
              'href',
              'src',
              'action',
              'formaction',
              'xlink:href',
              'poster',
              'background',
            ].includes(name)
          ) {
            expect(
              Array.from(value)
                .filter((char) => char.charCodeAt(0) > 32 && !/\s/.test(char))
                .join(''),
              `${item.title} に危険な URL がない`,
            ).not.toMatch(/^(javascript|vbscript|data):/i);
          }
        }
      }
    }
    const sample = items.find(
      (item) =>
        new URL(item.link).pathname.replace(/\/$/, '') ===
        routes.articleWithCodeBlock,
    );
    if (!sample) throw new Error('代表記事が RSS にありません');
    const $ = load(sample.content);
    expect($('h2').text(), '見出しが残る').toContain('回避策（workaround）');
    expect($('p').text(), '段落が残る').toContain(
      'というエラーが表示されます。',
    );
    expect(
      $('a[href="https://github.com/folke/sidekick.nvim/"]').first().text(),
      'リンクが残る',
    ).toBe('sidekick.nvim');
    expect($('pre code').text(), 'コードが残る').toContain(
      'codex = { cmd = { "codex", "--enable", "web_search_request" } },',
    );
  });

  test('記事の画像が絶対 URL 付きで本文に残る', async ({ rssFeedPage }) => {
    const { items } = await rssFeedPage.content();
    const imagePosts = publishedPosts.filter((post) => post.imageCount > 0);
    expect(imagePosts.length, '画像を含む公開記事が存在する').toBeGreaterThan(
      0,
    );
    for (const post of imagePosts) {
      const item = items.find(
        (item) =>
          decodeURI(new URL(item.link).pathname).replace(/^\/|\/$/g, '') ===
          post.route,
      );
      if (!item) throw new Error(`${post.route} が RSS にありません`);
      const $ = load(item.content);
      expect(
        $('img').length,
        `${post.route} の Markdown 画像が残る`,
      ).toBeGreaterThanOrEqual(post.imageCount);
      for (const image of $('img').toArray()) {
        expect(
          $(image).attr('src'),
          `${post.route} の画像 src が絶対 HTTP URL である`,
        ).toMatch(/^https?:\/\//);
        expect(
          () => new URL($(image).attr('src') ?? ''),
          `${post.route} の画像 URL が有効である`,
        ).not.toThrow();
      }
    }
  });

  test('XML スタイルシート処理命令があり XSL を取得できる', async ({
    rssFeedPage,
  }) => {
    const { stylesheet } = await rssFeedPage.content();
    expect(stylesheet, '処理命令が XSL を指定する').toMatch(
      /type=["']text\/xsl["']/,
    );
    const href = /href=["']([^"']+)["']/.exec(stylesheet)?.[1];
    expect(href, '処理命令が RSS スタイルシートを指定する').toBe(
      '/rss/styles.xsl',
    );
    if (!href) throw new Error('スタイルシートの href がありません');
    const response = await rssFeedPage.request.get(href);
    expect(response.status(), 'XSL URL が 200 を返す').toBe(200);
    const $ = load(await response.text(), { xml: true });
    expect(
      $('xsl\\:stylesheet').attr('xmlns:xsl'),
      '応答が XSLT スタイルシートである',
    ).toBe('http://www.w3.org/1999/XSL/Transform');
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
