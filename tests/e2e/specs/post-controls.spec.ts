import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../fixtures/test';
import { routes } from '../utils/routes';

const article = `${routes.articleWithCodeBlock}/`;
const headingText = '回避策（workaround）';
const headingId = '回避策workaround';
const fragment = `#${encodeURIComponent(headingId)}`;

/** `oklab(0.27 -0.004 -0.01 / 0.6)` や `rgba(0, 0, 0, 0.6)` から不透明度を取り出す。 */
function colorAlpha(color: string): number {
  const slash = color.match(/\/\s*([\d.]+)\s*\)$/);
  if (slash) return Number(slash[1]);
  const rgba = color.match(/^rgba\(([^)]*)\)$/);
  if (rgba) {
    const parts = rgba[1].split(/[,/]/).map((value) => value.trim());
    return parts.length === 4 ? Number(parts[3]) : 1;
  }
  return 1;
}

/** 色の明るさ。`oklab` は L、`rgb` は sRGB の相対輝度を返す。 */
function colorLightness(color: string): number {
  const oklab = color.match(/^oklab\(\s*([\d.]+)/);
  if (oklab) return Number(oklab[1]);
  const rgb = color.match(/^rgba?\(([^)]*)\)$/);
  if (rgb) {
    const [red, green, blue] = rgb[1]
      .split(',')
      .map((value) => Number(value.trim()) / 255);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }
  throw new Error(`色を解釈できない: ${color}`);
}

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

test('見出しのパーマリンクは見出しの1行目の中央に揃う', async ({ page }) => {
  const collect = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.post-heading')]
        .map((wrapper) => {
          const heading = wrapper.querySelector('h1,h2,h3,h4,h5,h6');
          const icon = wrapper.querySelector('.post-heading-permalink svg');
          if (!heading || !icon) return null;
          const headingBox = heading.getBoundingClientRect();
          const iconBox = icon.getBoundingClientRect();
          const lineHeight = Number.parseFloat(
            getComputedStyle(heading).lineHeight,
          );
          return {
            level: heading.tagName.toLowerCase(),
            text: heading.textContent.trim().slice(0, 20),
            lines: Math.round(headingBox.height / lineHeight),
            offset:
              iconBox.top +
              iconBox.height / 2 -
              (headingBox.top + lineHeight / 2),
          };
        })
        .filter((row) => row !== null),
    );

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/posts/remark-link-card-plus/');
  const wide = await collect();
  for (const level of ['h2', 'h3', 'h4']) {
    expect(
      wide.some((row) => row.level === level),
      `${level} の見出しがある`,
    ).toBe(true);
  }
  for (const row of wide) {
    expect(
      Math.abs(row.offset),
      `${row.level}「${row.text}」のアイコンの中心が見出しの1行目の中心と一致する`,
    ).toBeLessThanOrEqual(1);
  }

  // 折り返す見出しでも 1 行目の中央に揃う
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const narrow = await collect();
  expect(
    narrow.filter((row) => row.lines > 1).length,
    '折り返す見出しが 1 つ以上ある',
  ).toBeGreaterThan(0);
  for (const row of narrow) {
    expect(
      Math.abs(row.offset),
      `${row.level}「${row.text}」（${row.lines} 行）のアイコンが1行目の中心と一致する`,
    ).toBeLessThanOrEqual(1);
  }
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

test('コピーボタンはコードに重なり、ポインタ操作では通常は隠れる', async ({
  isDesktop,
  page,
}) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/posts/zshrc-startup-slow-cause-and-fix/');

    const area = page.locator('.post-code-area').first();
    const copy = area.getByRole('button', { name: 'コードをコピー' });
    const opacity = () =>
      copy.evaluate((element) => getComputedStyle(element).opacity);

    if (isDesktop) {
      await page.mouse.move(0, 0);
      await expect.poll(opacity, `${colorScheme}: 通常は非表示`).toBe('0');
      await area.hover();
      await expect.poll(opacity, `${colorScheme}: ホバーで表示`).toBe('1');
    } else {
      await expect
        .poll(opacity, `${colorScheme}: タッチでは常時表示`)
        .toBe('1');
    }

    const [buttonBackground, backdropFilter] = await Promise.all([
      copy.evaluate((element) => getComputedStyle(element).backgroundColor),
      copy.evaluate((element) => getComputedStyle(element).backdropFilter),
    ]);
    const alpha = colorAlpha(buttonBackground);
    expect(
      alpha,
      `${colorScheme}: 背景は半透明（0.4〜0.9）で下のコードが透ける`,
    ).toBeGreaterThanOrEqual(0.4);
    expect(
      alpha,
      `${colorScheme}: 背景は半透明（0.4〜0.9）で下のコードが透ける`,
    ).toBeLessThanOrEqual(0.9);
    expect(backdropFilter, `${colorScheme}: 背景はぼかさない`).toBe('none');

    const lightness = colorLightness(buttonBackground);
    if (colorScheme === 'light') {
      expect(lightness, 'ライトではコード背景と同じ明るい色').toBeGreaterThan(
        0.9,
      );
    } else {
      expect(lightness, 'ダークではコード背景と同じ暗い色').toBeLessThan(0.4);
    }
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
