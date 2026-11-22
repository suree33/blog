import { expect, test } from '../fixtures/test';
import { routes, sampleTag } from '../utils/routes';

const site = 'https://sur33.com';
const defaultImage = '/ogimage/ogimage-default.png';
const defaultDescription = 'Daiki Satoのブログ';

const cases = [
  {
    path: routes.home,
    image: defaultImage,
    description: defaultDescription,
  },
  {
    path: `${routes.articleWithoutCodeBlock}/`,
    image: defaultImage,
    description: defaultDescription,
  },
  {
    path: '/posts/setup-obsidian-livesync/',
    image: '/ogimage/setup-obsidian-livesync.png',
    description:
      'Obsidian公式のSyncは高いので、コミュニティプラグインのSelf-hosted LiveSyncを使って同期、Obsidian Gitでバックアップするようにしてみました。',
  },
  {
    path: '/posts/remark-link-card-with-astro/',
    image: '/ogimage/remark-link-card-with-astro.og.png',
    description:
      'Astroで、remarkプラグインであるremark-link-cardを使いリンクをカード形式で表示できるようにしました。',
  },
  {
    path: routes.tagsBase,
    image: defaultImage,
    description: 'ブログ記事に付いているタグの一覧です。',
  },
  {
    path: `${routes.tagsBase}${encodeURIComponent(sampleTag)}/`,
    image: defaultImage,
    description: `${sampleTag}のタグが付いた記事の一覧です。`,
  },
];

const openGraphTypes = [
  [routes.home, 'website'],
  [`${routes.about}/`, 'website'],
  [routes.tagsBase, 'website'],
  [`${routes.tagsBase}${encodeURIComponent(sampleTag)}/`, 'website'],
  [routes.notFound, 'website'],
  [`${routes.sampleArticle}/`, 'article'],
] as const;

test.describe('ページのメタデータ', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
    '静的 HTML のメタデータ検証はデスクトップ Chromium のみで実行',
  );

  for (const { path, image, description } of cases) {
    test(`${decodeURI(path)} の OGP と説明文が正しい`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const head = page.locator('head');
      await expect(head.locator('meta[property="og:url"]')).toHaveAttribute(
        'content',
        site + path,
      );
      await expect(head.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        description,
      );
      await expect(
        head.locator('meta[property="og:description"]'),
      ).toHaveAttribute('content', description);
      await expect(head.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        site + image,
      );
    });
  }

  for (const [path, type] of openGraphTypes) {
    test(`${decodeURI(path)} の OGP の種別と言語が正しい`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const head = page.locator('head');
      await expect
        .soft(head.locator('meta[property="og:type"]'), `og:type は ${type}`)
        .toHaveAttribute('content', type);
      await expect(
        head.locator('meta[property="og:locale"]'),
        'og:locale は ja_JP',
      ).toHaveAttribute('content', 'ja_JP');
    });
  }
});
