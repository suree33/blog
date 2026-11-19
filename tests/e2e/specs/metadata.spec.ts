import { expect, test } from '../fixtures/test';
import { routes } from '../utils/routes';

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
];

test.describe('ページのメタデータ', () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
    '静的 HTML のメタデータ検証はデスクトップ Chromium のみで実行',
  );

  for (const { path, image, description } of cases) {
    test(`${path} の OGP と説明文が正しい`, async ({ page }) => {
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
});
