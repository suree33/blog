import { expect, test } from '../fixtures/test';
import { escapeRegExp } from '../utils/regex';
import { routes, sampleArticleTitle, sampleTag } from '../utils/routes';
import { listTags } from '../utils/site-pages';

/**
 * タグページ（`/tags/[tag]`）のスモーク確認。
 *
 * 代表タグ（`ガジェット`）はサンプル記事を含む複数記事に付与されており、
 * 安定した検証対象として使う。アサーションは spec 側に置く。
 */
test.describe('タグページ', () => {
  test('代表タグページにアクセスできる', async ({ tagPage, page }) => {
    await tagPage.goto(sampleTag);

    await expect(
      page,
      `タグ「${sampleTag}」のページが /tags/ 配下に表示される`,
    ).toHaveURL(/\/tags\//);
    await expect(
      tagPage.page,
      `タグページのタイトルに「${sampleTag}」とサイト名が含まれる`,
    ).toHaveTitle(new RegExp(`${escapeRegExp(sampleTag)}.*Daiki Sato`));
  });

  test('見出しに対象タグ名が表示される', async ({ tagPage }) => {
    await tagPage.goto(sampleTag);

    await expect(
      tagPage.heading,
      `タグ「${sampleTag}」のページに主要見出しが表示される`,
    ).toBeVisible();
    await expect(
      tagPage.heading,
      `タグページの主要見出しに「${sampleTag}」が含まれる`,
    ).toContainText(sampleTag);
  });

  test('対象タグの記事リンクが表示される', async ({ tagPage }) => {
    await tagPage.goto(sampleTag);

    await expect(
      tagPage.postList.sampleArticleLink,
      `タグ「${sampleTag}」の記事一覧にサンプル記事リンクが表示される`,
    ).toBeVisible();
  });

  test('タグページのリストから記事に遷移できる', async ({ tagPage, page }) => {
    await tagPage.goto(sampleTag);
    await tagPage.postList.sampleArticleLink.click();

    await expect(
      page,
      'タグページのサンプル記事リンクから代表記事 URL に遷移する',
    ).toHaveURL(/\/posts\/audio-interface-under-the-desk\/?$/);
    await expect(
      tagPage.page,
      `タグページから遷移した記事のタイトルに「${sampleArticleTitle}」とサイト名が含まれる`,
    ).toHaveTitle(
      new RegExp(`${escapeRegExp(sampleArticleTitle)}.*Daiki Sato`),
    );
  });
});

test.describe('タグ一覧ページ', () => {
  test('公開中の全タグが一覧に表示される', async ({ tagIndexPage }) => {
    await tagIndexPage.goto();

    await expect(
      tagIndexPage.heading,
      '見出し「タグ一覧」が表示される',
    ).toBeVisible();
    const tags = listTags();
    await expect(
      tagIndexPage.tagLinks,
      '公開中のタグ数だけリンクが並ぶ',
    ).toHaveCount(tags.length);
    for (const tag of tags) {
      await expect(
        tagIndexPage.tagLink(tag),
        `タグ「${tag}」のリンクはエンコード済みのタグページ URL を指す`,
      ).toHaveAttribute(
        'href',
        `${routes.tagsBase}${encodeURIComponent(tag)}/`,
      );
    }
  });

  test('一覧からタグページに遷移できる', async ({
    tagIndexPage,
    tagPage,
    page,
  }) => {
    await tagIndexPage.goto();
    await tagIndexPage.tagLink(sampleTag).click();

    await expect(page, `タグ「${sampleTag}」のページに遷移する`).toHaveURL(
      `${routes.tagsBase}${encodeURIComponent(sampleTag)}/`,
    );
    await expect(tagPage.heading).toContainText(sampleTag);
  });
});

test('記事のタグリンクはエンコード済みのタグページ URL を指す', async ({
  articlePage,
  page,
}) => {
  await articlePage.goto();

  await expect(
    page.getByRole('main').getByRole('link', {
      name: new RegExp(`^${escapeRegExp(sampleTag)}(\\s|$)`),
    }),
    `記事のタグ「${sampleTag}」のリンク先が末尾スラッシュ付きのエンコード済み URL になる`,
  ).toHaveAttribute(
    'href',
    `${routes.tagsBase}${encodeURIComponent(sampleTag)}/`,
  );
});
