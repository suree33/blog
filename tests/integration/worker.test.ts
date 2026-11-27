import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createTestHarness } from 'wrangler';

if (!existsSync('dist')) {
  throw new Error(
    'dist/ is missing. Run pnpm run build:ci before test:integration.',
  );
}

const slug = 'audio-interface-under-the-desk';
const title = 'オーディオインターフェースを机の裏に設置した';
const postPath = `/posts/${slug}/`;
const server = createTestHarness({
  workers: [{ configPath: './wrangler.toml' }],
});
let markdown: string;

beforeAll(async () => {
  markdown = await readFile(`dist/posts/${slug}.md`, 'utf8');
  await server.listen();
});

afterAll(async () => {
  await server.close();
});

const varyTokens = (response: Awaited<ReturnType<typeof server.fetch>>) =>
  response.headers
    .get('vary')
    ?.toLowerCase()
    .split(/\s*,\s*/) ?? [];

test('default post request returns HTML with Vary: Accept', async () => {
  const response = await server.fetch(postPath);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/^text\/html\b/);
  expect(varyTokens(response)).toContain('accept');
  expect(await response.text()).toContain(title);
});

test('Accept: text/markdown returns the built post Markdown', async () => {
  const response = await server.fetch(postPath, {
    headers: { Accept: 'text/markdown' },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe(
    'text/markdown; charset=utf-8',
  );
  expect(varyTokens(response)).toContain('accept');
  expect(await response.text()).toBe(markdown);
});

test('.md URL returns UTF-8 Markdown', async () => {
  const response = await server.fetch(`/posts/${slug}.md`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe(
    'text/markdown; charset=utf-8',
  );
  expect(await response.text()).toBe(markdown);
});

test('static CSS is served without Worker-added Vary: Accept', async () => {
  const css = (await readdir('dist/_astro')).find((file) =>
    file.endsWith('.css'),
  );
  expect(css, 'build must contain a CSS asset').toBeDefined();
  const response = await server.fetch(`/_astro/${css}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/^text\/css\b/);
  expect(varyTokens(response)).not.toContain('accept');
  expect(await response.text()).toBe(
    await readFile(`dist/_astro/${css}`, 'utf8'),
  );
});

test.each(['/this-integration-route-does-not-exist', '/posts/no-such-post/'])(
  '%s returns the site 404 page',
  async (path) => {
    const response = await server.fetch(path);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toMatch(/^text\/html\b/);
    expect(await response.text()).toContain(
      'このページは見つかりませんでした…',
    );
  },
);

test('Dreamhouse has no built HTML or raw Markdown assets', () => {
  expect(existsSync('dist/dreamhouse')).toBe(false);
  expect(existsSync('dist/dreamhouse.md')).toBe(false);
});

test.each([
  ['/dreamhouse', 'text/html'],
  ['/dreamhouse/', 'text/html'],
  ['/dreamhouse.md', 'text/markdown'],
  ['/dreamhouse/', 'text/markdown'],
])('unpublished %s returns 404 with Accept: %s', async (path, accept) => {
  const response = await server.fetch(path, { headers: { Accept: accept } });
  expect(response.status).toBe(404);
});

test('public outputs omit Dreamhouse', async () => {
  const sitemap = await server.fetch('/sitemap-index.xml');
  expect(sitemap.status).toBe(200);
  const sitemapLocations = [
    ...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g),
  ];
  expect(sitemapLocations.length).toBeGreaterThan(0);

  for (const path of [
    ...sitemapLocations.map(([, url]) => new URL(url).pathname),
    '/rss.xml',
    '/llms.txt',
    '/index.md',
    '/about.md',
    '/tags/生活.md',
    '/tags/ガジェット.md',
  ]) {
    const response = await server.fetch(path);
    expect(response.status, path).toBe(200);
    const body = await response.text();
    expect(body, path).not.toContain('/dreamhouse');
    expect(body, path).not.toContain('理想の家のアイデア');
  }
});

const linkHeader = (response: Awaited<ReturnType<typeof server.fetch>>) =>
  response.headers.get('link') ?? '';

test.each([
  ['/', 'index.md'],
  ['/about/', 'about.md'],
  ['/tags/', 'tags.md'],
  ['/tags/%E7%94%9F%E6%B4%BB/', 'tags/生活.md'],
  [postPath, `posts/${slug}.md`],
])(
  '%s negotiates Markdown and links its variant',
  async (path, markdownFile) => {
    const html = await server.fetch(path);
    expect(html.status).toBe(200);
    expect(html.headers.get('content-type')).toMatch(/^text\/html\b/);
    expect(varyTokens(html)).toContain('accept');
    expect(linkHeader(html)).toContain('rel="alternate"; type="text/markdown"');
    expect(linkHeader(html)).toContain(
      '</rss.xml>; rel="alternate"; type="application/rss+xml"',
    );

    const response = await server.fetch(path, {
      headers: { Accept: 'text/markdown' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/markdown; charset=utf-8',
    );
    expect(varyTokens(response)).toContain('accept');
    expect(await response.text()).toBe(
      await readFile(`dist/${markdownFile}`, 'utf8'),
    );
  },
);

test('Link header targets exist', async () => {
  const targets = [
    ...linkHeader(await server.fetch('/')).matchAll(/<([^>]+)>/g),
  ].map(([, target]) => target);
  expect(targets).toEqual([
    '/index.md',
    '/llms.txt',
    '/rss.xml',
    '/sitemap-index.xml',
  ]);
  for (const target of targets) {
    expect((await server.fetch(target)).status, target).toBe(200);
  }
});

test('robots.txt declares Content Signals', async () => {
  const response = await server.fetch('/robots.txt');
  expect(response.status).toBe(200);
  expect(linkHeader(response)).toBe('');
  expect(await response.text()).toMatch(
    /^Content-Signal: search=yes, ai-input=yes, ai-train=yes$/m,
  );
});

test('llms.txt declares UTF-8 in Content-Type', async () => {
  const response = await server.fetch('/llms.txt');
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe(
    'text/plain; charset=utf-8',
  );
});
