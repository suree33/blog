import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import openGraph from 'open-graph-scraper';
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
    default: vi.fn(async (options: Parameters<typeof original.default>[0]) => {
      if (!options.url) return original.default(options);
      const response = await globalThis.fetch(options.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return original.default({ html: await response.text() });
    }),
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
let imageBody = svg;
let imageThrows = false;
let requests: string[];
let fetch: typeof globalThis.fetch;

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
    const imagePrefix = ['/http-image', '/throw-image'].includes(route)
      ? `${route.slice(1)}-`
      : '';
    const image =
      route === '/no-image'
        ? ''
        : `<meta property="og:image" content="${origin}/${imagePrefix}first.svg"><meta property="og:image" content="${origin}/${imagePrefix}second.svg">`;
    const description =
      route === '/no-description'
        ? ''
        : '<meta property="og:description" content="説明 &lt;b&gt;bold&lt;/b&gt; &lt;script&gt;bad()&lt;/script&gt;">';
    const favicon =
      route === '/no-favicon'
        ? ''
        : `<link rel="icon" href="${route === '/malformed-favicon' ? 'http://[' : route === '/relative' ? '/favicon.svg' : `${origin}/${imagePrefix}favicon.svg`}">`;
    response.end(
      `<html><head><meta charset="utf-8"><meta property="og:title" content="日本語 &lt;em&gt;title&lt;/em&gt; &amp; test">${description}${image}${favicon}</head><body></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  origin = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  vi.mocked(openGraph).mockClear();
  directory = await mkdtemp(path.join(tmpdir(), 'link-card-'));
  requests = [];
  googleStatus = 200;
  googleThrows = false;
  imageStatus = 200;
  imageType = 'image/svg+xml';
  imageBody = svg;
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
      return new Response(imageBody, {
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
});

function normalized(html: string) {
  const $ = load(html);
  $('*')
    .contents()
    .each((_, node) => {
      if (node.type === 'text' && !node.data.trim()) $(node).remove();
    });
  let result = $('body').html()?.replaceAll(origin, 'http://127.0.0.1:PORT');
  for (const name of [
    'favicon.svg',
    'first.svg',
    'http-image-favicon.svg',
    'http-image-first.svg',
    'throw-image-favicon.svg',
    'throw-image-first.svg',
  ]) {
    const hash = createHash('sha256').update(`${origin}/${name}`).digest('hex');
    result = result?.replaceAll(hash, name.replace('.svg', ''));
  }
  return result;
}

async function render(
  markdown: string,
  plugin = linkCard({ fetch, cacheDirectory: directory }),
) {
  return (await markdownToHtml(markdown, { mdastPlugins: [plugin] })).html;
}

describe('remark-link-card-plus 0.8.2 との HTML 互換性', () => {
  test.each([
    '/full',
    '/no-image',
    '/no-description',
    '/relative',
    '/no-favicon',
    '/http-image',
    '/throw-image',
    '/error',
    '/refused',
  ])('%s', async (route) => {
    if (route === '/http-image') imageStatus = 404;
    if (route === '/throw-image') imageThrows = true;
    const markdown = `<${origin}${route}>`;
    const newHtml = await render(markdown);
    expect(normalized(newHtml)).toMatchSnapshot();
    const $ = load(newHtml);
    expect($('.link-card__container')).toHaveLength(1);
    expect($('.link-card__content').text()).not.toContain('bad()');
    if (route === '/http-image') {
      expect(requests).toContain(`GET ${origin}/http-image-first.svg`);
      expect($('.link-card__image').attr('src')).toMatch(
        /^\/link-card-images\/.+\.svg$/,
      );
    }
    if (route === '/throw-image') {
      expect($('.link-card__image').attr('src')).toBe(
        `${origin}/throw-image-first.svg`,
      );
    }
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
    expect(normalized(await render(markdown))).toMatchSnapshot();
  });

  test('Thumbnail card CSS stays unchanged', async () => {
    const css = await readFile('src/styles/link-card.css', 'utf8');
    expect(
      css.replace(
        /\n\.link-card__card:not\(:has\(\.link-card__thumbnail\)\) \{[\s\S]*?\n\}\n/,
        '',
      ),
    ).toBe(
      await readFile(
        new URL('./fixtures/link-card.css', import.meta.url),
        'utf8',
      ),
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

  test.each(['/error', '/no-favicon'])(
    'Google HEAD の例外では旧実装と同じ通常リンクを残す (%s)',
    async (route) => {
      googleThrows = true;
      const markdown = `<${origin}${route}>`;
      const html = await render(markdown);
      expect(normalized(html)).toMatchSnapshot();
      const $ = load(html);
      expect($('.link-card__container')).toHaveLength(0);
      expect($('p > a').attr('href')).toBe(`${origin}${route}`);
      expect(console.warn).toHaveBeenCalled();
    },
  );

  test('Google HEAD が非 OK なら favicon を省略する', async () => {
    googleStatus = 404;
    const $ = load(await render(`<${origin}/error>`));
    expect($('.link-card__container')).toHaveLength(1);
    expect($('.link-card__favicon')).toHaveLength(0);
  });

  test.each(['application/pdf', 'image/png'])(
    'PDF は Content-Type が %s でも画像としてキャッシュしない',
    async (contentType) => {
      imageType = contentType;
      imageBody = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF';
      const $ = load(await render(`<${origin}/full>`));
      expect($('.link-card__thumbnail')).toHaveLength(0);
      expect($('.link-card__favicon').attr('src')).toBe(
        `${origin}/favicon.svg`,
      );
      expect(await readdir(directory)).toEqual([]);
      expect(console.warn).toHaveBeenCalled();
    },
  );

  test.each(['http', 'non-image', 'throw', 'timeout', 'read', 'disk'])(
    'Thumbnail failures (%s) preserve remote fallback only for transient errors',
    async (failure) => {
      if (failure === 'http') {
        imageStatus = 404;
        imageType = 'text/html';
        imageBody = 'HTTP error';
      }
      if (failure === 'non-image') imageType = 'text/html';
      if (failure === 'throw') imageThrows = true;
      const cacheDirectory =
        failure === 'disk' ? path.join(directory, 'file') : directory;
      if (failure === 'disk') {
        await writeFile(cacheDirectory, 'not a directory');
      }
      const $ = load(
        await render(
          `<${origin}/full>`,
          linkCard({
            fetch: async (input, init) => {
              if (String(input) === `${origin}/first.svg`) {
                if (failure === 'timeout')
                  throw new DOMException('Timed out', 'TimeoutError');
                if (failure === 'read') {
                  const response = new Response(svg, {
                    headers: { 'content-type': 'image/svg+xml' },
                  });
                  vi.spyOn(response, 'arrayBuffer').mockRejectedValue(
                    new Error('Read failed'),
                  );
                  return response;
                }
              }
              return fetch(input, init);
            },
            cacheDirectory,
          }),
        ),
      );
      if (['throw', 'timeout', 'read', 'disk'].includes(failure))
        expect($('.link-card__image').attr('src')).toBe(`${origin}/first.svg`);
      else expect($('.link-card__thumbnail')).toHaveLength(0);
      if (['timeout', 'read'].includes(failure)) {
        expect($('.link-card__favicon').attr('src')).toMatch(
          /^\/link-card-images\/.+\.svg$/,
        );
        expect(
          (await readdir(directory)).filter((name) => name.endsWith('.svg')),
        ).toHaveLength(1);
      } else {
        expect($('.link-card__favicon').attr('src')).toBe(
          `${origin}/favicon.svg`,
        );
        expect(
          (await readdir(directory)).filter((name) => name.endsWith('.svg')),
        ).toEqual([]);
      }
    },
  );

  test.each(['redirected-403', 'missing-type-html', 'html'])(
    'Failed OG image (%s) has the same markup as an absent OG image',
    async (failure) => {
      const withoutImageFetch: typeof globalThis.fetch = async (
        input,
        init,
      ) => {
        const response = await fetch(input, init);
        if (String(input) !== `${origin}/full`) return response;
        return new Response(
          (await response.text()).replace(
            /<meta property="og:image"[^>]*>/g,
            '',
          ),
          { headers: response.headers },
        );
      };
      const noImage = await render(
        `<${origin}/full>`,
        linkCard({ fetch: withoutImageFetch, cacheDirectory: directory }),
      );
      const imageFetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
        if (String(input) !== `${origin}/first.svg`) return fetch(input, init);
        if (failure === 'timeout') {
          throw new DOMException('Timed out', 'TimeoutError');
        }
        const response = new Response(
          failure === 'missing-type-html'
            ? Buffer.from('<html>Not an image</html>')
            : svg,
          {
            status: failure === 'redirected-403' ? 403 : 200,
            headers:
              failure === 'missing-type-html'
                ? {}
                : {
                    'content-type':
                      failure === 'html' || failure === 'redirected-403'
                        ? 'text/html'
                        : 'image/svg+xml',
                  },
          },
        );
        if (failure === 'redirected-403') {
          Object.defineProperty(response, 'redirected', { value: true });
        }
        return response;
      });
      const html = await render(
        `<${origin}/full>`,
        linkCard({
          fetch: imageFetch,
          cacheDirectory: directory,
        }),
      );
      expect(html).toBe(noImage);
      expect(
        imageFetch.mock.calls.filter(
          ([url]) => String(url) === `${origin}/first.svg`,
        ),
      ).toHaveLength(1);
      expect(console.warn).toHaveBeenCalled();
    },
  );

  test.each([undefined, 'application/octet-stream'])(
    'Detected PNG thumbnails are kept with Content-Type %s',
    async (contentType) => {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64',
      );
      const imageFetch: typeof globalThis.fetch = async (input, init) =>
        String(input) === `${origin}/first.svg`
          ? new Response(png, {
              headers: contentType ? { 'content-type': contentType } : {},
            })
          : fetch(input, init);
      const $ = load(
        await render(
          `<${origin}/full>`,
          linkCard({ fetch: imageFetch, cacheDirectory: directory }),
        ),
      );
      expect($('.link-card__image').attr('src')).toMatch(
        /^\/link-card-images\/.+\.png$/,
      );
      expect($('.link-card__favicon')).toHaveLength(1);
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

  test('既定のタイムアウトは旧 0.8.2 と同じく OGS が 10 秒、HEAD と画像が 10000 ミリ秒', async () => {
    const signalTimeout = vi.spyOn(AbortSignal, 'timeout');
    await render(
      `<${origin}/no-favicon>`,
      linkCard({ cacheDirectory: directory }),
    );
    expect(openGraph).toHaveBeenCalledWith({
      url: `${origin}/no-favicon`,
      timeout: 10,
    });
    expect(signalTimeout.mock.calls.map(([timeout]) => timeout)).toEqual([
      10_000, 10_000, 10_000,
    ]);
  });

  test('注入する fetch のメタデータも既定は 10 秒', async () => {
    const signalTimeout = vi.spyOn(AbortSignal, 'timeout');
    await render(`<${origin}/no-favicon>`);
    expect(signalTimeout.mock.calls.map(([timeout]) => timeout)).toEqual([
      10_000, 10_000, 10_000, 10_000,
    ]);
  });

  test('明示したタイムアウトは OGS に秒単位で渡す', async () => {
    await render(
      `<${origin}/no-favicon>`,
      linkCard({ timeout: 100, cacheDirectory: directory }),
    );
    expect(openGraph).toHaveBeenCalledWith({
      url: `${origin}/no-favicon`,
      timeout: 0.1,
    });
  });

  test('明示したタイムアウトを注入する fetch にも渡す', async () => {
    const signalTimeout = vi.spyOn(AbortSignal, 'timeout');
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
    expect(signalTimeout.mock.calls.map(([timeout]) => timeout)).toEqual([
      100, 100, 100, 100,
    ]);
  });
});
