import { expect, test } from '../fixtures/test';
import { routes, sampleTag } from '../utils/routes';
import { sitePages } from '../utils/site-pages';

for (const { route } of sitePages) {
  test(`${route} has exactly one h1`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).not.toBeEmpty();
  });
}

test('favicon and viewport declarations match their content', async ({
  page,
}) => {
  await page.goto('/');
  await expect
    .soft(page.locator('link[rel="icon"]'))
    .toHaveAttribute('type', 'image/png');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    'href',
    '/favicon.png',
  );
  await expect
    .soft(page.locator('meta[name="viewport"]'))
    .toHaveAttribute('content', 'width=device-width, initial-scale=1');
});

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

  for (const path of [
    ...cases.map(({ path }) => path),
    `${routes.about}/`,
    routes.notFound,
    '/404.html',
  ]) {
    test(`${decodeURI(path)} has canonical, social image metadata and RSS discovery`, async ({
      page,
    }) => {
      await page.goto(`${path}?utm_source=metadata`, {
        waitUntil: 'domcontentloaded',
      });
      const head = page.locator('head');
      const is404 = path === routes.notFound || path === '/404.html';
      const canonical = head.locator('link[rel="canonical"]');
      if (is404) {
        await expect.soft(canonical).toHaveCount(0);
      } else {
        await expect.soft(canonical).toHaveAttribute('href', site + path);
        await expect
          .soft(head.locator('meta[property="og:url"]'))
          .toHaveAttribute('content', site + path);
      }
      await expect
        .soft(head.locator('meta[name="twitter:card"]'))
        .toHaveAttribute('content', 'summary_large_image');
      const image =
        cases.find((entry) => entry.path === path)?.image ?? defaultImage;
      const alt =
        image === defaultImage
          ? 'Daiki Sato'
          : await page.locator('main h1').innerText();
      await expect
        .soft(head.locator('meta[property="og:image:alt"]'))
        .toHaveAttribute('content', alt);
      for (const [dimension, value] of [
        ['width', '1200'],
        ['height', '630'],
      ] as const) {
        const meta = head.locator(`meta[property="og:image:${dimension}"]`);
        if (image === defaultImage) {
          await expect.soft(meta).toHaveAttribute('content', value);
        } else {
          await expect.soft(meta).toHaveCount(0);
        }
      }
      await expect
        .soft(head.locator('link[rel="alternate"][type="application/rss+xml"]'))
        .toHaveAttribute('href', site + routes.rss);
      await expect
        .soft(head.locator('link[rel="alternate"][type="application/rss+xml"]'))
        .toHaveAttribute('title', 'Daiki Sato');
    });
  }
});
