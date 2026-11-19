import { expect, test } from '../fixtures/test';

/** HTML の `class` 属性値内で `dark` を単独のクラスとしてマッチする。 */
const DARK = /(?:^|\s)dark(?:\s|$)/;
/** HTML の `class` 属性値内で `light` を単独のクラスとしてマッチする。 */
const LIGHT = /(?:^|\s)light(?:\s|$)/;
const DARK_BACKGROUND = /oklch\(0\.145 0 (?:0|none)\)/;

/**
 * テーマトグルの挙動。
 *
 * テーマトグルボタンはヘッダーのアイコン群にあり、小さいビューポートでは
 * モバイルのスライドダウンメニュー内に隠れる。そのためモバイルでは
 * ハンバーガーメニューを開いてからトグルを操作する。
 * デスクトップ・モバイル両方のプロジェクトで実行する。
 * システム配色を `light` にエミュレートし、3 状態のトグルサイクル
 * （ダーク → ライト → システム）を決定的にする。
 */
test.describe('テーマトグル', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('localStorage が使えなくてもダーク → ライト → システムを循環する', async ({
    homePage,
    isDesktop,
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Access is denied', 'SecurityError');
        },
      });
    });

    await homePage.goto();
    const html = page.locator('html');
    expect(pageErrors, '読み込み時にページエラーが発生しない').toEqual([]);
    await expect(html, '初期状態ではシステム設定を使う').not.toHaveAttribute(
      'class',
      DARK,
    );
    await expect(html, '初期状態ではライトを明示しない').not.toHaveAttribute(
      'class',
      LIGHT,
    );
    await expect(html, '初期状態では両方の配色に対応する').toHaveCSS(
      'color-scheme',
      'light dark',
    );

    // モバイルではメニューを開いてからトグルを操作する。
    if (!isDesktop) {
      await homePage.header.openMobileMenu();
    }
    await homePage.header.toggleTheme();
    await expect(html, '1 回目はダークになる').toHaveAttribute('class', DARK);
    await expect(html, 'ダークの配色を適用する').toHaveCSS(
      'color-scheme',
      'dark',
    );

    await homePage.header.toggleTheme();
    await expect(html, '2 回目はライトになる').toHaveAttribute('class', LIGHT);
    await expect(html, 'ライトの配色を適用する').toHaveCSS(
      'color-scheme',
      'light',
    );

    await homePage.header.toggleTheme();
    await expect(html, '3 回目はダークを解除する').not.toHaveAttribute(
      'class',
      DARK,
    );
    await expect(html, '3 回目はライトを解除する').not.toHaveAttribute(
      'class',
      LIGHT,
    );
    await expect(html, 'システムの配色に戻る').toHaveCSS(
      'color-scheme',
      'light dark',
    );
    expect(pageErrors, '切り替え後もページエラーが発生しない').toEqual([]);
  });

  test('ダーク → ライト → システムを循環し、リロード後も永続化する', async ({
    homePage,
    isDesktop,
    page,
  }) => {
    // モバイルではトグルがハンバーガーメニュー内にあるため、開いてから押す。
    // リロードするとメニューは閉じるので、クリックのたびにこのヘルパーを通す。
    const toggleTheme = async (): Promise<void> => {
      if (!isDesktop) {
        await homePage.header.openMobileMenu();
      }
      await homePage.header.toggleTheme();
    };

    await homePage.goto();

    const html = page.locator('html');

    // 新規コンテキスト => テーマ未保存 => <html> には明示的なクラスなし。
    await expect(
      html,
      '初期状態では html 要素に dark クラスが付かない',
    ).not.toHaveAttribute('class', DARK);
    await expect(
      html,
      '初期状態では html 要素に light クラスが付かない',
    ).not.toHaveAttribute('class', LIGHT);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')), {
        message: '初期状態では localStorage の theme に値が保存されていない',
      })
      .toBeNull();

    // 1 回目のクリック: 現在は system（null）、システムは light => dark を適用。
    await toggleTheme();
    await expect(
      html,
      '1 回目のテーマ切り替え後は html 要素に dark クラスが付く',
    ).toHaveAttribute('class', DARK);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')), {
        message:
          '1 回目のテーマ切り替え後は localStorage の theme に dark が保存される',
      })
      .toBe('dark');

    // 永続化: リロードすると localStorage からテーマを復元する。
    await page.reload();
    await expect(
      html,
      'リロード後は html 要素に dark クラスが復元される',
    ).toHaveAttribute('class', DARK);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')), {
        message: 'リロード後も localStorage の theme に dark が保存されている',
      })
      .toBe('dark');

    // 2 回目のクリック: 現在は dark、システムは light => light を適用。
    await toggleTheme();
    await expect(
      html,
      '2 回目のテーマ切り替え後は html 要素に light クラスが付く',
    ).toHaveAttribute('class', LIGHT);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')), {
        message:
          '2 回目のテーマ切り替え後は localStorage の theme に light が保存される',
      })
      .toBe('light');

    // 3 回目のクリック: 現在は light、システムは light => system に戻す。
    await toggleTheme();
    await expect(
      html,
      '3 回目のテーマ切り替え後は html 要素に dark クラスが付かない',
    ).not.toHaveAttribute('class', DARK);
    await expect(
      html,
      '3 回目のテーマ切り替え後は html 要素に light クラスが付かない',
    ).not.toHaveAttribute('class', LIGHT);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')), {
        message:
          '3 回目のテーマ切り替え後は localStorage の theme から保存値が削除される',
      })
      .toBeNull();
  });
});

test.describe('ダーク OS のテーマトグル', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
  });

  test('ライト → ダーク → システムを循環し、リロード後も永続化する', async ({
    homePage,
    isDesktop,
    page,
  }) => {
    const toggleTheme = async (): Promise<void> => {
      if (!isDesktop) {
        await homePage.header.openMobileMenu();
      }
      await homePage.header.toggleTheme();
    };

    await homePage.goto();

    const html = page.locator('html');
    const body = page.locator('body');

    await expect(html).not.toHaveAttribute('class', DARK);
    await expect(html).not.toHaveAttribute('class', LIGHT);
    await expect(body).toHaveCSS('background-color', DARK_BACKGROUND);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBeNull();

    await toggleTheme();
    await expect(html).toHaveAttribute('class', LIGHT);
    await expect(html).not.toHaveAttribute('class', DARK);
    await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('light');

    await page.reload();
    await expect(html).toHaveAttribute('class', LIGHT);
    await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('light');

    await toggleTheme();
    await expect(html).toHaveAttribute('class', DARK);
    await expect(html).not.toHaveAttribute('class', LIGHT);
    await expect(body).toHaveCSS('background-color', DARK_BACKGROUND);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('dark');

    await toggleTheme();
    await expect(html).not.toHaveAttribute('class', DARK);
    await expect(html).not.toHaveAttribute('class', LIGHT);
    await expect(body).toHaveCSS('background-color', DARK_BACKGROUND);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBeNull();
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`${colorScheme} OS で無効な保存テーマはシステム設定にフォールバックする`, async ({
    homePage,
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.addInitScript(() => {
      if (window === window.top) {
        localStorage.setItem('theme', 'bogus');
      }
    });
    await homePage.goto();

    const html = page.locator('html');

    await expect(html).not.toHaveAttribute('class', DARK);
    await expect(html).not.toHaveAttribute('class', LIGHT);
    await expect(html).toHaveCSS('color-scheme', 'light dark');
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      colorScheme === 'dark' ? DARK_BACKGROUND : 'rgb(255, 255, 255)',
    );
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBeNull();
  });
}
