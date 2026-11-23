import { expect, test } from '../fixtures/test';

/**
 * 記事ページの目次（TOC）。
 *
 * サンプル記事（`/posts/audio-interface-under-the-desk`）を代表例として TOC の表示、
 * リンククリックによる見出しへの移動、`aria-current="location"` の追従、
 * デスクトップ/モバイルの表示仕様の差異を検証する。
 *
 * デスクトップ・モバイル両方のプロジェクトで実行する。
 */
test.describe('目次 (TOC)', () => {
  const nestedArticle = '/posts/setup-obsidian-livesync';

  test('h3 の目次リンクは本文の ID を参照し h2 より字下げされる', async ({
    articlePage,
    page,
  }) => {
    await page.goto(nestedArticle);

    const headings = articlePage.root.locator('h2, h3');
    await expect(articlePage.toc.links).toHaveText(
      await headings.allTextContents(),
    );
    const subheadings = articlePage.root.getByRole('heading', { level: 3 });
    expect(await subheadings.count()).toBeGreaterThan(0);
    const parentItem = articlePage.toc
      .link('Self-hosted LiveSync')
      .locator('..');
    const parentPadding = await parentItem.evaluate((item) =>
      Number.parseFloat(getComputedStyle(item).paddingLeft),
    );

    for (const heading of await subheadings.all()) {
      const id = (await heading.getAttribute('id')) ?? '';
      expect(id).toBeTruthy();
      const link = articlePage.toc.root.getByRole('link', {
        name: (await heading.textContent()) ?? '',
        exact: true,
      });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', `#${id}`);
      await expect(link).toHaveAttribute('data-toc-id', id);
      const padding = await link
        .locator('..')
        .evaluate((item) =>
          Number.parseFloat(getComputedStyle(item).paddingLeft),
        );
      expect(padding, 'h3 の項目は h2 より字下げされる').toBeGreaterThan(
        parentPadding,
      );
    }
  });

  for (const { name, id, level } of [
    { name: 'Self-hosted LiveSync', id: 'self-hosted-livesync', level: 2 },
    { name: '1. CouchDBの設定', id: '1-couchdbの設定', level: 3 },
  ]) {
    test(`h${level} へのフラグメント付き URL の初期表示で見出しへ移動し current になる`, async ({
      articlePage,
      page,
    }) => {
      await page.goto(`${nestedArticle}#${encodeURIComponent(id)}`);

      const heading = articlePage.root.getByRole('heading', {
        name,
        level,
        exact: true,
      });
      await expect(heading).toHaveAttribute('id', id);
      await expect(heading).toBeInViewport();
      await expect
        .poll(() =>
          heading.evaluate((element) => {
            const top = element.getBoundingClientRect().top;
            const margin = Number.parseFloat(
              getComputedStyle(element).scrollMarginTop,
            );
            return Math.abs(top - margin);
          }),
        )
        .toBeLessThanOrEqual(2);
      await expect(articlePage.toc.currentLink).toHaveCount(1);
      await expect(articlePage.toc.link(name)).toHaveAttribute(
        'aria-current',
        'location',
      );
      await expect(articlePage.toc.link(name).locator('..')).toHaveAttribute(
        'data-target-state',
        'current',
      );
    });
  }

  test('見出しを持つ記事で目次ナビゲーションが表示される', async ({
    articlePage,
  }) => {
    await articlePage.goto();

    await expect(
      articlePage.toc.root,
      '見出しを持つ記事に目次ナビゲーションが表示される',
    ).toBeVisible();
    const headingTexts = await articlePage.sectionHeadings.allTextContents();
    expect(
      headingTexts.length,
      '記事本文に目次の対象となる見出しが 1 件以上ある',
    ).toBeGreaterThan(0);

    // TOC 項目はレンダリングされた本文見出しと一致する。
    await expect(
      articlePage.toc.links,
      `目次に記事本文の見出しと同じ ${headingTexts.length} 件のリンクが表示される`,
    ).toHaveCount(headingTexts.length);
    await expect(
      articlePage.toc.links,
      '目次リンクのテキストが記事本文の見出しと一致する',
    ).toHaveText(headingTexts);
  });

  test('初期状態では最初の見出しが current になる', async ({ articlePage }) => {
    await articlePage.goto();

    await expect(
      articlePage.toc.links.first(),
      'ページ初期表示では最初の目次リンクが current になる',
    ).toHaveAttribute('aria-current', 'location');
    await expect(
      articlePage.toc.links.last(),
      'ページ初期表示では最後の目次リンクが current にならない',
    ).not.toHaveAttribute('aria-current', 'location');
  });

  test('TOC リンクをクリックすると該当見出しへ移動し current が更新される', async ({
    articlePage,
    page,
  }) => {
    await articlePage.goto();

    const linkName = '今回やったこと';
    const link = articlePage.toc.link(linkName);
    const href = await link.getAttribute('href');
    expect(
      href,
      `目次リンク「${linkName}」の href がページ内ハッシュである`,
    ).toMatch(/^#.+/);

    await link.click();

    // ハッシュが URL に反映される（非 ASCII はパーセントエンコードされるので復号して比較）。
    await expect
      .poll(async () => decodeURIComponent(new URL(page.url()).hash), {
        message: `目次リンク「${linkName}」のクリック後は URL ハッシュがリンク先と一致する`,
      })
      .toBe(href);

    // 対象見出しがビューポート内にスクロールされる。
    const id = await link.getAttribute('data-toc-id');
    const heading = page.locator(`[id="${id}"]`);
    await expect(
      heading,
      `目次リンク「${linkName}」のクリック後は対応する見出しがビューポート内に表示される`,
    ).toBeInViewport();

    // クリック（ハッシュ変更）後に対応リンクが current になる。
    await expect(
      articlePage.toc.currentLink,
      `目次リンク「${linkName}」のクリック後は current リンクが 1 件になる`,
    ).toHaveCount(1);
    await expect(
      link,
      `目次リンク「${linkName}」のクリック後はそのリンクが current になる`,
    ).toHaveAttribute('aria-current', 'location');
  });

  test('スクロール位置に応じて current が更新される', async ({
    articlePage,
    page,
  }) => {
    await articlePage.goto();

    // 末尾までスクロールすると最後の見出しが current になる。
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );

    await expect(
      articlePage.toc.links.last(),
      'ページ末尾へのスクロール後は最後の目次リンクが current になる',
    ).toHaveAttribute('aria-current', 'location');
    await expect(
      articlePage.toc.currentLink,
      'ページ末尾へのスクロール後も current リンクが 1 件だけになる',
    ).toHaveCount(1);
  });

  test('デスクトップとモバイルで表示される TOC は1つだけ', async ({
    articlePage,
    page,
  }) => {
    await articlePage.goto();

    // デスクトップ用（sticky サイドバー）とモバイル用（本文内インライン）の 2 つの TOC が
    // DOM 上に存在し、ビューポート幅に応じて一方だけが可視になる。
    // `getByRole('navigation')` は `display:none` の nav をアクセシビリティツリーから
    // 除くため見落とすので、`data-toc-root` 属性で DOM 上の全件を数える。
    const allRoots = page.locator('[data-toc-root]');
    await expect(
      allRoots,
      'デスクトップ用とモバイル用の目次が DOM に 2 件存在する',
    ).toHaveCount(2);
    await expect(
      allRoots.filter({ visible: true }),
      '現在のビューポートに対応する目次だけが 1 件表示される',
    ).toHaveCount(1);
  });
  test('低いウィンドウでもサイドバー目次は画面内に収まり末尾までスクロールできる', async ({
    articlePage,
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'デスクトップのサイドバー目次のみ');

    await page.setViewportSize({ width: 1440, height: 420 });
    await page.goto('/posts/wishlist-2024-04');
    await page.evaluate(() => window.scrollTo(0, 600));

    const toc = articlePage.toc.root;
    await expect(toc).toBeVisible();
    const tocBottom = await toc.evaluate(
      (element) => element.getBoundingClientRect().bottom,
    );
    expect(
      tocBottom,
      'sticky の目次はビューポートの下端からはみ出さない',
    ).toBeLessThanOrEqual(420);

    await toc.hover();
    await page.mouse.wheel(0, 2000);

    await expect(
      articlePage.toc.links.last(),
      '目次上のホイール操作で最後の目次リンクまで表示できる',
    ).toBeInViewport({ ratio: 1 });
  });
});
