import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { load } from 'cheerio';
import type openGraph from 'open-graph-scraper';
import remarkLinkCard from 'remark-link-card-plus';
import { markdownToHtml } from 'satteri';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { linkCard } from './link-card';

const nativeFetch = globalThis.fetch;

// OGS rejects loopback destinations and uses undici, not global fetch.
vi.mock('open-graph-scraper', async (importOriginal) => {
  const original = await importOriginal<{ default: typeof openGraph }>();
  return {
    default: async (options: Parameters<typeof original.default>[0]) => {
      if (!options.url) return original.default(options);
      const response = await globalThis.fetch(options.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return original.default({ html: await response.text() });
    },
  };
});

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
let server: Server;
let origin: string;
let directory: string;
let googleStatus = 200;
let googleThrows = false;
let imageStatus = 200;
let imageType = 'image/svg+xml';
let imageThrows = false;
let requests: string[];
let fetch: typeof globalThis.fetch;
const legacyFiles = new Set<string>();
const legacyDirectory = path.join(
  process.cwd(),
  'public/remark-link-card-plus',
);

beforeAll(async () => {
  server = createServer((request, response) => {
    const route = request.url ?? '/';
    if (route === '/error') {
      response.writeHead(500).end();
      return;
    }
    if (route === '/refused') {
      request.socket.destroy();
      return;
    }
    response.setHeader('content-type', 'text/html; charset=utf-8');
    const image =
      route === '/no-image'
        ? ''
        : `<meta property="og:image" content="${origin}/first.svg"><meta property="og:image" content="${origin}/second.svg">`;
    const description =
      route === '/no-description'
        ? ''
        : '<meta property="og:description" content="説明 &lt;b&gt;bold&lt;/b&gt; &lt;script&gt;bad()&lt;/script&gt;">';
    const favicon =
      route === '/no-favicon'
        ? ''
        : `<link rel="icon" href="${route === '/malformed-favicon' ? 'http://[' : route === '/relative' ? '/favicon.svg' : `${origin}/favicon.svg`}">`;
    response.end(
      `<html><head><meta charset="utf-8"><meta property="og:title" content="日本語 &lt;em&gt;title&lt;/em&gt; &amp; test">${description}${image}${favicon}</head><body></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  origin = `http://127.0.0.1:${address.port}`;
  for (const file of await readdir(legacyDirectory).catch(() => []))
    legacyFiles.add(file);
});

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'link-card-'));
  requests = [];
  googleStatus = 200;
  googleThrows = false;
  imageStatus = 200;
  imageType = 'image/svg+xml';
  imageThrows = false;
  fetch = vi.fn(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.startsWith('https://www.google.com/s2/favicons')) {
      if (googleThrows) throw new Error('Google unavailable');
      return new Response(init?.method === 'HEAD' ? null : svg, {
        status: googleStatus,
        headers: { 'content-type': 'image/svg+xml' },
      });
    }
    if (!url.startsWith(origin)) throw new Error(`Unexpected network: ${url}`);
    if (url.endsWith('.svg')) {
      if (imageThrows) throw new Error('Image unavailable');
      return new Response(svg, {
        status: imageStatus,
        headers: { 'content-type': imageType },
      });
    }
    return nativeFetch(input, init);
  });
  vi.stubGlobal('fetch', fetch);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  for (const file of await readdir(legacyDirectory).catch(() => [])) {
    if (!legacyFiles.has(file)) await rm(path.join(legacyDirectory, file));
  }
});

function normalized(html: string) {
  const $ = load(
    html
      .replaceAll('remark-link-card-plus__', 'link-card__')
      .replaceAll('/remark-link-card-plus/', '/link-card-images/'),
  );
  $('*')
    .contents()
    .each((_, node) => {
      if (node.type === 'text' && !node.data.trim()) $(node).remove();
    });
  return $('body').html();
}

async function render(
  markdown: string,
  plugin = linkCard({ fetch, cacheDirectory: directory }),
) {
  return (await markdownToHtml(markdown, { mdastPlugins: [plugin] })).html;
}

describe('remark-link-card-plus 0.8.1 との HTML 互換性', () => {
  test.each([
    '/full',
    '/no-image',
    '/no-description',
    '/relative',
    '/no-favicon',
    '/error',
    '/refused',
  ])('%s', async (route) => {
    const markdown = `<${origin}${route}>`;
    const legacy = await createMarkdownProcessor({
      remarkPlugins: [[remarkLinkCard, { cache: true }]],
      syntaxHighlight: false,
    });
    const oldHtml = (await legacy.render(markdown)).code;
    const newHtml = await render(markdown);
    expect(normalized(newHtml)).toEqual(normalized(oldHtml));
    const $ = load(newHtml);
    expect($('.link-card__container')).toHaveLength(1);
    expect($('.link-card__content').text()).not.toContain('bad()');
    expect($('.link-card__image').attr('src') ?? '').not.toContain(
      'second.svg',
    );
  });

  test.each([
    (url: string) => url,
    (url: string) => `[${url}](${url})`,
    (url: string) => `**${url}**`,
    (url: string) => `inline <${url}> text`,
    (url: string) => `- <${url}>`,
    (url: string) => `[label](${url})`,
    (url: string) => `[${url}](${origin}/different)`,
    (url: string) => `> <${url}>`,
    () => '',
  ])('URL の対象判定 %#', async (fixture) => {
    const markdown = fixture(`${origin}/full`);
    const legacy = await createMarkdownProcessor({
      remarkPlugins: [[remarkLinkCard, { cache: true }]],
      syntaxHighlight: false,
    });
    expect(normalized(await render(markdown))).toEqual(
      normalized((await legacy.render(markdown)).code),
    );
  });

  test('CSS は接頭辞以外を変更しない', async () => {
    const oldCss = await readFile('src/styles/remark-link-card.css', 'utf8');
    expect(await readFile('src/styles/link-card.css', 'utf8')).toBe(
      oldCss.replaceAll('remark-link-card-plus__', 'link-card__'),
    );
  });
});

