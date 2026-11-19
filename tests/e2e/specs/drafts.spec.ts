import { expect, test } from '@playwright/test';

const slug = 'e2e-private-draft';
const tag = 'e2e-draft-only';

test('draft never appears in listings or feeds', async ({ request }) => {
  for (const path of ['/', '/rss.xml', '/sitemap-0.xml', '/tags/Astro/']) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).not.toContain(slug);
    expect(body).not.toContain(tag);
    if (path !== '/tags/Astro/') expect(body).toContain('catppuccin-coteditor');
  }
});

for (const path of [`/tags/${tag}/`, `/posts/${slug}/`, `/posts/${slug}.md`]) {
  test(`draft route ${path} is not built`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(404);
  });
}

test('published article and raw Markdown remain available', async ({
  request,
}) => {
  for (const suffix of ['/', '.md']) {
    expect(
      (await request.get(`/posts/catppuccin-coteditor${suffix}`)).status(),
    ).toBe(200);
  }
});
