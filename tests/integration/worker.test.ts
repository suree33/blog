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
