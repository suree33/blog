import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { markdownToHtml } from 'satteri';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { imageExtension, imageFileStem } from './link-card-image';
import {
  createLinkCardResolver,
  limitConcurrency,
  linkCard,
  renderLinkCard,
  sanitizeText,
  type LinkCardOptions,
} from './link-card';

/** 1x1 の PNG。 */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

type Route = () => Response | Promise<Response>;

/** URL ごとに応答を決める偽の fetch。登録していない URL は 404。 */
function fakeFetch(routes: Record<string, Route>) {
  return vi.fn(async (input: string) => {
    const route = routes[input];
    return route ? route() : new Response('not found', { status: 404 });
  });
}

function htmlPage(head: string) {
  return () =>
    new Response(`<!doctype html><html><head>${head}</head></html>`, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}

function image(contentType = 'image/png', body: Buffer = PNG) {
  return () =>
    new Response(new Uint8Array(body), {
      headers: { 'content-type': contentType },
    });
}

let imageDirectory: string;

beforeEach(async () => {
  imageDirectory = await mkdtemp(path.join(tmpdir(), 'link-card-test-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(imageDirectory, { recursive: true, force: true });
});

function options(fetch: LinkCardOptions['fetch']): LinkCardOptions {
  return { fetch, imageDirectory, imagePublicPath: '/cards/', timeout: 200 };
}

async function render(markdown: string, fetch: LinkCardOptions['fetch']) {
  const { html } = await markdownToHtml(markdown, {
    mdastPlugins: [linkCard(options(fetch))],
  });
  return html;
}

const FULL_PAGE = htmlPage(`
  <meta property="og:title" content="記事のタイトル">
  <meta property="og:description" content="記事の説明">
  <meta property="og:image" content="https://cdn.example.com/og.png">
  <link rel="icon" href="/favicon.png">
`);

describe('カードにする段落', () => {
  const fetch = () =>
    fakeFetch({
      'https://example.com/post': FULL_PAGE,
      'https://cdn.example.com/og.png': image(),
      'https://example.com/favicon.png': image(),
    });

  test.each([
    ['裸の URL', 'https://example.com/post'],
    ['山括弧の自動リンク', '<https://example.com/post>'],
    [
      'リンク文字列とリンク先が同じリンク',
      '[https://example.com/post](https://example.com/post)',
    ],
  ])('%s だけの段落はカードになる', async (_label, markdown) => {
    const html = await render(markdown, fetch());

    expect(html, 'カードのコンテナが出力される').toContain(
      '<div class="link-card__container">',
    );
    expect(html, 'カードは記事の URL へリンクする').toContain(
      'href="https://example.com/post"',
    );
    expect(html, '段落としては出力されない').not.toContain('<p>');
  });

  test.each([
    ['文中の URL', '詳しくは https://example.com/post を参照'],
    [
      '文字列とリンク先が違うリンク',
      '[https://example.com/post](https://example.org/)',
    ],
    ['URL ではない文字列のリンク', '[記事](https://example.com/post)'],
    ['リストの中の URL', '- https://example.com/post'],
    ['引用の中の URL', '> https://example.com/post'],
    ['複数の URL', 'https://example.com/post https://example.com/post'],
  ])('%s はカードにならない', async (_label, markdown) => {
    const spy = fetch();
    const html = await render(markdown, spy);

    expect(html, 'カードは出力されない').not.toContain('link-card__');
    expect(spy, '外部取得もしない').not.toHaveBeenCalled();
  });

  test('サイトの記事にある複雑な URL も 1 つのリンクとしてカードになる', async () => {
    const urls = [
      'https://docs.qmk.fm/feature_advanced_keycodes#modifier-keys:~:text=and%20press%20kc-,HYPR(kc),-Hold%20Left%20Control',
      'https://www.reddit.com/r/Keychron/comments/17yv7nk/comment/ks710n9/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button',
      'https://community.intel.com/t5/Processors/July-2024-Update-on-Instability-Reports-on-Intel-Core-13th-and/m-p/1617113#M74792',
    ];
    vi.spyOn(console, 'warn').mockReturnValue(undefined);

    for (const url of urls) {
      const html = await render(url, fakeFetch({}));
      expect(html, `${url} がカードになる`).toContain('link-card__container');
      expect(html, `${url} の後ろに文字が残らない`).not.toContain('<p>');
    }
  });
});

describe('カードの内容', () => {
  test('OG のタイトル・説明・画像・favicon を表示する', async () => {
    const html = await render(
      'https://example.com/post',
      fakeFetch({
        'https://example.com/post': FULL_PAGE,
        'https://cdn.example.com/og.png': image(),
        'https://example.com/favicon.png': image(),
      }),
    );

    const ogStem = imageFileStem(new URL('https://cdn.example.com/og.png'));
    const faviconStem = imageFileStem(
      new URL('https://example.com/favicon.png'),
    );
    expect(html, 'タイトル').toContain(
      '<div class="link-card__title">記事のタイトル</div>',
    );
    expect(html, '説明').toContain(
      '<div class="link-card__description">記事の説明</div>',
    );
    expect(html, 'サムネイルは保存した画像を参照する').toContain(
      `<img src="/cards/${ogStem}.png" class="link-card__image" alt="">`,
    );
    expect(html, 'favicon は保存した画像を 14px で表示する').toContain(
      `<img src="/cards/${faviconStem}.png" class="link-card__favicon" width="14" height="14" alt="">`,
    );
    expect(html, 'URL 欄にはホスト名を表示する').toContain(
      '<span class="link-card__url">example.com</span>',
    );
    expect(html, '新しいタブで開く').toContain(
      'target="_blank" rel="noreferrer noopener" class="link-card__card"',
    );
  });

  test('OG の文字列に含まれるタグは無害化する（XSS 対策）', async () => {
    const html = await render(
      'https://evil.example/',
      fakeFetch({
        'https://evil.example/': htmlPage(`
          <meta property="og:title" content="前&lt;script&gt;alert(1)&lt;/script&gt;後">
          <meta property="og:description" content="&lt;img src=x onerror=alert(1)&gt;説明 &amp; &lt;a href=&quot;javascript:alert(1)&quot; onclick=&quot;x&quot;&gt;リンク&lt;/a&gt;">
          <meta property="og:image" content="https://evil.example/x.png?&quot;onerror=&quot;alert(1)">
        `),
      }),
    );

    expect(html, 'script は中身ごと取り除かれる').toContain(
      '<div class="link-card__title">前後</div>',
    );
    expect(html, 'img は取り除かれ、a は危険な属性を外して残る').toContain(
      '<div class="link-card__description">説明 &amp; <a>リンク</a></div>',
    );
    expect(html, 'script タグとして出力されない').not.toContain('<script');
    expect(html, 'onerror 属性は出力されない').not.toContain('onerror=alert');
    expect(html, 'javascript: の URL は出力されない').not.toContain(
      'javascript:',
    );
    expect(html, '属性値から抜け出せない').not.toContain('"onerror="');
  });

  test.each([
    ['未知のタグはタグだけを取り除く', 'Using <tag> in X', 'Using  in X'],
    ['script は中身ごと取り除く', 'A<script>alert(1)</script>B', 'AB'],
    ['style も中身ごと取り除く', '<style>p{}</style>本文', '本文'],
    ['img は取り除く', '<img src=x onerror=alert(1)>画像', '画像'],
    ['b などの書式タグは残す', '<b>太字</b>', '<b>太字</b>'],
    [
      'a は危険な属性と URL を外して残す',
      '<a href="javascript:alert(1)" onclick="x">l</a>',
      '<a>l</a>',
    ],
    [
      'タグでない < > & はエスケープする',
      'a < b > c & d',
      'a &lt; b &gt; c &amp; d',
    ],
    ['普通の文字列はそのまま', '記事の "タイトル"', '記事の "タイトル"'],
  ])('sanitizeText: %s', (_label, input, expected) => {
    expect(
      sanitizeText(input),
      `${input} は旧プラグイン（sanitize-html の既定設定）と同じ ${expected} になる`,
    ).toBe(expected);
  });

  test('renderLinkCard は URL・画像パスも属性としてエスケープする', () => {
    const html = renderLinkCard({
      url: new URL('https://example.com/?q=<x>&a="b"'),
      title: 't',
      description: '',
      faviconSrc: 'https://example.com/f.png?"><script>',
      imageSrc: "https://example.com/i.png?'x",
      displayUrl: 'example.com',
    });

    expect(html, 'href の & はエスケープされる').toContain(
      'href="https://example.com/?q=%3Cx%3E&amp;a=%22b%22"',
    );
    expect(html, 'favicon の src から抜け出せない').toContain(
      'src="https://example.com/f.png?&quot;&gt;&lt;script&gt;"',
    );
    expect(html, 'サムネイルの src の引用符もエスケープされる').toContain(
      'src="https://example.com/i.png?&#39;x"',
    );
  });

  test('ページに favicon がなければ Google の favicon サービスの画像を使う', async () => {
    const google = 'https://www.google.com/s2/favicons?domain=example.com';
    const html = await render(
      'https://example.com/post',
      fakeFetch({
        'https://example.com/post': htmlPage(
          '<meta property="og:title" content="t">',
        ),
        [google]: image(),
      }),
    );

    const stem = imageFileStem(new URL(google));
    expect(html, 'Google の favicon を保存して参照する').toContain(
      `<img src="/cards/${stem}.png" class="link-card__favicon"`,
    );
  });
});

describe('取得に失敗したときの縮退', () => {
  test.each([
    ['404', () => new Response('not found', { status: 404 })],
    [
      'HTML ではない応答',
      () =>
        new Response('%PDF', {
          headers: { 'content-type': 'application/pdf' },
        }),
    ],
    [
      'OG タグのない HTML',
      () =>
        new Response('<html><body>no meta</body></html>', {
          headers: { 'content-type': 'text/html' },
        }),
    ],
    [
      'ネットワークエラー',
      () => {
        throw new TypeError('fetch failed');
      },
    ],
  ])('%s でもカードの形を保つ', async (_label, page) => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const html = await render(
      'https://example.com/post',
      fakeFetch({ 'https://example.com/post': page }),
    );

    expect(html, 'カードとして出力される').toContain('link-card__container');
    expect(html, 'タイトルはホスト名になる').toContain(
      '<div class="link-card__title">example.com</div>',
    );
    expect(html, '説明は空のまま要素は残す（高さを保つ）').toContain(
      '<div class="link-card__description"></div>',
    );
    expect(html, 'サムネイルはない').not.toContain('link-card__thumbnail');
    expect(html, 'favicon もない（Google も 404）').not.toContain(
      'link-card__favicon',
    );
    expect(warn, '警告を出す').toHaveBeenCalled();
  });

  test('タイムアウトしてもカードの形を保つ', async () => {
    vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const fetch = vi.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const html = await render('https://example.com/post', fetch);

    expect(html, 'タイトルはホスト名になる').toContain(
      '<div class="link-card__title">example.com</div>',
    );
  });

  test('画像を保存できなければ元の URL を参照する（旧プラグインと同じ）', async () => {
    vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const html = await render(
      'https://example.com/post',
      fakeFetch({ 'https://example.com/post': FULL_PAGE }),
    );

    expect(html, 'サムネイルは外部 URL のまま').toContain(
      '<img src="https://cdn.example.com/og.png" class="link-card__image"',
    );
    expect(html, 'favicon も外部 URL のまま').toContain(
      '<img src="https://example.com/favicon.png" class="link-card__favicon"',
    );
  });
});

describe('画像の保存', () => {
  test('画像 URL の SHA-256 をファイル名にして保存する', async () => {
    const fetch = fakeFetch({
      'https://example.com/post': FULL_PAGE,
      'https://cdn.example.com/og.png': image('image/png'),
      'https://example.com/favicon.png': image('image/png'),
    });

    await render('https://example.com/post', fetch);

    const files = (await readdir(imageDirectory)).sort();
    const expected = [
      `${imageFileStem(new URL('https://cdn.example.com/og.png'))}.png`,
      `${imageFileStem(new URL('https://example.com/favicon.png'))}.png`,
    ].sort();
    expect(files, '2 枚の画像が保存される').toEqual(expected);
    expect(
      await readFile(path.join(imageDirectory, expected[0] ?? '')),
      '内容は取得したバイト列そのまま',
    ).toEqual(PNG);
  });

  test('保存済みの画像は再ダウンロードしない', async () => {
    const stem = imageFileStem(new URL('https://cdn.example.com/og.png'));
    await writeFile(path.join(imageDirectory, `${stem}.webp`), 'cached');
    const fetch = fakeFetch({
      'https://example.com/post': FULL_PAGE,
      'https://example.com/favicon.png': image(),
    });

    const html = await render('https://example.com/post', fetch);

    expect(html, '保存済みのファイルを参照する').toContain(
      `src="/cards/${stem}.webp"`,
    );
    expect(fetch, '画像は取得しない').not.toHaveBeenCalledWith(
      'https://cdn.example.com/og.png',
      expect.anything(),
    );
  });

  test('同じ URL のカードは 1 回だけ取得する', async () => {
    const fetch = fakeFetch({
      'https://example.com/post': FULL_PAGE,
      'https://cdn.example.com/og.png': image(),
      'https://example.com/favicon.png': image(),
    });
    const resolve = createLinkCardResolver(options(fetch));

    await Promise.all([
      resolve(new URL('https://example.com/post')),
      resolve(new URL('https://example.com/post')),
    ]);

    expect(fetch, 'ページ 1 回 + 画像 2 回').toHaveBeenCalledTimes(3);
  });

  test('画像ではない応答は保存しない', async () => {
    vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const fetch = fakeFetch({
      'https://example.com/post': FULL_PAGE,
      'https://cdn.example.com/og.png': () =>
        new Response('<html></html>', {
          headers: { 'content-type': 'text/html' },
        }),
    });

    await render('https://example.com/post', fetch);

    expect(await readdir(imageDirectory), '何も保存されない').toEqual([]);
  });

  test.each([
    ['image/svg+xml', Buffer.from('<svg/>'), '.svg'],
    ['image/png', PNG, '.png'],
    ['application/octet-stream', PNG, '.png'],
    ['image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), '.jpg'],
    ['image/x-icon', Buffer.from([0, 0, 1, 0]), '.ico'],
    ['image/heic', Buffer.from('????'), '.png'],
    ['text/html', Buffer.from('<html>'), undefined],
  ])('%s の拡張子を決める', (contentType, bytes, expected) => {
    expect(
      imageExtension(contentType, new Uint8Array(bytes)),
      `${contentType} は ${expected} として保存する`,
    ).toBe(expected);
  });
});

describe('limitConcurrency', () => {
  test('同時に実行する fetch の数を制限する', async () => {
    let active = 0;
    let peak = 0;
    const fetch = limitConcurrency(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response('');
    }, 2);

    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        fetch(`https://e.example/${index}`),
      ),
    );

    expect(peak, '同時実行数は 2 まで').toBe(2);
  });
});
