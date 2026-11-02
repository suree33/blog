import { expect, test } from '../fixtures/test';
import { escapeRegExp } from '../utils/regex';
import { posts } from '../utils/site-pages';

/**
 * 全記事の巡回。
 *
 * Markdown 処理系の移行などで一部の記事だけが壊れる（ビルドから漏れる、記事レイアウトが
 * 適用されない、タイトルが出ない）ことを検出するため、`src/pages/posts/*.md` から
 * 列挙した全記事について次を確認する。
 *
 * - HTTP 200 で返る
 * - 記事レイアウト（`MarkdownPostLayout`）が適用されている: ページタイトル、ヘッダー、
 *   フッター、`<article>`、公開日、本文の見出しに対応する目次
 * - `<h1>` に frontmatter の `title` が表示される
 *
 * 記事の列挙は `utils/site-pages.ts` を `visual-pages.spec.ts` と共有する（列挙結果が
 * sitemap と一致することは `visual-pages.spec.ts` が検証する）。表示の細部はページ全体の
 * ビジュアルリグレッションに任せ、ここではブラウザごとの差が出にくい構造的な確認だけを
 * 行うため、デスクトップ（`chromium`）とモバイル（`Mobile Chrome`）の 2 プロジェクトで
 * 実行する。モバイルでは目次が本文内に、デスクトップではサイドバーに表示されるため、
 * 両方の配置を確認できる。
 */
test.describe('全記事の巡回', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName !== 'chromium',
      '全記事の巡回は chromium / Mobile Chrome のみで実行',
    );
  });

  for (const post of posts) {
    test(`記事 ${post.slug} が記事レイアウトで表示される`, async ({
      articlePage,
    }) => {
      const response = await articlePage.page.goto(post.route);

      expect(response?.status(), `${post.route} が HTTP 200 で返る`).toBe(200);
      await expect(
        articlePage.page,
        `ページタイトルが「${post.title} — Daiki Sato」になる`,
      ).toHaveTitle(new RegExp(`^${escapeRegExp(post.title)} — Daiki Sato$`));

      await expect(
        articlePage.header.root,
        'サイト共通のヘッダーが表示される',
      ).toBeVisible();
      await expect(
        articlePage.footer.root,
        'サイト共通のフッターが表示される',
      ).toBeVisible();
      await expect(
        articlePage.root,
        '記事本文が 1 つの <article> として表示される',
      ).toHaveCount(1);
      await expect(articlePage.root, '<article> が表示される').toBeVisible();

      const heading = articlePage.root.getByRole('heading', {
        level: 1,
        name: post.title,
        exact: true,
      });
      await expect(
        heading,
        `<article> 内に記事タイトル「${post.title}」の <h1> が表示される`,
      ).toBeVisible();
      await expect(
        articlePage.root.getByRole('heading', { level: 1 }),
        '<article> 内の <h1> は記事タイトルの 1 つだけ',
      ).toHaveCount(1);

      await expect(
        articlePage.metadata.pubDate,
        '記事メタデータに公開日が表示される',
      ).toBeVisible();

      const sectionHeadingTexts =
        await articlePage.content.tocHeadings.allInnerTexts();
      if (sectionHeadingTexts.length === 0) {
        await expect(
          articlePage.page.getByRole('navigation', { name: '目次' }),
          '本文に h2 / h3 がない記事では目次を表示しない',
        ).toHaveCount(0);
      } else {
        await expect(
          articlePage.toc.root,
          '本文に h2 / h3 がある記事では目次が表示される',
        ).toBeVisible();
        await expect(
          articlePage.toc.links,
          '目次に本文の h2 / h3 と同じ項目が同じ順で並ぶ',
        ).toHaveText(sectionHeadingTexts.map((text) => text.trim()));
      }
    });
  }
});
