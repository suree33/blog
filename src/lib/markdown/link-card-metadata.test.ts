import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  fetchOpenGraph,
  isNonHtmlUrl,
  parseOpenGraph,
  resolveFaviconUrl,
} from './link-card-metadata';

const PAGE_URL = new URL('https://example.com/articles/post?id=1');

function html(head: string, body = ''): string {
  return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseOpenGraph', () => {
  test('og:title / og:description / og:image を取り出す', () => {
    const result = parseOpenGraph(
      html(`
        <title>title 要素</title>
        <meta property="og:title" content="OG タイトル">
        <meta property="og:description" content="OG の説明">
        <meta property="og:image" content="https://cdn.example.com/og.png">
      `),
      PAGE_URL,
    );

    expect(result.title, 'og:title が優先される').toBe('OG タイトル');
    expect(result.description, 'og:description が使われる').toBe('OG の説明');
    expect(result.imageUrl, 'og:image が使われる').toBe(
      'https://cdn.example.com/og.png',
    );
  });

  test('name 属性で書かれた og:* も読む', () => {
    const result = parseOpenGraph(
      html('<meta name="og:title" content="name 属性のタイトル">'),
      PAGE_URL,
    );

    expect(result.title, 'name="og:title" も og:title として扱う').toBe(
      'name 属性のタイトル',
    );
  });

  test('OG がなければ title 要素と meta description にフォールバックする', () => {
    const result = parseOpenGraph(
      html(`
        <title>ページのタイトル</title>
        <meta name="description" content="ページの説明">
      `),
      PAGE_URL,
    );

    expect(result.title, 'title 要素がタイトルになる').toBe('ページのタイトル');
    expect(result.description, 'meta description が説明になる').toBe(
      'ページの説明',
    );
  });

  test('HTML エンティティを展開した文字列を返す', () => {
    const result = parseOpenGraph(
      html(`
        <meta property="og:title" content="A &amp; B &quot;C&quot; &#x3042; &copy;">
        <meta property="og:description" content="&lt;script&gt;alert(1)&lt;/script&gt;">
      `),
      PAGE_URL,
    );

    expect(result.title, '名前付き・数値文字参照が展開される').toBe(
      'A & B "C" あ ©',
    );
    expect(
      result.description,
      'エスケープされたタグは文字列のまま（HTML 出力時にエスケープする）',
    ).toBe('<script>alert(1)</script>');
  });

  test('og:image:secure_url を og:image より優先する', () => {
    const result = parseOpenGraph(
      html(`
        <meta property="og:image" content="http://cdn.example.com/plain.png">
        <meta property="og:image:secure_url" content="https://cdn.example.com/secure.png">
      `),
      PAGE_URL,
    );

    expect(result.imageUrl, 'secure_url が使われる').toBe(
      'https://cdn.example.com/secure.png',
    );
  });

  test('複数の og:image は大きいものを優先する', () => {
    const result = parseOpenGraph(
      html(`
        <meta property="og:image" content="https://cdn.example.com/small.png">
        <meta property="og:image:width" content="100">
        <meta property="og:image" content="https://cdn.example.com/large.png">
        <meta property="og:image:width" content="1200">
      `),
      PAGE_URL,
    );

    expect(result.imageUrl, '幅の大きい画像が使われる').toBe(
      'https://cdn.example.com/large.png',
    );
  });

  test('相対 URL の og:image は使わない（旧プラグインと同じ）', () => {
    const result = parseOpenGraph(
      html('<meta property="og:image" content="/images/og.png">'),
      PAGE_URL,
    );

    expect(
      result.imageUrl,
      '相対 URL のサムネイルは表示しない',
    ).toBeUndefined();
  });

  test('og:image がなければ本文の最初の絶対 URL の画像を使う', () => {
    const result = parseOpenGraph(
      html(
        '',
        '<img src="/relative.png"><img src="https://cdn.example.com/a.jpg"><img src="https://cdn.example.com/b.jpg">',
      ),
      PAGE_URL,
    );

    expect(result.imageUrl, '絶対 URL の最初の画像が使われる').toBe(
      'https://cdn.example.com/a.jpg',
    );
  });

  test('javascript: などの URL は画像として使わない', () => {
    const result = parseOpenGraph(
      html('<meta property="og:image" content="javascript:alert(1)">'),
      PAGE_URL,
    );

    expect(result.imageUrl, 'http(s) 以外の画像 URL は捨てる').toBeUndefined();
  });

  test('favicon の相対 URL はページのオリジン基準で解決する', () => {
    const result = parseOpenGraph(
      html('<link rel="icon" href="favicon.ico">'),
      PAGE_URL,
    );

    expect(
      result.faviconUrl,
      'パスではなくオリジンを基準に解決する（旧プラグインと同じ）',
    ).toBe('https://example.com/favicon.ico');
  });

  test('favicon はプロトコル相対 URL も解決する', () => {
    const result = parseOpenGraph(
      html('<link rel="icon" href="//static.example.net/icon.png">'),
      PAGE_URL,
    );

    expect(result.faviconUrl, 'ページのプロトコルで補われる').toBe(
      'https://static.example.net/icon.png',
    );
  });

  test('favicon は shortcut icon → icon → apple-touch-icon の順に探す', () => {
    const withShortcut = parseOpenGraph(
      html(`
        <link rel="apple-touch-icon" href="/apple.png">
        <link rel="icon" href="/icon.png">
        <link rel="shortcut icon" href="/shortcut.ico">
      `),
      PAGE_URL,
    );
    const withAppleOnly = parseOpenGraph(
      html('<link rel="apple-touch-icon" href="/apple.png">'),
      PAGE_URL,
    );

    expect(withShortcut.faviconUrl, 'shortcut icon が最優先').toBe(
      'https://example.com/shortcut.ico',
    );
    expect(
      withAppleOnly.faviconUrl,
      'icon がなければ apple-touch-icon を使う',
    ).toBe('https://example.com/apple.png');
  });

  test('メタデータがなければすべて undefined を返す', () => {
    const result = parseOpenGraph(html(''), PAGE_URL);

    expect(result, '取り出せる項目がない').toEqual({
      title: undefined,
      description: undefined,
      faviconUrl: undefined,
      imageUrl: undefined,
    });
  });

  test('壊れた HTML でも例外にならない', () => {
    const result = parseOpenGraph(
      '<meta property="og:title" content="閉じていない<<<',
      PAGE_URL,
    );

    expect(result.faviconUrl, '例外を投げずに結果を返す').toBeUndefined();
  });
});

