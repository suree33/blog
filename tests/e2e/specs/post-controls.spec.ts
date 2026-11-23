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
  await expect(
    untitled.locator('.post-code-copy-check'),
    'コピー後にアイコンがチェックへ切り替わる',
  ).toBeVisible();
  await expect(
    untitled.locator('.post-code-copy-icon'),
    'コピー中はコピーアイコンを隠す',
  ).toBeHidden();
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
  await expect(
    titled.locator('.post-code-copy-check'),
    'コピー後にアイコンがチェックへ切り替わる',
  ).toBeVisible();
  await expect(titled.locator('..').getByRole('status')).toHaveText(
    'コードをコピーしました',
  );
  if (canReadClipboard) {
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(await blocks.nth(2).textContent());
  }
});

test('コピーボタンはコード領域の右上に浮かび、コードタイトルの下に置かれる', async ({
  page,
}) => {
  await page.goto(article);

  const container = page.locator('article .remark-code-container').filter({
    has: page.locator('.remark-code-title', {
      hasText: 'lua/plugins/sidekick.lua',
    }),
  });
  const area = container.locator('> .post-code-area');
  const copy = area.getByRole('button', { name: /のコードをコピー$/ });
  const pre = area.locator('> pre');
  const title = container.locator('> .remark-code-title');

  await expect(
    title,
    'コードタイトルはコンテナ直下のまま（ツールバーへ移動しない）',
  ).toHaveText('lua/plugins/sidekick.lua');
  await expect(
    container.locator('.post-code-area > .remark-code-title'),
    'コードタイトルはコピーボタンの配置領域に入らない',
  ).toHaveCount(0);

  const [copyBox, preBox, titleBox] = await Promise.all([
    copy.boundingBox(),
    pre.boundingBox(),
    title.boundingBox(),
  ]);
  if (!copyBox || !preBox || !titleBox)
    throw new Error('要素の位置を取得できない');

  expect(
    copyBox.y,
    'ボタンはコードタイトルの下端より下にある',
  ).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
  expect(copyBox.y, 'ボタンはコード領域の上端付近にある').toBeLessThanOrEqual(
    preBox.y + 16,
  );
  expect(
    copyBox.x + copyBox.width,
    'ボタンはコード領域の右端付近にある',
  ).toBeLessThanOrEqual(preBox.x + preBox.width);
  expect(
    copyBox.x + copyBox.width,
    'ボタンはコード領域の右端に寄っている',
  ).toBeGreaterThan(preBox.x + preBox.width - 48);
  expect(
    copyBox.width,
    'ボタンの当たり判定は 24px 以上',
  ).toBeGreaterThanOrEqual(24);
  expect(
    copyBox.height,
    'ボタンの当たり判定は 24px 以上',
  ).toBeGreaterThanOrEqual(24);
});

test('コピーボタンがコードの先頭行に重ならない', async ({
  isDesktop,
  page,
}) => {
  if (!isDesktop) await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/posts/zshrc-startup-slow-cause-and-fix/');

  const area = page.locator('.post-code-area').filter({
    hasText: 'if ! command -v compinit >/dev/null; then',
  });
  const copy = area.getByRole('button', { name: 'コードをコピー' });
  const firstLine = area.locator('pre > code > .line').first();

  if (isDesktop) await area.hover();
  await expect(copy).toHaveCSS('opacity', '1');
  await expect(firstLine).toContainText('then');

  const [copyBox, lineBox] = await Promise.all([
    copy.boundingBox(),
    firstLine.boundingBox(),
  ]);
  if (!copyBox || !lineBox) throw new Error('要素の位置を取得できない');
  expect(lineBox.y).toBeGreaterThanOrEqual(copyBox.y + copyBox.height);
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
  await expect(
    copy.locator('.post-code-copy-check'),
    '失敗時はチェックアイコンへ切り替えない',
  ).toBeHidden();
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
      .include('.post-code-copy')
      .analyze();
    expect(violations, colorScheme).toEqual([]);
  }
});