describe('取得失敗とキャッシュ', () => {
  test('不正な favicon URL は他のメタデータを保持して Google にフォールバックする', async () => {
    const $ = load(await render(`<${origin}/malformed-favicon>`));
    expect($('.link-card__title').text()).toBe('日本語 title & test');
    expect($('.link-card__description').text()).toBe('説明 bold ');
    expect($('.link-card__image')).toHaveLength(1);
    const fallback = 'https://www.google.com/s2/favicons?domain=127.0.0.1';
    const hash = createHash('sha256').update(fallback).digest('hex');
    expect($('.link-card__favicon').attr('src')).toBe(
      `/link-card-images/${hash}.svg`,
    );
    expect(requests).toContain(`HEAD ${fallback}`);
    expect(console.warn).toHaveBeenCalled();
  });

  test('既定の OGS URL 取得でも同じメタデータを描画する', async () => {
    const $ = load(
      await render(`<${origin}/full>`, linkCard({ cacheDirectory: directory })),
    );
    expect($('.link-card__title').text()).toBe('日本語 title & test');
    expect($('.link-card__description').text()).toBe('説明 bold ');
    expect($('.link-card__image')).toHaveLength(1);
    expect(requests).toContain(`GET ${origin}/full`);
  });

  test('空の文書と対象外の段落は通信もキャッシュ作成もしない', async () => {
    await render('');
    await render(`inline <${origin}/full> text`);
    expect(requests).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
  });

  test('Google HEAD が例外でも縮退カードを残す', async () => {
    googleThrows = true;
    const $ = load(await render(`<${origin}/error>`));
    expect($('.link-card__title').text()).toBe('127.0.0.1');
    expect($('.link-card__description').text()).toBe('');
    expect($('.link-card__favicon, .link-card__thumbnail')).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });

  test('Google HEAD が非 OK なら favicon を省略する', async () => {
    googleStatus = 404;
    const $ = load(await render(`<${origin}/error>`));
    expect($('.link-card__container')).toHaveLength(1);
    expect($('.link-card__favicon')).toHaveLength(0);
  });

  test.each(['http', 'non-image', 'throw', 'disk'])(
    '画像の失敗 (%s) はリモート参照に戻す',
    async (failure) => {
      if (failure === 'http') imageStatus = 404;
      if (failure === 'non-image') imageType = 'text/html';
      if (failure === 'throw') imageThrows = true;
      const cacheDirectory =
        failure === 'disk' ? path.join(directory, 'file') : directory;
      if (failure === 'disk') {
        await writeFile(cacheDirectory, 'not a directory');
      }
      const $ = load(
        await render(`<${origin}/full>`, linkCard({ fetch, cacheDirectory })),
      );
      expect($('.link-card__image').attr('src')).toBe(`${origin}/first.svg`);
      expect($('.link-card__favicon').attr('src')).toBe(
        `${origin}/favicon.svg`,
      );
      expect(
        (await readdir(directory)).filter((name) => name.endsWith('.svg')),
      ).toEqual([]);
    },
  );

  test('同時 URL を重複取得せず、SHA-256 キャッシュを次のインスタンスでも再利用する', async () => {
    const plugin = linkCard({ fetch, cacheDirectory: directory });
    const markdown = `<${origin}/full>`;
    const html = await Promise.all([
      render(markdown, plugin),
      render(markdown, plugin),
    ]);
    expect(html[0]).toBe(html[1]);
    expect(
      requests.filter((request) => request === `GET ${origin}/full`),
    ).toHaveLength(1);
    expect(
      requests.filter((request) => request === `GET ${origin}/first.svg`),
    ).toHaveLength(1);
    const hash = createHash('sha256')
      .update(`${origin}/first.svg`)
      .digest('hex');
    expect(await readFile(path.join(directory, `${hash}.svg`), 'utf8')).toBe(
      svg,
    );
    expect(requests.some((request) => request.includes('second.svg'))).toBe(
      false,
    );
    requests = [];
    await render(markdown);
    expect(requests).toEqual([`GET ${origin}/full`]);
  });

  test('外部通信にタイムアウトの signal を渡す', async () => {
    await render(
      `<${origin}/no-favicon>`,
      linkCard({ fetch, timeout: 100, cacheDirectory: directory }),
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.every(([, init]) => init?.signal instanceof AbortSignal),
    ).toBe(true);
    expect(requests).toContain(
      'HEAD https://www.google.com/s2/favicons?domain=127.0.0.1',
    );
  });
});
