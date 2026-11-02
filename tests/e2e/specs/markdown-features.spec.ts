import { type Locator, type Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { routes } from '../utils/routes';

/**
 * Markdown 拡張（Callout、コードタイトル、リンクカード、目次、シンタックスハイライト）の表示確認。
 *
 * これらは Markdown 処理系のプラグインが生成しており、Sätteri への移行でプラグインごと
 * 置き換わる（生成される HTML 構造やクラス名も変わりうる）。移行の前後で同じテストが
 * 通り続けるように、プラグイン固有のクラス名・data 属性には依存せず、表示テキスト、
 * 位置関係、計算済みスタイルなど利用者から見える振る舞いだけを確認する。
 * 見た目の細部はページ全体のビジュアルリグレッション（`visual-pages.spec.ts`）が担当する。
 *
 * レイアウトや CSS（`light-dark()` など）のブラウザ差を検出するため、全プロジェクトで実行する。
 */

/**
 * ビルド時ネットワークスタブ（`tests/e2e/support/network-stub.ts`）が返す og:title の接頭辞。
 *
 * E2E ビルドではリンクカードの OGP 取得がスタブに置き換わり、タイトルは
 * `E2E スタブ: {ホスト名}{パス}` になる。
 */
const STUB_OG_TITLE_PREFIX = 'E2E スタブ: ';

type Theme = 'light' | 'dark';

/** システム配色を固定して再読込する（`localStorage.theme` は設定しない）。 */
async function useSystemTheme(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme });
  await page.reload();
}

/** 要素内の空白以外のテキストに適用されている文字色（重複なし・ソート済み）。 */
async function textColors(locator: Locator): Promise<string[]> {
  return locator.evaluate((element) => {
    const colors = new Set<string>();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent?.trim() && node.parentElement) {
        colors.add(getComputedStyle(node.parentElement).color);
      }
    }
    return [...colors].sort();
  });
}

/** 要素に枠線（いずれかの辺）または背景色があり、周囲から視覚的に区別できるか。 */
async function hasVisibleBoxDecoration(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const isTransparent = (color: string) =>
      color === 'transparent' || /rgba\(.*,\s*0\)$/.test(color);
    const hasBorder = (['Top', 'Right', 'Bottom', 'Left'] as const).some(
      (side) =>
        Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) > 0 &&
        style.getPropertyValue(`border-${side}-style`) !== 'none' &&
        !isTransparent(style.getPropertyValue(`border-${side}-color`)),
    );
    return hasBorder || !isTransparent(style.backgroundColor);
  });
}

async function boxOf(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  expect(box, `${label}の表示領域を取得できる`).not.toBeNull();
  return box as NonNullable<typeof box>;
}

