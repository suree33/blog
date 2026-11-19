import type { Locator } from '@playwright/test';
import { expect, test } from '../fixtures/test';

test.use({ viewport: { width: 390, height: 844 } });

async function waitForHeaderAnimations(header: Locator): Promise<void> {
  await header.evaluate(async (node) => {
    await Promise.allSettled(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
  });
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test.describe(reducedMotion, () => {
    test.use({ reducedMotion });

    test('scroll and mobile menu respect the motion preference', async ({
      homePage,
      page,
    }) => {
      await homePage.goto();
      const reduced = reducedMotion === 'reduce';
      const header = homePage.header;
      const menu = header.root.locator('.sm-menu');
      const lines = header.hamburger.locator('.line');

      await expect(page.locator('html')).toHaveCSS(
        'scroll-behavior',
        reduced ? 'auto' : 'smooth',
      );
      if (reduced) {
        for (const element of [header.root, header.root.locator('h1'), menu]) {
          await expect(element).toHaveCSS('transition-property', 'none');
        }
      } else {
        await expect(menu).toHaveCSS('transition-duration', '0.5s');
      }

      for (let cycle = 0; cycle < 2; cycle++) {
        await header.hamburger.click();
        await expect(header.hamburger).toHaveAttribute('aria-expanded', 'true');
        for (const line of await lines.all()) {
          await expect(line).toHaveCSS(
            'animation-duration',
            reduced ? '0s' : '0.5s',
          );
        }
        await waitForHeaderAnimations(header.root);
        await expect(menu).toBeVisible();
        await expect(menu).toHaveCSS('opacity', '1');
        await expect(header.aboutLink).toBeVisible();
        const angles = await lines.evaluateAll((nodes) =>
          nodes.map((node) => {
            const matrix = new DOMMatrix(getComputedStyle(node).transform);
            return Math.round((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI);
          }),
        );
        expect(angles).toEqual([45, -45]);

        await header.hamburger.click();
        await waitForHeaderAnimations(header.root);
        await expect(header.hamburger).toHaveAttribute(
          'aria-expanded',
          'false',
        );
        await expect(menu).toBeHidden();
        for (const line of await lines.all()) {
          await expect(line).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
        }
      }
    });
  });
}