describe('resolveFaviconUrl', () => {
  test('絶対 URL はそのまま返す', () => {
    expect(
      resolveFaviconUrl('https://cdn.example.com/f.ico', PAGE_URL),
      '絶対 URL は変わらない',
    ).toBe('https://cdn.example.com/f.ico');
  });

  test('http(s) 以外は捨てる', () => {
    expect(
      resolveFaviconUrl('data:image/png;base64,AAAA', PAGE_URL),
      'data URL は使わない',
    ).toBeUndefined();
  });
});

describe('isNonHtmlUrl', () => {
  test('PDF や画像の URL は HTML ではないと判定する', () => {
    expect(isNonHtmlUrl('https://example.com/doc.pdf'), 'PDF').toBe(true);
    expect(
      isNonHtmlUrl('https://example.com/a.png?x=1'),
      'クエリ付き画像',
    ).toBe(true);
    expect(isNonHtmlUrl('https://example.com/page.html'), 'HTML').toBe(false);
  });
});

describe('fetchOpenGraph', () => {
  function respond(body: BodyInit, init: ResponseInit = {}) {
    return vi.fn(async () => new Response(body, init));
  }

  test('HTML を取得して解析する', async () => {
    const fetch = respond(
      html('<meta property="og:title" content="取得したタイトル">'),
      { headers: { 'content-type': 'text/html; charset=utf-8' } },
    );

    const result = await fetchOpenGraph(PAGE_URL, { fetch, timeout: 1000 });

    expect(result?.title, '取得した HTML の og:title').toBe('取得したタイトル');
    expect(fetch, 'ページの URL を取得する').toHaveBeenCalledWith(
      PAGE_URL.href,
      expect.objectContaining({ headers: { Accept: 'text/html' } }),
    );
  });

  test('meta charset に従って Shift_JIS のページを読む', async () => {
    // 「日本語」の Shift_JIS
    const title = Buffer.from([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]);
    const body = Buffer.concat([
      Buffer.from(
        '<html><head><meta charset="Shift_JIS"><meta property="og:title" content="',
      ),
      title,
      Buffer.from('"></head></html>'),
    ]);
    const fetch = respond(body, { headers: { 'content-type': 'text/html' } });

    const result = await fetchOpenGraph(PAGE_URL, { fetch, timeout: 1000 });

    expect(result?.title, 'Shift_JIS をデコードする').toBe('日本語');
  });

  test.each([
    ['404', () => new Response('not found', { status: 404 })],
    [
      'HTML ではない応答',
      () =>
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
    ],
    [
      '空の本文',
      () => new Response('', { headers: { 'content-type': 'text/html' } }),
    ],
  ])('%s のときは警告して undefined を返す', async (_label, makeResponse) => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const fetch = vi.fn(async () => makeResponse());

    const result = await fetchOpenGraph(PAGE_URL, { fetch, timeout: 1000 });

    expect(result, '失敗時は undefined').toBeUndefined();
    expect(warn, '失敗した URL を警告する').toHaveBeenCalledWith(
      expect.stringContaining(PAGE_URL.href),
    );
  });

  test('ネットワークエラーのときは警告して undefined を返す', async () => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    const result = await fetchOpenGraph(PAGE_URL, { fetch, timeout: 1000 });

    expect(result, '失敗時は undefined').toBeUndefined();
    expect(warn, 'エラー内容を警告する').toHaveBeenCalledWith(
      expect.stringContaining('fetch failed'),
    );
  });

  test('タイムアウトしたら中断して undefined を返す', async () => {
    const warn = vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const fetch = vi.fn(
      (_input: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const result = await fetchOpenGraph(PAGE_URL, { fetch, timeout: 20 });

    expect(result, 'タイムアウト時は undefined').toBeUndefined();
    expect(warn, 'タイムアウトを警告する').toHaveBeenCalledWith(
      expect.stringContaining('タイムアウト'),
    );
  });

  test('HTML ではない拡張子の URL は取得しない', async () => {
    vi.spyOn(console, 'warn').mockReturnValue(undefined);
    const fetch = vi.fn();

    const result = await fetchOpenGraph(new URL('https://example.com/a.pdf'), {
      fetch,
      timeout: 1000,
    });

    expect(result, 'PDF はメタデータなし').toBeUndefined();
    expect(fetch, 'リクエストしない').not.toHaveBeenCalled();
  });
});
