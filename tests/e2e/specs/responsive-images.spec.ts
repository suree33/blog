import { expect, test } from '../fixtures/test';
import { routes } from '../utils/routes';

const aboutPhotoAlt = '渋谷のスクランブル交差点でタクシーを横から撮影した写真';

test('loads the About photo eagerly at a responsive size', async ({ page }) => {
  await page.goto(routes.about);
  const photo = page.getByRole('img', {
    name: aboutPhotoAlt,
  });

  await expect(photo).toHaveAttribute('loading', 'eager');
  await expect(photo).toHaveAttribute('fetchpriority', 'high');
  await expect(photo).toHaveAttribute('data-astro-image', 'constrained');
  await expect(photo).toHaveAttribute('sizes', /calc\(250vw - 5rem\)/);
  await expect(photo).toHaveAttribute('srcset', /360w, .*580w, .*1080w/);
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.currentSrc))
    .toContain('/_astro/');
  expect(
    await photo.evaluate((image: HTMLImageElement) => image.currentSrc),
  ).not.toBe(await photo.evaluate((image: HTMLImageElement) => image.src));
});

test('selects a larger About photo when the browser default font is larger', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(browserName !== 'chromium' || isMobile, 'Requires desktop CDP');
  const session = await page.context().newCDPSession(page);
  await session.send('Page.setFontSizes', { fontSizes: { standard: 24 } });
  await page.goto(routes.about);

  const photo = page.getByRole('img', { name: aboutPhotoAlt });
  const { fontSize, displayWidth, sourceWidth } = await photo.evaluate(
    async (image: HTMLImageElement) => {
      await image.decode();
      const candidate = image.srcset
        .split(', ')
        .map((entry) => entry.split(' '))
        .find(([url]) => new URL(url, image.baseURI).href === image.currentSrc);
      return {
        fontSize: getComputedStyle(document.documentElement).fontSize,
        displayWidth: image.getBoundingClientRect().width,
        sourceWidth: Number.parseInt(candidate?.[1] ?? '', 10),
      };
    },
  );
  expect(fontSize).toBe('24px');
  expect(displayWidth).toBeGreaterThan(580);
  expect(sourceWidth).toBe(2700);
});

test('loads article photos lazily with responsive candidates', async ({
  page,
}) => {
  await page.goto(routes.sampleArticle);
  const photos = page.locator('article').getByRole('img', { name: /./ });
  await expect(photos).toHaveCount(3);

  for (const photo of await photos.all()) {
    await expect(photo).toHaveAttribute('loading', 'lazy');
    await expect(photo).not.toHaveAttribute('fetchpriority', 'high');
    await expect(photo).toHaveAttribute('data-astro-image', 'constrained');
    await expect(photo).toHaveAttribute('sizes', /calc\(250vw - 5rem\)/);
    await expect(photo).toHaveAttribute('srcset', /360w, .*580w/);
  }
});

test('preserves source resolution for PNG screenshots while loading lazily', async ({
  page,
}) => {
  await page.goto('/posts/catppuccin-coteditor/');
  const screenshot = page.getByRole('img', {
    name: 'CatppuccinテーマをCotEditorに適用したイメージ',
  });

  await expect(screenshot).toHaveAttribute('loading', 'lazy');
  await expect(screenshot).toHaveAttribute('width', '1752');
  await expect(screenshot).toHaveAttribute('src', /\/_astro\/.*\.webp$/);
  expect(await screenshot.getAttribute('srcset')).toBeNull();
});
