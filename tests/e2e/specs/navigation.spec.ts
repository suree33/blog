import { expect, test } from '../fixtures/test';
import { HOME_URL_REGEX } from '../utils/regex';
import { routes } from '../utils/routes';

/**
 * ヘッダーとフッターのナビゲーションリンク。
 *
 * ヘッダーのナビリンクは小さいビューポートではモバイルメニュー内に隠れるため、
 * モバイルではハンバーガーメニューを開いてから操作する。
 * フッターのリンクはどのビューポートでも常に表示される。
 * デスクトップ・モバイル両方のプロジェクトで実行する。
 */
test.describe('ナビゲーション', () => {
  for (const route of [routes.home, routes.sampleArticle]) {
    test(`skip link moves keyboard focus to main on ${route}`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.keyboard.press('Tab');
      const skipLink = page.getByRole('link', { name: '本文へスキップ' });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeInViewport();
      await expect(skipLink).toBeVisible();
      const skipBox = await skipLink.boundingBox();
      expect(skipBox).not.toBeNull();
      for (const link of await page.locator('header a').all()) {
        if (!(await link.isVisible())) continue;
        const box = await link.boundingBox();
        expect(box).not.toBeNull();
        if (skipBox && box) {
          expect(
            skipBox.x < box.x + box.width &&
              skipBox.x + skipBox.width > box.x &&
              skipBox.y < box.y + box.height &&
              skipBox.y + skipBox.height > box.y,
            `skip link must not overlap ${await link.getAttribute('href')}`,
          ).toBe(false);
        }
      }
      await page.keyboard.press('Enter');
      await expect(page.locator('main#main-content')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('main :focus')).toBeVisible();
      await expect
        .poll(async () => {
          const focused = await page.locator('main :focus').boundingBox();
          const header = await page.locator('header').boundingBox();
          return focused && header
            ? focused.y - (header.y + header.height)
            : -1;
        })
        .toBeGreaterThanOrEqual(0);
    });
  }

  test('モバイルメニューを開いている間はTab/Shift+Tabのフォーカスをメニュー内に留める', async ({
    homePage,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await homePage.goto();
    await homePage.header.openMobileMenu();

    const hamburger = homePage.header.root.locator('.hamburger');
    const controls = page.locator('.sm-menu').locator('a[href], button');
    await hamburger.focus();
    for (const control of await controls.all()) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(hamburger).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(controls.last()).toBeFocused();
  });

  test('Escapeでモバイルメニューを閉じてハンバーガーボタンにフォーカスを戻す', async ({
    homePage,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await homePage.goto();

    const hamburger = homePage.header.root.locator('.hamburger');
    for (let cycle = 0; cycle < 2; cycle++) {
      await homePage.header.openMobileMenu();
      await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
      await homePage.header.aboutLink.focus();
      await page.keyboard.press('Escape');

      await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.hamburger-toggle[data-active]')).toHaveCount(
        0,
      );
      await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
      await expect(hamburger).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('.sm-menu :focus')).toHaveCount(0);
    }
  });

  test('ヘッダーとフッターのナビゲーションを名前で区別できる', async ({
    homePage,
    isDesktop,
  }) => {
    await homePage.goto();
    if (!isDesktop) {
      await homePage.header.openMobileMenu();
    }

    await expect
      .soft(homePage.header.root.getByRole('navigation'))
      .toHaveAccessibleName('ヘッダー');
    await expect
      .soft(homePage.footer.root.getByRole('navigation'))
      .toHaveAccessibleName('フッター');
  });

  test('画面幅を広げるとモバイルメニューを閉じて本文スクロールを復元する', async ({
    homePage,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await homePage.goto();

    const body = page.locator('body');
    const hamburger = homePage.header.root.locator('.hamburger');
    await homePage.header.openMobileMenu();
    await expect(body).toHaveCSS('overflow', 'hidden');

    await page.setViewportSize({ width: 1280, height: 600 });

    await expect(body).not.toHaveCSS('overflow', 'hidden');
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(hamburger).not.toHaveAttribute('data-active');
    await expect(page.locator('.hamburger-toggle[data-active]')).toHaveCount(0);
    await page.evaluate(() => window.scrollBy(0, 300));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);

    await page.setViewportSize({ width: 390, height: 600 });
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    await homePage.header.openMobileMenu();
    await expect(body).toHaveCSS('overflow', 'hidden');
    await hamburger.click();
    await expect(body).not.toHaveCSS('overflow', 'hidden');
  });

  test('モバイルメニューの開閉で本文スクロールをロック・復元する', async ({
    homePage,
    isDesktop,
    page,
  }) => {
    test.skip(isDesktop, 'モバイルビューポートのみ');
    await homePage.goto();

    const body = page.locator('body');
    const header = homePage.header;
    await expect(header.hamburger).toHaveAttribute('aria-expanded', 'false');
    await expect(body).not.toHaveCSS('overflow', 'hidden');

    // 初回の start クラス除去と、2 回目以降のトグルを両方通す。
    for (let cycle = 0; cycle < 2; cycle++) {
      await header.openMobileMenu();
      await expect(body).toHaveCSS('overflow', 'hidden');
      await expect(header.aboutLink).toBeVisible();

      await header.hamburger.click();

      await expect(header.hamburger).toHaveAttribute('aria-expanded', 'false');
      await expect(header.aboutLink).toBeHidden();
      await expect
        .poll(() => body.evaluate((element) => element.style.overflow))
        .toBe('unset');
      await expect(body).toHaveCSS('overflow', 'visible');
    }
  });

  test('ヘッダーの Blog リンクでホームに遷移する', async ({
    aboutPage,
    isDesktop,
    page,
  }) => {
    await aboutPage.goto();
    if (!isDesktop) {
      await aboutPage.header.openMobileMenu();
    }
    await aboutPage.header.blogLink.click();

    await expect(
      page,
      'ヘッダーの Blog リンクからホームページに遷移する',
    ).toHaveURL(HOME_URL_REGEX);
  });

  test('ヘッダーの About リンクで About に遷移する', async ({
    homePage,
    isDesktop,
    page,
  }) => {
    await homePage.goto();
    if (!isDesktop) {
      await homePage.header.openMobileMenu();
    }
    await homePage.header.aboutLink.click();

    await expect(
      page,
      'ヘッダーの About リンクから About ページに遷移する',
    ).toHaveURL(/\/about\/?$/);
  });

  test('フッターの Blog リンクでホームに遷移する', async ({
    aboutPage,
    page,
  }) => {
    await aboutPage.goto();
    await expect(
      aboutPage.footer.rssLink,
      'About ページのフッターに RSS feed リンクが表示される',
    ).toBeVisible();
    await aboutPage.footer.blogLink.click();

    await expect(
      page,
      'フッターの Blog リンクからホームページに遷移する',
    ).toHaveURL(HOME_URL_REGEX);
  });

  test('フッターの About リンクで About に遷移する', async ({
    homePage,
    page,
  }) => {
    await homePage.goto();
    await homePage.footer.aboutLink.click();

    await expect(
      page,
      'フッターの About リンクから About ページに遷移する',
    ).toHaveURL(/\/about\/?$/);
  });
});
