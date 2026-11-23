import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../fixtures/test';
import { routes } from '../utils/routes';

const article = `${routes.articleWithCodeBlock}/`;
const headingText = '回避策（workaround）';
const headingId = '回避策workaround';
const fragment = `#${encodeURIComponent(headingId)}`;

test('見出しのパーマリンクを Enter で開くと既存の見出しと目次が同期する', async ({
  page,
}) => {
  await page.goto(article);
  const heading = page.getByRole('heading', { name: headingText, exact: true });
  const permalink = page.getByRole('link', {
    name: `「${headingText}」へのパーマリンク`,
    exact: true,
  });
  const tocLink = page
    .getByRole('navigation', { name: '目次' })
    .getByRole('link', { name: headingText, exact: true });

  await expect(heading).toHaveAttribute('id', headingId);
  await expect(tocLink).toHaveAttribute('href', `#${headingId}`);
  await expect(permalink).toBeVisible();
  await expect(permalink).toHaveAttribute('href', fragment);
  await permalink.focus();
  await expect(permalink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${article}${fragment}`);
  await expect(tocLink).toHaveAttribute('aria-current', 'location');

  await page.goto(`${article}${fragment}`);
  await expect(heading).toBeInViewport();
  await expect
    .poll(() =>
      heading.evaluate(
        (element) =>
          element.getBoundingClientRect().top >=
          (document.querySelector('header')?.getBoundingClientRect().bottom ??
            0),
      ),
    )
    .toBe(true);
  await expect(tocLink).toHaveAttribute('aria-current', 'location');
});

test('コードをコピーするとタイトルを除いた本文がクリップボードに入る', async ({
  browserName,
  context,
  page,
  isDesktop,
}) => {
  const canReadClipboard = browserName === 'chromium';
  if (canReadClipboard) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  await page.goto(article);

  const blocks = page.locator('article pre > code');
  await expect(blocks).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: /コードをコピー$/ }),
  ).toHaveCount(3);

  const untitled = page.getByRole('button', {
    name: 'コードをコピー',
    exact: true,
  });
  await untitled.click();
  await expect(untitled).toContainText('コピー済み');
  if (canReadClipboard) {
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(await blocks.nth(0).textContent());
  }

  const titled = page.getByRole('button', {
    name: 'lua/plugins/sidekick.lua のコードをコピー',
    exact: true,
  });
  if (isDesktop) {
    await page
      .getByRole('link', { name: `「${headingText}」へのパーマリンク` })
      .focus();
    await page.keyboard.press('Tab');
    await expect(titled).toBeFocused();
    await page.keyboard.press('Space');
  } else {
    await titled.tap();
  }
  await expect(titled).toContainText('コピー済み');
  await expect(titled.locator('..').getByRole('status')).toHaveText(
    'コードをコピーしました',
  );
  if (canReadClipboard) {
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(await blocks.nth(2).textContent());
  }
});

test('クリップボードへの書き込みが拒否されると失敗を通知する', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () =>
          Promise.reject(new DOMException('', 'NotAllowedError')),
      },
    });
  });
  await page.goto(article);
  const copy = page.getByRole('button', {
    name: 'コードをコピー',
    exact: true,
  });
  await copy.click();
  await expect(copy).toContainText('コピー失敗');
  await expect(copy.locator('..').getByRole('status')).toHaveText(
    'コードをコピーできませんでした',
  );
});

test('見出しのパーマリンクとコピーボタンは両テーマで axe の検査を通る', async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== 'chromium', 'axe 検査は Chromium のみ');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto(article);
    await expect(
      page.getByRole('button', { name: 'コードをコピー', exact: true }),
    ).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .include('.post-heading-permalink')
      .include('.post-code-toolbar')
      .analyze();
    expect(violations, colorScheme).toEqual([]);
  }
});
