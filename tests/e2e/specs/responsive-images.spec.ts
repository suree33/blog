import { expect, test } from '../fixtures/test';
import { routes } from '../utils/routes';

test('loads the About photo eagerly at a responsive size', async ({ page }) => {
  await page.goto(routes.about);
  const photo = page.getByRole('img', {
    name: '渋谷のスクランブル交差点でタクシーを横から撮影した写真',
  });

  await expect(photo).toHaveAttribute('loading', 'eager');
  await expect(photo).toHaveAttribute('fetchpriority', 'high');
  await expect(photo).toHaveAttribute('sizes', /calc\(100vw - 2rem\)/);
  await expect(photo).toHaveAttribute('srcset', /360w, .*580w, .*1080w/);
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.currentSrc))
    .toContain('/_astro/');
  expect(
    await photo.evaluate((image: HTMLImageElement) => image.currentSrc),
  ).not.toBe(await photo.evaluate((image: HTMLImageElement) => image.src));
});

test('loads article photos lazily with responsive candidates', async ({
  page,
}) => {
  await page.goto(routes.sampleArticle);
  const photos = page.locator('article').getByRole('img', { name: /./ });
  await expect(photos).toHaveCount(3);

  for (const photo of await photos.all()) {
    await expect(photo).toHaveAttribute('loading', 'lazy');
    await expect(photo).toHaveAttribute('sizes', /^auto, /);
    await expect(photo).toHaveAttribute('srcset', /360w, .*580w/);
  }
});