test.describe('Markdown 拡張の表示', () => {
  test.describe('Callout', () => {
    const callouts = [
      {
        route: routes.markdownFeaturesArticle,
        title: 'Info',
        body: 'sidekick.nvim 側で修正されたため、現在はこの問題は解消しています。',
      },
      {
        route: routes.markdownFeaturesArticle,
        title: 'Note',
        body: '2026年3月16日にマージ済',
      },
      {
        route: routes.calloutWarningArticle,
        title: 'Warning',
        body: '本記事を書いた直後にfly.ioのCouchDBサーバは無料ではなくなりました。',
      },
    ];

    for (const { route, title, body } of callouts) {
      test(`${title} の Callout がタイトル付きの枠で表示される`, async ({
        articlePage,
      }) => {
        await articlePage.page.goto(route);
        const { content } = articlePage;

        const calloutTitle = content.calloutTitle(title, body);
        const calloutBody = content.calloutBody(title, body);
        await expect(
          calloutTitle,
          `Callout のタイトル「${title}」が表示される`,
        ).toBeVisible();
        await expect(
          calloutBody,
          `Callout の本文「${body}」が表示される`,
        ).toBeVisible();
        await expect(
          content.root.getByText(/\[![A-Za-z]+\]/),
          'Callout の記法（`[!NOTE]` など）がそのまま表示されていない',
        ).toHaveCount(0);

        const titleBox = await boxOf(calloutTitle, 'Callout のタイトル');
        const bodyBox = await boxOf(calloutBody, 'Callout の本文');
        expect(
          titleBox.y + titleBox.height,
          'Callout のタイトルが本文より上に表示される',
        ).toBeLessThanOrEqual(bodyBox.y + 1);

        expect(
          await hasVisibleBoxDecoration(content.callout(title, body)),
          'Callout が枠線または背景色で本文から区別される',
        ).toBe(true);
        expect(
          await textColors(calloutTitle),
          'Callout のタイトルが本文と異なる色で強調される',
        ).not.toEqual(await textColors(calloutBody));
      });
    }
  });

  test.describe('コードタイトル', () => {
    const codeTitles = [
      {
        title: 'lua/sidekick/config.lua:106',
        code: 'codex = { cmd = { "codex", "--enable"',
        source: 'lua:lua/sidekick/config.lua:106',
      },
      {
        title: 'lua/plugins/sidekick.lua',
        code: '"folke/sidekick.nvim",',
        source: 'lua:lua/plugins/sidekick.lua',
      },
    ];

    for (const { title, code, source } of codeTitles) {
      test(`コードタイトル「${title}」がコードブロックの上に付いて表示される`, async ({
        articlePage,
      }) => {
        await articlePage.page.goto(routes.markdownFeaturesArticle);
        const { content } = articlePage;

        const codeTitle = content.textExact(title);
        const codeBlock = content.codeBlock(code);
        await expect(
          codeTitle,
          `コードタイトル「${title}」が表示される`,
        ).toBeVisible();
        await expect(
          codeBlock,
          'タイトル付きのコードブロックが表示される',
        ).toBeVisible();
        await expect(
          content.root.getByText(source),
          'コードタイトルの記法（`言語:タイトル`）がそのまま表示されていない',
        ).toHaveCount(0);

        const titleBox = await boxOf(codeTitle, 'コードタイトル');
        const blockBox = await boxOf(codeBlock, 'コードブロック');
        const firstLineBox = await boxOf(
          codeBlock.getByText(code).first(),
          'コードの行',
        );
        expect(
          titleBox.y + titleBox.height,
          'コードタイトルがコードより上に表示される',
        ).toBeLessThanOrEqual(firstLineBox.y + 1);
        expect(
          Math.max(0, blockBox.y - (titleBox.y + titleBox.height)),
          'コードタイトルがコードブロックに隙間なく付いている',
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(titleBox.x - blockBox.x),
          'コードタイトルの左端がコードブロックの左端に揃う',
        ).toBeLessThanOrEqual(1);
      });
    }
  });

  test.describe('リンクカード', () => {
    const cardUrl =
      'https://github.com/folke/sidekick.nvim/blob/c2bdf8cfcd87a6be5f8b84322c1b5052e78e302e/lua/sidekick/config.lua#L106';
    const inlineUrl = 'https://github.com/folke/sidekick.nvim/pull/257';

    test('段落に URL だけを書くと、タイトル・ホスト名・画像付きのカードで表示される', async ({
      articlePage,
    }) => {
      await articlePage.page.goto(routes.markdownFeaturesArticle);
      const card = articlePage.content.linkTo(cardUrl);

      await expect(
        card,
        'リンクカードの URL へのリンクが 1 つある',
      ).toHaveCount(1);
      await expect(card, 'リンクカードが表示される').toBeVisible();

      const cardTitle = card.getByText(STUB_OG_TITLE_PREFIX);
      const cardHost = card.getByText('github.com', { exact: true });
      await expect(
        cardTitle,
        'リンクカードにリンク先ページのタイトル（og:title）が表示される',
      ).toBeVisible();
      await expect(
        cardHost,
        'リンクカードにリンク先のホスト名が表示される',
      ).toBeVisible();
      await expect(
        card,
        'リンクカードの表示テキストが URL だけではない',
      ).not.toHaveText(cardUrl);

      const cardTitleBox = await boxOf(cardTitle, 'リンクカードのタイトル');
      const cardHostBox = await boxOf(cardHost, 'リンクカードのホスト名');
      expect(
        cardTitleBox.y + cardTitleBox.height,
        'リンクカードのタイトルとホスト名が別の行に表示される',
      ).toBeLessThanOrEqual(cardHostBox.y + 1);

      const images = card.locator('img');
      await expect(
        images.filter({ visible: true }).first(),
        'リンクカードに画像（OG 画像・favicon）が表示される',
      ).toBeVisible();
      await expect
        .poll(
          () =>
            images.evaluateAll((elements) =>
              (elements as HTMLImageElement[]).every(
                (image) => image.complete && image.naturalWidth > 0,
              ),
            ),
          { message: 'リンクカードの画像がすべて読み込まれる' },
        )
        .toBe(true);
    });

    test('文中の URL はカードにならず、通常のリンクとして表示される', async ({
      articlePage,
    }) => {
      await articlePage.page.goto(routes.markdownFeaturesArticle);
      const { content } = articlePage;
      const calloutBody = content.calloutBody(
        'Info',
        'sidekick.nvim 側で修正されたため',
      );
      const inlineLink = calloutBody.getByRole('link', {
        name: inlineUrl,
        exact: true,
      });

      await expect(
        inlineLink,
        '文中の URL が URL をテキストとするリンクとして表示される',
      ).toBeVisible();
      await expect(
        inlineLink,
        '文中の URL のリンクにはカードの画像が含まれない',
      ).not.toContainText(STUB_OG_TITLE_PREFIX);
      await expect(
        inlineLink.locator('img'),
        '文中の URL のリンクに画像が含まれない',
      ).toHaveCount(0);
    });
  });

  test('目次に本文の見出しが並び、各見出しへのリンクになる', async ({
    articlePage,
  }) => {
    await articlePage.page.goto(routes.markdownFeaturesArticle);
    const { content, toc } = articlePage;

    // 見出しの id（アンカー）は外部から共有される URL の一部なので、生成規則が変わらないことも確認する。
    const expectedEntries = [
      { name: '回避策（workaround）', id: '回避策workaround' },
      { name: '根本的な修正', id: '根本的な修正' },
      { name: '参考', id: '参考' },
    ];

    await expect(toc.root, '目次が表示される').toBeVisible();
    await expect(toc.links, '目次に本文の h2 / h3 が順に並ぶ').toHaveText(
      expectedEntries.map(({ name }) => name),
    );
    await expect(
      content.tocHeadings,
      '本文の h2 / h3 が目次と同じ順で表示される',
    ).toHaveText(expectedEntries.map(({ name }) => name));

    for (const { name, id } of expectedEntries) {
      await expect(
        toc.link(name),
        `目次の「${name}」が見出しのアンカー #${id} へのリンクになる`,
      ).toHaveAttribute('href', `#${id}`);
      await expect(
        content.root.getByRole('heading', { name, exact: true }),
        `見出し「${name}」の id が #${id} になる`,
      ).toHaveAttribute('id', id);
    }
  });

  test('コードブロックがテーマに合わせてシンタックスハイライトされる', async ({
    articlePage,
  }) => {
    await articlePage.page.goto(routes.markdownFeaturesArticle);
    const codeBlock = articlePage.content.codeBlock('"folke/sidekick.nvim",');

    const colorsByTheme: Partial<Record<Theme, string[]>> = {};
    const backgroundByTheme: Partial<Record<Theme, string>> = {};
    for (const theme of ['light', 'dark'] as const) {
      await useSystemTheme(articlePage.page, theme);
      await expect(
        codeBlock,
        `${theme} テーマでコードブロックが表示される`,
      ).toBeVisible();

      const colors = await textColors(codeBlock);
      expect(
        colors.length,
        `${theme} テーマでコードのトークンが 3 色以上で色分けされる`,
      ).toBeGreaterThanOrEqual(3);
      colorsByTheme[theme] = colors;
      backgroundByTheme[theme] = await codeBlock.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
    }

    expect(
      colorsByTheme.dark,
      'ダークテーマではライトテーマと異なる配色でハイライトされる',
    ).not.toEqual(colorsByTheme.light);
    expect(
      backgroundByTheme.dark,
      'ダークテーマではコードブロックの背景色がライトテーマと異なる',
    ).not.toBe(backgroundByTheme.light);
  });
});
